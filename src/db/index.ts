import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

// MySQL connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "jadwal_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await getPool().getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error("MySQL connection error:", error);
    return false;
  }
}

// Check if MySQL is configured
export const isConfigured = true;

// Database instance for compatibility
export const db = {
  pool: getPool(),
};

// Helper to run queries
export async function query<T extends RowDataPacket[]>(sql: string, params?: (string | number)[]): Promise<T> {
  const [rows] = await getPool().query<T>(sql, params as (string | number)[]);
  return rows;
}

export async function execute(sql: string, params?: (string | number)[]): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params as (string | number)[]);
  return result;
}
