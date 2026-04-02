"use server";

import { getSupabase, isConfigured, testConnection } from "@/db";

// Re-export testConnection for page use
export { testConnection };

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

// In-memory fallback when Supabase is not available
let memoryEmployees: Employee[] = [];
let memorySchedules: Record<string, Record<string, Record<number, string>>> = {};
let memoryAdminLockedDates: Record<string, number[]> = {}; // monthKey -> [days]
let memoryEmployeeNotes: Record<string, Record<string, string>> = {}; // monthKey -> nik -> note

// Load from localStorage on server (check if we're in browser)
function loadFromBrowserStorage() {
  if (typeof window === "undefined") return;
  
  const storedEmployees = localStorage.getItem("jadwal_employees");
  const storedSchedules = localStorage.getItem("jadwal_schedules");
  const storedAdminLocked = localStorage.getItem("jadwal_admin_locked_dates");
  const storedNotes = localStorage.getItem("jadwal_employee_notes");
  
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
  
  if (storedNotes) {
    try {
      memoryEmployeeNotes = JSON.parse(storedNotes);
    } catch (e) {
      console.error("Error parsing employee notes from localStorage:", e);
    }
  }
}

// Save to localStorage
function saveToBrowserStorage() {
  if (typeof window === "undefined") return;
  localStorage.setItem("jadwal_employees", JSON.stringify(memoryEmployees));
  localStorage.setItem("jadwal_schedules", JSON.stringify(memorySchedules));
  localStorage.setItem("jadwal_admin_locked_dates", JSON.stringify(memoryAdminLockedDates));
  localStorage.setItem("jadwal_employee_notes", JSON.stringify(memoryEmployeeNotes));
}

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  if (!isConfigured) {
    if (memoryEmployees.length === 0) {
      loadFromBrowserStorage();
    }
    return memoryEmployees;
  }
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("employees")
      .select("nik, name, password");
    
    if (error) throw error;
    
    return data.map(row => ({
      nik: row.nik,
      name: row.name,
      password: row.password
    }));
  } catch (error) {
    console.error("Error fetching employees from Supabase:", error);
    if (memoryEmployees.length === 0) {
      loadFromBrowserStorage();
    }
    return memoryEmployees;
  }
}

// Add a new employee
export async function addEmployee(emp: Employee): Promise<void> {
  if (!isConfigured) {
    if (!memoryEmployees.find(e => e.nik === emp.nik)) {
      memoryEmployees.push(emp);
      saveToBrowserStorage();
    }
    return;
  }
  
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("employees")
      .insert([{ nik: emp.nik, name: emp.name, password: emp.password }]);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error adding employee to Supabase:", error);
    if (!memoryEmployees.find(e => e.nik === emp.nik)) {
      memoryEmployees.push(emp);
      saveToBrowserStorage();
    }
  }
}

export async function updateEmployeePassword(nik: string, newPassword: string): Promise<void> {
  if (!isConfigured) {
    const emp = memoryEmployees.find(e => e.nik === nik);
    if (emp) {
      emp.password = newPassword;
      saveToBrowserStorage();
    }
    return;
  }
  
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("employees")
      .update({ password: newPassword })
      .eq("nik", nik);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error updating password in Supabase:", error);
    const emp = memoryEmployees.find(e => e.nik === nik);
    if (emp) {
      emp.password = newPassword;
      saveToBrowserStorage();
    }
  }
}

