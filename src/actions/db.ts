"use server";

import { supabase, isConfigured } from "@/db";

// Employee types
export type Employee = {
  nik: string;
  name: string;
  password: string;
};

// In-memory fallback when Supabase is not configured
let memoryEmployees: Employee[] = [
  { nik: "001", name: "Ahmad Fauzi", password: "001" },
  { nik: "002", name: "Budi Santoso", password: "002" },
  { nik: "003", name: "Citra Dewi", password: "003" },
  { nik: "004", name: "Dian Pratama", password: "004" },
  { nik: "005", name: "Eka Rahayu", password: "005" },
  { nik: "006", name: "Fajar Nugroho", password: "006" },
  { nik: "007", name: "Gita Permata", password: "007" },
  { nik: "008", name: "Hendra Wijaya", password: "008" },
];

// In-memory schedule fallback
type MonthSchedule = Record<number, string>; // day -> shift
type AllScheduleData = Record<string, Record<string, MonthSchedule>>; // monthKey -> nik -> day -> shift
let memorySchedules: AllScheduleData = {};

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  if (!isConfigured || !supabase) {
    return memoryEmployees;
  }
  
  const { data, error } = await supabase
    .from("employees")
    .select("nik, name, password");
  
  if (error) {
    console.error("Error fetching employees:", error);
    return memoryEmployees;
  }
  
  return data.map(e => ({ nik: e.nik, name: e.name, password: e.password }));
}

// Add a new employee
export async function addEmployee(emp: Employee): Promise<void> {
  if (!isConfigured || !supabase) {
    if (!memoryEmployees.find(e => e.nik === emp.nik)) {
      memoryEmployees.push(emp);
    }
    return;
  }
  
  const { error } = await supabase
    .from("employees")
    .insert({ nik: emp.nik, name: emp.name, password: emp.password });
  
  if (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
}

// Update employee password
export async function updateEmployeePassword(nik: string, newPassword: string): Promise<void> {
  if (!isConfigured || !supabase) {
    const emp = memoryEmployees.find(e => e.nik === nik);
    if (emp) emp.password = newPassword;
    return;
  }
  
  const { error } = await supabase
    .from("employees")
    .update({ password: newPassword })
    .eq("nik", nik);
  
  if (error) {
    console.error("Error updating password:", error);
    throw error;
  }
}

// Remove an employee
export async function removeEmployee(nik: string): Promise<void> {
  if (!isConfigured || !supabase) {
    memoryEmployees = memoryEmployees.filter(e => e.nik !== nik);
    // Also remove from schedules
    Object.keys(memorySchedules).forEach(monthKey => {
      if (memorySchedules[monthKey][nik]) {
        delete memorySchedules[monthKey][nik];
      }
    });
    return;
  }
  
  // Delete schedule first, then employee
  await supabase.from("schedules").delete().eq("nik", nik);
  
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("nik", nik);
  
  if (error) {
    console.error("Error removing employee:", error);
    throw error;
  }
}

// Schedule types
export type ScheduleData = Record<string, Record<number, string>>;

// Get all schedules (all months)
export async function getAllSchedules(): Promise<Record<string, Record<string, Record<number, string>>>> {
  if (!isConfigured || !supabase) {
    return memorySchedules;
  }
  
  const { data, error } = await supabase
    .from("schedules")
    .select("nik, year, month, day, shift");
  
  if (error) {
    console.error("Error fetching schedules:", error);
    return memorySchedules;
  }
  
  const allSchedules: Record<string, Record<string, Record<number, string>>> = {};
  for (const row of data) {
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
  if (!isConfigured || !supabase) {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    if (!memorySchedules[monthKey]) memorySchedules[monthKey] = {};
    if (!memorySchedules[monthKey][nik]) memorySchedules[monthKey][nik] = {};
    
    if (shift) {
      memorySchedules[monthKey][nik][day] = shift;
    } else {
      delete memorySchedules[monthKey][nik][day];
    }
    return;
  }
  
  // Check if entry exists
  const { data: existing } = await supabase
    .from("schedules")
    .select("id")
    .eq("nik", nik)
    .eq("year", year)
    .eq("month", month)
    .eq("day", day)
    .maybeSingle();
  
  if (existing) {
    if (shift) {
      const { error } = await supabase
        .from("schedules")
        .update({ shift })
        .eq("id", existing.id);
      
      if (error) {
        console.error("Error updating schedule:", error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", existing.id);
      
      if (error) {
        console.error("Error deleting schedule:", error);
        throw error;
      }
    }
  } else if (shift) {
    const { error } = await supabase
      .from("schedules")
      .insert({ nik, year, month, day, shift });
    
    if (error) {
      console.error("Error inserting schedule:", error);
      throw error;
    }
  }
}

// Bulk sync employees (replace all)
export async function syncEmployees(emps: Employee[]): Promise<void> {
  if (!isConfigured || !supabase) {
    memoryEmployees = emps;
    return;
  }
  
  // Delete all and re-insert
  await supabase.from("employees").delete().neq("nik", "");
  
  if (emps.length > 0) {
    const { error } = await supabase
      .from("employees")
      .insert(emps.map(e => ({ nik: e.nik, name: e.name, password: e.password })));
    
    if (error) {
      console.error("Error syncing employees:", error);
      throw error;
    }
  }
}

// Validate login
export async function validateLogin(nik: string, password: string): Promise<Employee | null> {
  if (nik === "ADMIN" && password === "admin123") {
    return { nik: "ADMIN", name: "Administrator", password: "admin123" };
  }
  
  if (!isConfigured || !supabase) {
    const emp = memoryEmployees.find(e => e.nik === nik);
    return emp && emp.password === password ? emp : null;
  }
  
  const { data, error } = await supabase
    .from("employees")
    .select("nik, name, password")
    .eq("nik", nik)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.password === password ? { nik: data.nik, name: data.name, password: data.password } : null;
}
