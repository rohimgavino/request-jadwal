import { db } from "./index";

// Create tables if they don't exist
export function initializeDatabase() {
  // Create employees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      nik TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // Create schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nik TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      shift TEXT NOT NULL,
      FOREIGN KEY (nik) REFERENCES employees(nik)
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_schedules_nik_year_month_day 
    ON schedules(nik, year, month, day)
  `);

  console.log("Database initialized successfully");
}

// Run initialization
initializeDatabase();
