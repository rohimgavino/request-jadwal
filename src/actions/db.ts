"use server";

import { supabase, isConfigured } from "@/db";

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

// In-memory fallback when Supabase is not configured
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

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  // Load from browser storage if Supabase not configured and not yet loaded
  if ((!isConfigured || !supabase) && memoryEmployees.length === 0) {
    loadFromBrowserStorage();
  }
  
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
      saveToBrowserStorage();
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
    if (emp) {
      emp.password = newPassword;
      saveToBrowserStorage();
    }
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
    saveToBrowserStorage();
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

// Get all schedules (all months)
export async function getAllSchedules(): Promise<Record<string, Record<string, Record<number, string>>>> {
  // Load from browser storage if Supabase not configured and not yet loaded
  if ((!isConfigured || !supabase) && Object.keys(memorySchedules).length === 0) {
    loadFromBrowserStorage();
  }
  
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
    saveToBrowserStorage();
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
    saveToBrowserStorage();
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
