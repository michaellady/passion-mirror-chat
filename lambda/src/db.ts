import pg from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const { Pool } = pg;

let pool: pg.Pool | null = null;

interface DbCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

async function getDbCredentials(): Promise<DbCredentials> {
  const secretName = process.env.DB_SECRET_NAME;

  if (!secretName) {
    // Local development fallback
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'passion',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  if (!response.SecretString) {
    throw new Error('Database secret not found');
  }

  return JSON.parse(response.SecretString);
}

export async function getPool(): Promise<pg.Pool> {
  if (pool) return pool;

  const creds = await getDbCredentials();

  pool = new Pool({
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.username,
    password: creds.password,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
