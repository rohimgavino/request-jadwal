import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Employee table
export const employees = sqliteTable("employees", {
  nik: text("nik").primaryKey(),
  name: text("name").notNull(),
  password: text("password").notNull(),
});

// Schedule table - stores shift for each employee per day
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nik: text("nik").notNull().references(() => employees.nik),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 0-11
  day: integer("day").notNull(), // 1-31
  shift: text("shift").notNull(), // P, P0, S, M, L, C, or empty
});

// Unique constraint: one shift per employee per day
// We handle this by UPSERT operations