// Remove an employee
export async function removeEmployee(nik: string): Promise<void> {
  if (!isConfigured) {
    memoryEmployees = memoryEmployees.filter(e => e.nik !== nik);
    Object.keys(memorySchedules).forEach(monthKey => {
      if (memorySchedules[monthKey][nik]) {
        delete memorySchedules[monthKey][nik];
      }
    });
    saveToBrowserStorage();
    return;
  }
  
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("nik", nik);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error removing employee from Supabase:", error);
    memoryEmployees = memoryEmployees.filter(e => e.nik !== nik);
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
  if (!isConfigured) {
    if (Object.keys(memorySchedules).length === 0) {
      loadFromBrowserStorage();
    }
    return memorySchedules;
  }
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("schedules")
      .select("nik, year, month, day, shift");
    
    if (error) throw error;
    
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
  } catch (error) {
    console.error("Error fetching schedules from Supabase:", error);
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
  if (!isConfigured) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
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
  
  try {
    const supabase = getSupabase();
    
    // First check if entry exists
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
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedules")
          .delete()
          .eq("id", existing.id);
        
        if (error) throw error;
      }
    } else if (shift) {
      const { error } = await supabase
        .from("schedules")
        .insert([{ nik, year, month, day, shift }]);
      
      if (error) throw error;
    }
  } catch (error: any) {
    console.error("Error updating schedule in Supabase:", error);
    const errorMsg = error?.message || error?.details || JSON.stringify(error);
    // Fallback to localStorage
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    if (!memorySchedules[monthKey]) memorySchedules[monthKey] = {};
    if (!memorySchedules[monthKey][nik]) memorySchedules[monthKey][nik] = {};
    
    if (shift) {
      memorySchedules[monthKey][nik][day] = shift;
    } else {
      delete memorySchedules[monthKey][nik][day];
    }
    saveToBrowserStorage();
    throw new Error(`Supabase error: ${errorMsg}. Data disimpan di browser storage.`);
  }
}

// Bulk sync employees (replace all)
export async function syncEmployees(emps: Employee[]): Promise<void> {
  if (!isConfigured) {
    memoryEmployees = emps;
    saveToBrowserStorage();
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Delete all employees first
    const { error: deleteError } = await supabase
      .from("employees")
      .delete()
      .neq("nik", "");
    
    if (deleteError) throw deleteError;
    
    // Delete all schedules
    const { error: deleteSchedulesError } = await supabase
      .from("schedules")
      .delete()
      .neq("nik", "");
    
    if (deleteSchedulesError) throw deleteSchedulesError;
    
    // Insert new employees
    if (emps.length > 0) {
      const { error } = await supabase
        .from("employees")
        .insert(emps.map(emp => ({ nik: emp.nik, name: emp.name, password: emp.password })));
      
      if (error) throw error;
    }
  } catch (error) {
    console.error("Error syncing employees to Supabase:", error);
    memoryEmployees = emps;
    saveToBrowserStorage();
  }
}

// Get admin locked dates (all locked days across months)
export async function getAdminLockedDates(): Promise<Record<string, number[]>> {
  if (!isConfigured) {
    if (Object.keys(memoryAdminLockedDates).length === 0) {
      loadFromBrowserStorage();
    }
    return memoryAdminLockedDates;
  }
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("admin_locked_dates")
      .select("year, month, day");
    
    if (error) throw error;
    
    const result: Record<string, number[]> = {};
    for (const row of data) {
      const monthKey = `${row.year}-${String(row.month).padStart(2, "0")}`;
      if (!result[monthKey]) {
        result[monthKey] = [];
      }
      result[monthKey].push(row.day);
    }
    return result;
  } catch (error) {
    console.error("Error fetching admin locked dates from Supabase:", error);
    if (Object.keys(memoryAdminLockedDates).length === 0) {
      loadFromBrowserStorage();
    }
    return memoryAdminLockedDates;
  }
}

// Save admin locked dates (replace all)
export async function saveAdminLockedDates(dates: Record<string, number[]>): Promise<void> {
  if (!isConfigured) {
    memoryAdminLockedDates = dates;
    saveToBrowserStorage();
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Delete all existing locked dates
    const { error: deleteError } = await supabase
      .from("admin_locked_dates")
      .delete()
      .neq("id", 0);
    
    if (deleteError) throw deleteError;
    
    // Insert new locked dates
    const lockedDatesToInsert: { year: number; month: number; day: number }[] = [];
    for (const [monthKey, days] of Object.entries(dates)) {
      const [year, month] = monthKey.split("-").map(Number);
      for (const day of days) {
        lockedDatesToInsert.push({ year, month, day });
      }
    }
    
    if (lockedDatesToInsert.length > 0) {
      const { error } = await supabase
        .from("admin_locked_dates")
        .insert(lockedDatesToInsert);
      
      if (error) throw error;
    }
  } catch (error) {
    console.error("Error saving admin locked dates to Supabase:", error);
    memoryAdminLockedDates = dates;
    saveToBrowserStorage();
  }
}

