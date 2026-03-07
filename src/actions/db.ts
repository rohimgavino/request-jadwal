"use server";

import { query, execute, testConnection, isConfigured } from "@/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// Employee types
export type Employee = {
  nik: string;
  name: string;
  password: string;
};

// Schedule types
type MonthSchedule = Record<number, string>; // day -> shift
type AllScheduleData = Record<string, Record<string, MonthSchedule>>; // monthKey -> nik -> day -> shift
export type ScheduleData = Record<string, Record<number, string>>;

// In-memory fallback when MySQL is not available
let memoryEmployees: Employee[] = [];
let memorySchedules: Record<string, Record<string, Record<number, string>>> = {};
let memoryAdminLockedDates: Record<string, number[]> = {}; // monthKey -> [days]

// Load from localStorage on server (check if we're in browser)
function loadFromBrowserStorage() {
  if (typeof window === "undefined") return;
  
  const storedEmployees = localStorage.getItem("jadwal_employees");
  const storedSchedules = localStorage.getItem("jadwal_schedules");
  const storedAdminLocked = localStorage.getItem("jadwal_admin_locked_dates");
  
  if (storedEmployees) {
    try {
      memoryEmployees = JSON.parse(storedEmployees);
    } catch (e) {
      console.error("Error parsing employees from localStorage:", e);
    }
  }
  
  if (storedSchedules) {
    try {
      memorySchedules = JSON.parse(storedSchedules);
    } catch (e) {
      console.error("Error parsing schedules from localStorage:", e);
    }
  }
  
  if (storedAdminLocked) {
    try {
      memoryAdminLockedDates = JSON.parse(storedAdminLocked);
    } catch (e) {
      console.error("Error parsing admin locked dates from localStorage:", e);
    }
  }
}

// Save to localStorage
function saveToBrowserStorage() {
  if (typeof window === "undefined") return;
  localStorage.setItem("jadwal_employees", JSON.stringify(memoryEmployees));
  localStorage.setItem("jadwal_schedules", JSON.stringify(memorySchedules));
  localStorage.setItem("jadwal_admin_locked_dates", JSON.stringify(memoryAdminLockedDates));
}

// Initialize database tables
async function initDatabase() {
  try {
    // Create employees table
    await execute(`
      CREATE TABLE IF NOT EXISTS employees (
        nik VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);
    
    // Create schedules table
    await execute(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nik VARCHAR(50) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        day INT NOT NULL,
        shift VARCHAR(10) NOT NULL,
        UNIQUE KEY unique_schedule (nik, year, month, day),
        FOREIGN KEY (nik) REFERENCES employees(nik) ON DELETE CASCADE
      )
    `);
    
    // Create admin locked dates table
    await execute(`
      CREATE TABLE IF NOT EXISTS admin_locked_dates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        month INT NOT NULL,
        day INT NOT NULL,
        UNIQUE KEY unique_locked_date (year, month, day)
      )
    `);
    
    // Auto-delete last month's schedules to save storage
    await cleanupOldSchedules();
    
    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Delete schedules from last month and older
async function cleanupOldSchedules() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // Calculate last month
  let lastMonth = currentMonth - 1;
  let lastMonthYear = currentYear;
  if (lastMonth < 0) {
    lastMonth = 11;
    lastMonthYear = currentYear - 1;
  }
  
  // Delete all schedules from last month or earlier
  try {
    const result = await execute(
      "DELETE FROM schedules WHERE (year < ?) OR (year = ? AND month <= ?)",
      [lastMonthYear, lastMonthYear, lastMonth]
    );
    console.log("Old schedules cleaned up successfully");
  } catch (error) {
    console.error("Error cleaning up old schedules:", error);
  }
}

// Initialize on first import
initDatabase().catch(console.error);

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  // Try database first, fallback to memory
  try {
    const rows = await query<RowDataPacket[]>("SELECT nik, name, password FROM employees");
    return rows.map(row => ({
      nik: row.nik,
      name: row.name,
      password: row.password
    }));
  } catch (error) {
    console.error("Error fetching employees from MySQL:", error);
    // Fallback to memory
    if (memoryEmployees.length === 0) {
      loadFromBrowserStorage();
    }
    return memoryEmployees;
  }
}

// Add a new employee
export async function addEmployee(emp: Employee): Promise<void> {
  try {
    await execute(
      "INSERT INTO employees (nik, name, password) VALUES (?, ?, ?)",
      [emp.nik, emp.name, emp.password]
    );
  } catch (error) {
    console.error("Error adding employee to MySQL:", error);
    // Fallback to memory
    if (!memoryEmployees.find(e => e.nik === emp.nik)) {
      memoryEmployees.push(emp);
      saveToBrowserStorage();
    }
  }
}
export async function updateEmployeePassword(nik: string, newPassword: string): Promise<void> {
  try {
    await execute(
      "UPDATE employees SET password = ? WHERE nik = ?",
      [newPassword, nik]
    );
  } catch (error) {
    console.error("Error updating password in MySQL:", error);
    // Fallback to memory
    const emp = memoryEmployees.find(e => e.nik === nik);
    if (emp) {
      emp.password = newPassword;
      saveToBrowserStorage();
    }
  }
}

// Remove an employee
export async function removeEmployee(nik: string): Promise<void> {
  try {
    // Delete schedules first (due to foreign key)
    await execute("DELETE FROM schedules WHERE nik = ?", [nik]);
    // Delete employee
    await execute("DELETE FROM employees WHERE nik = ?", [nik]);
  } catch (error) {
    console.error("Error removing employee from MySQL:", error);
    // Fallback to memory
    memoryEmployees = memoryEmployees.filter(e => e.nik !== nik);
    // Also remove from schedules
    Object.keys(memorySchedules).forEach(monthKey => {
      if (memorySchedules[monthKey][nik]) {
        delete memorySchedules[monthKey][nik];
      }
    });
    saveToBrowserStorage();
    throw error;
  }
}

