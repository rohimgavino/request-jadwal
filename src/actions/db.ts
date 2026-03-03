"use server";

import { db } from "@/db";
import { employees, schedules } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Employee types
export type Employee = {
  nik: string;
  name: string;
  password: string;
};

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  const result = await db.select({
    nik: employees.nik,
    name: employees.name,
    password: employees.password,
  }).from(employees);
  return result;
}

// Add a new employee
export async function addEmployee(emp: Employee): Promise<void> {
  await db.insert(employees).values(emp);
}

// Update employee password
export async function updateEmployeePassword(nik: string, newPassword: string): Promise<void> {
  await db.update(employees).set({ password: newPassword }).where(eq(employees.nik, nik));
}

// Remove an employee
export async function removeEmployee(nik: string): Promise<void> {
  await db.delete(schedules).where(eq(schedules.nik, nik));
  await db.delete(employees).where(eq(employees.nik, nik));
}

// Schedule types
export type ScheduleData = Record<string, Record<number, string>>; // monthKey -> nik -> day -> shift

// Get all schedules for a specific year/month
export async function getSchedules(year: number, month: number): Promise<Record<string, Record<number, string>>> {
  const result = await db.select({
    nik: schedules.nik,
    day: schedules.day,
    shift: schedules.shift,
  }).from(schedules).where(
    and(
      eq(schedules.year, year),
      eq(schedules.month, month)
    )
  );

  // Convert to nested record
  const schedule: Record<string, Record<number, string>> = {};
  for (const row of result) {
    if (!schedule[row.nik]) {
      schedule[row.nik] = {};
    }
    schedule[row.nik][row.day] = row.shift;
  }
  return schedule;
}

// Get all schedules (all months)
export async function getAllSchedules(): Promise<Record<string, Record<string, Record<number, string>>>> {
  const result = await db.select({
    nik: schedules.nik,
    year: schedules.year,
    month: schedules.month,
    day: schedules.day,
    shift: schedules.shift,
  }).from(schedules);

  // Convert to nested record: year-month -> nik -> day -> shift
  const allSchedules: Record<string, Record<string, Record<number, string>>> = {};
  for (const row of result) {
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
  const existing = await db.select()
    .from(schedules)
    .where(
      and(
        eq(schedules.nik, nik),
        eq(schedules.year, year),
        eq(schedules.month, month),
        eq(schedules.day, day)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    if (shift) {
      // Update existing
      await db.update(schedules)
        .set({ shift })
        .where(
          and(
            eq(schedules.nik, nik),
            eq(schedules.year, year),
            eq(schedules.month, month),
            eq(schedules.day, day)
          )
        );
    } else {
      // Delete if shift is empty
      await db.delete(schedules)
        .where(
          and(
            eq(schedules.nik, nik),
            eq(schedules.year, year),
            eq(schedules.month, month),
            eq(schedules.day, day)
          )
        );
    }
  } else if (shift) {
    // Insert new
    await db.insert(schedules).values({
      nik,
      year,
      month,
      day,
      shift,
    });
  }
}

// Bulk update schedules (for initial data sync)
export async function syncSchedules(data: Record<string, Record<string, Record<number, string>>>): Promise<void> {
  // This is a simple sync - delete all and re-insert
  // For production, you'd want to do upsert
  
  // Clear all schedules (or you could be smarter about this)
  await db.delete(schedules);

  // Insert all schedules
  const values: typeof schedules.$inferInsert[] = [];
  for (const [monthKey, monthData] of Object.entries(data)) {
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-indexed

    for (const [nik, days] of Object.entries(monthData)) {
      for (const [dayStr, shift] of Object.entries(days)) {
        if (shift) {
          values.push({
            nik,
            year,
            month,
            day: parseInt(dayStr),
            shift,
          });
        }
      }
    }
  }

  if (values.length > 0) {
    await db.insert(schedules).values(values);
  }
}

// Bulk sync employees (replace all)
export async function syncEmployees(emps: Employee[]): Promise<void> {
  await db.delete(employees);
  if (emps.length > 0) {
    await db.insert(employees).values(emps);
  }
}

// Validate login
export async function validateLogin(nik: string, password: string): Promise<Employee | null> {
  if (nik === "ADMIN" && password === "admin123") {
    return { nik: "ADMIN", name: "Administrator", password: "admin123" };
  }

  const result = await db.select({
    nik: employees.nik,
    name: employees.name,
    password: employees.password,
  }).from(employees).where(eq(employees.nik, nik)).limit(1);

  if (result.length === 0) return null;
  const emp = result[0];
  if (emp.password !== password) return null;
  return emp;
}