// Get employee notes (all notes across months)
export async function getEmployeeNotes(): Promise<Record<string, Record<string, string>>> {
  if (!isConfigured) {
    if (Object.keys(memoryEmployeeNotes).length === 0) {
      loadFromBrowserStorage();
    }
    return memoryEmployeeNotes;
  }
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("employee_notes")
      .select("nik, year, month, note")
      .neq("note", "");
    
    if (error) throw error;
    
    const result: Record<string, Record<string, string>> = {};
    for (const row of data) {
      const monthKey = `${row.year}-${String(row.month).padStart(2, "0")}`;
      if (!result[monthKey]) {
        result[monthKey] = {};
      }
      result[monthKey][row.nik] = row.note || "";
    }
    return result;
  } catch (error) {
    console.error("Error fetching employee notes from Supabase:", error);
    if (Object.keys(memoryEmployeeNotes).length === 0) {
      loadFromBrowserStorage();
    }
    return memoryEmployeeNotes;
  }
}

// Save employee notes (replace all)
export async function saveEmployeeNotes(notes: Record<string, Record<string, string>>): Promise<void> {
  if (!isConfigured) {
    memoryEmployeeNotes = notes;
    saveToBrowserStorage();
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Delete all existing notes
    const { error: deleteError } = await supabase
      .from("employee_notes")
      .delete()
      .neq("id", 0);
    
    if (deleteError) throw deleteError;
    
    // Insert new notes
    const notesToInsert: { nik: string; year: number; month: number; note: string }[] = [];
    for (const [monthKey, nikNotes] of Object.entries(notes)) {
      const [year, month] = monthKey.split("-").map(Number);
      for (const [nik, note] of Object.entries(nikNotes)) {
        if (note && note.trim()) {
          notesToInsert.push({ nik, year, month, note });
        }
      }
    }
    
    if (notesToInsert.length > 0) {
      const { error } = await supabase
        .from("employee_notes")
        .insert(notesToInsert);
      
      if (error) throw error;
    }
  } catch (error) {
    console.error("Error saving employee notes to Supabase:", error);
    memoryEmployeeNotes = notes;
    saveToBrowserStorage();
  }
}

// Validate login
export async function validateLogin(nik: string, password: string): Promise<Employee | null> {
  // Check admin
  if (nik === "ADMIN" && password === "admin123") {
    return { nik: "ADMIN", name: "Administrator", password: "admin123" };
  }
  
  if (!isConfigured) {
    const emp = memoryEmployees.find(e => e.nik === nik);
    return emp && emp.password === password ? emp : null;
  }
  
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("employees")
      .select("nik, name, password")
      .eq("nik", nik)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;
    
    return data.password === password 
      ? { nik: data.nik, name: data.name, password: data.password } 
      : null;
  } catch (error) {
    console.error("Error validating login in Supabase:", error);
    const emp = memoryEmployees.find(e => e.nik === nik);
    return emp && emp.password === password ? emp : null;
  }
}

// Check database connection status
export async function checkDbConnection(): Promise<{ connected: boolean; error?: string }> {
  return await testConnection();
}

// Delete old schedules (from previous months)
export async function deleteOldSchedules(): Promise<void> {
  if (!isConfigured) {
    // For memory storage, filter out old months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    
    const updatedSchedules: Record<string, Record<string, Record<number, string>>> = {};
    for (const [monthKey, schedules] of Object.entries(memorySchedules)) {
      // Keep current month and future months
      if (monthKey >= currentKey) {
        updatedSchedules[monthKey] = schedules;
      }
    }
    memorySchedules = updatedSchedules;
    saveToBrowserStorage();
    return;
  }
  
  try {
    const supabase = getSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    
    // Delete schedules from months before the current month
    const { error } = await supabase
      .from("schedules")
      .delete()
      .or(`year.lt.${currentYear},and(year.eq.${currentYear},month.lt.${currentMonth})`);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting old schedules from Supabase:", error);
  }
}