// Get all schedules (all months)
export async function getAllSchedules(): Promise<Record<string, Record<string, Record<number, string>>>> {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT nik, year, month, day, shift FROM schedules"
    );
    
    const allSchedules: Record<string, Record<string, Record<number, string>>> = {};
    for (const row of rows) {
      const monthKey = `${row.year}-${String(row.month + 1).padStart(2, "0")}`;
      if (!allSchedules[monthKey]) {
        allSchedules[monthKey] = {};
      }
      if (!allSchedules[monthKey][row.nik]) {
        allSchedules[monthKey][row.nik] = {};
      }
      allSchedules[monthKey][row.nik][row.day] = row.shift;
    }
    return allSchedules;
  } catch (error) {
    console.error("Error fetching schedules from MySQL:", error);
    // Fallback to memory
    if (Object.keys(memorySchedules).length === 0) {
      loadFromBrowserStorage();
    }
    return memorySchedules;
  }
}

// Update a single schedule entry
export async function updateSchedule(
  nik: string,
  year: number,
  month: number,
  day: number,
  shift: string
): Promise<void> {
  try {
    // Check if entry exists
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM schedules WHERE nik = ? AND year = ? AND month = ? AND day = ?",
      [nik, year, month, day]
    );
    
    if (existing.length > 0) {
      if (shift) {
        await execute(
          "UPDATE schedules SET shift = ? WHERE id = ?",
          [shift, existing[0].id]
        );
      } else {
        await execute("DELETE FROM schedules WHERE id = ?", [existing[0].id]);
      }
    } else if (shift) {
      await execute(
        "INSERT INTO schedules (nik, year, month, day, shift) VALUES (?, ?, ?, ?, ?)",
        [nik, year, month, day, shift]
      );
    }
  } catch (error) {
    console.error("Error updating schedule in MySQL:", error);
    // Fallback to memory
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    if (!memorySchedules[monthKey]) memorySchedules[monthKey] = {};
    if (!memorySchedules[monthKey][nik]) memorySchedules[monthKey][nik] = {};
    
    if (shift) {
      memorySchedules[monthKey][nik][day] = shift;
    } else {
      delete memorySchedules[monthKey][nik][day];
    }
    saveToBrowserStorage();
    // Don't throw error - fallback to localStorage succeeded
  }
}

// Bulk sync employees (replace all)
export async function syncEmployees(emps: Employee[]): Promise<void> {
  try {
    // Delete all employees first
    await execute("DELETE FROM employees");
    // Delete all schedules
    await execute("DELETE FROM schedules");
    
    // Insert new employees
    if (emps.length > 0) {
      for (const emp of emps) {
        await execute(
          "INSERT INTO employees (nik, name, password) VALUES (?, ?, ?)",
          [emp.nik, emp.name, emp.password]
        );
      }
    }
  } catch (error) {
    console.error("Error syncing employees to MySQL:", error);
    // Fallback to memory
    memoryEmployees = emps;
    saveToBrowserStorage();
  }
}

// Get admin locked dates (all locked days across months)
export async function getAdminLockedDates(): Promise<Record<string, number[]>> {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT year, month, day FROM admin_locked_dates"
    );
    
    const result: Record<string, number[]> = {};
    for (const row of rows) {
      const monthKey = `${row.year}-${String(row.month).padStart(2, "0")}`;
      if (!result[monthKey]) {
        result[monthKey] = [];
      }
      result[monthKey].push(row.day);
    }
    return result;
  } catch (error) {
    console.error("Error fetching admin locked dates from MySQL:", error);
    // Fallback to memory
    if (Object.keys(memoryAdminLockedDates).length === 0) {
      loadFromBrowserStorage();
    }
    return memoryAdminLockedDates;
  }
}

// Save admin locked dates (replace all)
export async function saveAdminLockedDates(dates: Record<string, number[]>): Promise<void> {
  try {
    // Delete all existing locked dates
    await execute("DELETE FROM admin_locked_dates");
    
    // Insert new locked dates
    for (const [monthKey, days] of Object.entries(dates)) {
      const [year, month] = monthKey.split("-").map(Number);
      for (const day of days) {
        await execute(
          "INSERT INTO admin_locked_dates (year, month, day) VALUES (?, ?, ?)",
          [year, month, day]
        );
      }
    }
  } catch (error) {
    console.error("Error saving admin locked dates to MySQL:", error);
    // Fallback to memory
    memoryAdminLockedDates = dates;
    saveToBrowserStorage();
  }
}

// Validate login
export async function validateLogin(nik: string, password: string): Promise<Employee | null> {
  // Check admin
  if (nik === "ADMIN" && password === "admin123") {
    return { nik: "ADMIN", name: "Administrator", password: "admin123" };
  }
  
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT nik, name, password FROM employees WHERE nik = ?",
      [nik]
    );
    
    if (rows.length === 0) return null;
    
    const emp = rows[0];
    return emp.password === password 
      ? { nik: emp.nik, name: emp.name, password: emp.password } 
      : null;
  } catch (error) {
    console.error("Error validating login in MySQL:", error);
    // Fallback to memory
    const emp = memoryEmployees.find(e => e.nik === nik);
    return emp && emp.password === password ? emp : null;
  }
}
