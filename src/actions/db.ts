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
let memorySchedules: AllScheduleData = {};

// Load from localStorage on server (check if we're in browser)
function loadFromBrowserStorage() {
  if (typeof window === "undefined") return;
  
  const storedEmployees = localStorage.getItem("jadwal_employees");
  const storedSchedules = localStorage.getItem("jadwal_schedules");
  
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
}

// Save to localStorage
function saveToBrowserStorage() {
  if (typeof window === "undefined") return;
  localStorage.setItem("jadwal_employees", JSON.stringify(memoryEmployees));
  localStorage.setItem("jadwal_schedules", JSON.stringify(memorySchedules));
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
    
    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
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
    throw error;
  }
}

// Update employee password
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
    throw error;
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
    throw error;
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
    throw error;
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
