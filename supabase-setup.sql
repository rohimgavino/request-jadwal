-- =============================================
-- DATABASE TABLES FOR JADWAL KERJA APPLICATION
-- Run this SQL in Supabase SQL Editor
-- =============================================

-- 1. Employees table
CREATE TABLE IF NOT EXISTS employees (
  nik VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL
);

-- 2. Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  nik VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  "day" INTEGER NOT NULL,
  shift VARCHAR(10) NOT NULL,
  FOREIGN KEY (nik) REFERENCES employees(nik) ON DELETE CASCADE,
  UNIQUE(nik, year, month, "day")
);

-- 3. Admin locked dates table
CREATE TABLE IF NOT EXISTS admin_locked_dates (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  "day" INTEGER NOT NULL,
  UNIQUE(year, month, "day")
);

-- 4. Employee notes table
CREATE TABLE IF NOT EXISTS employee_notes (
  id SERIAL PRIMARY KEY,
  nik VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  note TEXT,
  FOREIGN KEY (nik) REFERENCES employees(nik) ON DELETE CASCADE,
  UNIQUE(nik, year, month)
);

-- =============================================
-- INSERT DEFAULT ADMIN USER
-- =============================================
INSERT INTO employees (nik, name, password) 
VALUES ('ADMIN', 'Administrator', 'admin123')
ON CONFLICT (nik) DO NOTHING;

-- =============================================
-- DISABLE ROW LEVEL SECURITY (for simple public access)
-- =============================================
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_locked_dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_notes DISABLE ROW LEVEL SECURITY;
