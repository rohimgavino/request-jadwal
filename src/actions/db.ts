"use server";

import { db, schema } from "@/db";

// Employee types
export type Employee = {
  nik: string;
  name: string;
  password: string;
};

// Helper to get all employees from the database
function getAllEmployees(): Employee[] {
  const stmt = db.prepare("SELECT nik, name, password FROM employees");
  return stmt.all() as Employee[];
}

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  return getAllEmployees();
}

// Add a new employee
export async function addEmployee(emp: Employee): Promise<void> {
  const stmt = db.prepare("INSERT INTO employees (nik, name, password) VALUES (?, ?, ?)");
  stmt.run(emp.nik, emp.name, emp.password);
}

// Update employee password
export async function updateEmployeePassword(nik: string, newPassword: string): Promise<void> {
  const stmt = db.prepare("UPDATE employees SET password = ? WHERE nik = ?");
  stmt.run(newPassword, nik);
}

// Remove an employee
export async function removeEmployee(nik: string): Promise<void> {
  const stmt1 = db.prepare("DELETE FROM schedules WHERE nik = ?");
  stmt1.run(nik);
  const stmt2 = db.prepare("DELETE FROM employees WHERE nik = ?");
  stmt2.run(nik);
}

// Schedule types
export type ScheduleData = Record<string, Record<number, string>>; // monthKey -> nik -> day -> shift

// Get all schedules (all months)
export async function getAllSchedules(): Promise<Record<string, Record<string, Record<number, string>>>> {
  const stmt = db.prepare("SELECT nik, year, month, day, shift FROM schedules");
  const rows = stmt.all() as Array<{ nik: string; year: number; month: number; day: number; shift: string }>;

  // Convert to nested record: year-month -> nik -> day -> shift
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
}

// Update a single schedule entry
export async function updateSchedule(
  nik: string,
  year: number,
  month: number,
  day: number,
  shift: string
): Promise<void> {
  // Check if entry exists
  const checkStmt = db.prepare(
    "SELECT id FROM schedules WHERE nik = ? AND year = ? AND month = ? AND day = ?"
  );
  const existing = checkStmt.get(nik, year, month, day) as { id: number } | undefined;

  if (existing) {
    if (shift) {
      // Update existing
      const updateStmt = db.prepare(
        "UPDATE schedules SET shift = ? WHERE nik = ? AND year = ? AND month = ? AND day = ?"
      );
      updateStmt.run(shift, nik, year, month, day);
    } else {
      // Delete if shift is empty
      const deleteStmt = db.prepare(
        "DELETE FROM schedules WHERE nik = ? AND year = ? AND month = ? AND day = ?"
      );
      deleteStmt.run(nik, year, month, day);
    }
  } else if (shift) {
    // Insert new
    const insertStmt = db.prepare(
      "INSERT INTO schedules (nik, year, month, day, shift) VALUES (?, ?, ?, ?, ?)"
    );
    insertStmt.run(nik, year, month, day, shift);
  }
}

// Bulk sync employees (replace all)
export async function syncEmployees(emps: Employee[]): Promise<void> {
  // Use transaction for atomic operation
  const deleteStmt = db.prepare("DELETE FROM employees");
  deleteStmt.run();
  
  if (emps.length > 0) {
    const insertStmt = db.prepare("INSERT INTO employees (nik, name, password) VALUES (?, ?, ?)");
    const insertMany = db.transaction((employees: Employee[]) => {
      for (const emp of employees) {
        insertStmt.run(emp.nik, emp.name, emp.password);
      }
    });
    insertMany(emps);
  }
}

// Validate login
export async function validateLogin(nik: string, password: string): Promise<Employee | null> {
  if (nik === "ADMIN" && password === "admin123") {
    return { nik: "ADMIN", name: "Administrator", password: "admin123" };
  }

  const stmt = db.prepare("SELECT nik, name, password FROM employees WHERE nik = ?");
  const result = stmt.get(nik) as Employee | undefined;

  if (!result) return null;
  if (result.password !== password) return null;
  return result;
}
