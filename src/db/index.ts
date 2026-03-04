import Database from "better-sqlite3";
import * as schema from "./schema";

// Create database connection
const dbPath = process.env.DATABASE_URL || "./data.db";
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database tables
import "./init";

// Export for use in actions
export { schema };
