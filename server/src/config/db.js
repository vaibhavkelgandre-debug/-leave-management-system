import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const useSsl = process.env.NODE_ENV === "production" || process.env.DB_SSL === "true";

// Branch on DATABASE_URL vs discrete DB_* vars: local dev configures Postgres
// with separate host/port/user/etc, while managed Postgres on Render (and most
// cloud providers) exposes a single connection string instead.
const poolConfig = process.env.DATABASE_URL
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
      }
    : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
      };

const pool = new Pool({
    ...poolConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Idle clients in the pool can be dropped by the DB server or network at any
// time; without this handler an unhandled 'error' event would crash the process.
pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client", err.message);
});

// Shared connection pool used by every repository — keeps a single set of
// pooled connections instead of each query opening its own client.
export default pool;
