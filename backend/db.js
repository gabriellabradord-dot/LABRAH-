import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const { Pool } = pg;
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendDirectory, '.env') });
dotenv.config();
// DATABASE_URL activa PostgreSQL; sin esa URL se conserva un SQLite local persistente.
const usePostgres = Boolean(process.env.DATABASE_URL);
const products = [
  [1, 'Camiseta Hormigón Oversize', 'Camisetas', 38, 28, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [2, 'Sudadera Sin Señal', 'Sudaderas', 94, 16, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [3, 'Cargo Medianoche', 'Pantalones', 112, 12, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [4, 'Gorra Corazón Cromado', 'Accesorios', 46, 30, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [5, 'Chaqueta Cremallera Nocturna', 'Chaquetas', 148, 8, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [6, 'Zapatilla de Hormigón', 'Calzado', 126, 11, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [7, 'Denim Desgastado', 'Pantalones', 104, 14, 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s'],
  [8, 'Camiseta Manga Larga Sombra', 'Camisetas', 58, 22, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1000&q=85', 'Cr8K88UcO0s']
];

let sqlite;
let pool;
if (usePostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_SIZE) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
} else {
  const configuredPath = process.env.SQLITE_PATH || './db.sqlite';
  const filePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(backendDirectory, configuredPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  sqlite = new DatabaseSync(filePath);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
}

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Mantiene una interfaz SQL común; solo los parámetros ? necesitan traducirse para pg.
async function query(executor, sql, values = []) {
  if (usePostgres) return executor.query(postgresSql(sql), values);
  const statement = executor.prepare(sql);
  const sqliteValues = values.map((value) => typeof value === 'boolean' ? Number(value) : value);
  if (statement.columns().length > 0) return { rows: statement.all(...sqliteValues), changes: 0 };
  return { rows: [], changes: statement.run(...sqliteValues).changes };
}

const schemaSqlite = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    avatar_base64 TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT NOT NULL,
    video_embed_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'paid',
    payment_method TEXT NOT NULL,
    shipping_name TEXT NOT NULL DEFAULT '',
    shipping_email TEXT NOT NULL DEFAULT '',
    shipping_address TEXT NOT NULL DEFAULT '',
    shipping_city TEXT NOT NULL DEFAULT '',
    shipping_postal TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
`;

const schemaPostgres = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    avatar_base64 TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT NOT NULL,
    video_embed_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'paid',
    payment_method TEXT NOT NULL,
    shipping_name TEXT NOT NULL DEFAULT '',
    shipping_email TEXT NOT NULL DEFAULT '',
    shipping_address TEXT NOT NULL DEFAULT '',
    shipping_city TEXT NOT NULL DEFAULT '',
    shipping_postal TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
`;

function addTransactionColumn(name) {
  const definition = `${name} TEXT NOT NULL DEFAULT ''`;
  if (usePostgres) return pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${name} ${definition}`);
  const columns = sqlite.prepare('PRAGMA table_info(orders)').all();
  if (!columns.some((column) => column.name === name)) sqlite.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
  return Promise.resolve();
}

export async function initializeDatabase(hashPassword) {
  if (usePostgres) await pool.query(schemaPostgres);
  else sqlite.exec(schemaSqlite);

  // Migración aditiva para instalaciones creadas antes de guardar datos de envío.
  for (const column of ['shipping_name', 'shipping_email', 'shipping_address', 'shipping_city', 'shipping_postal']) {
    await addTransactionColumn(column);
  }

  for (const [id, title, category, price, stock, imageUrl, videoId] of products) {
    await query(usePostgres ? pool : sqlite, `
      INSERT INTO products (id, title, category, price, stock, image_url, video_embed_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, category = excluded.category,
        image_url = excluded.image_url, video_embed_id = excluded.video_embed_id
    `, [id, title, category, price, stock, imageUrl, videoId]);
  }

  await ensureBootstrapAdmin(hashPassword);
}

async function ensureBootstrapAdmin(hashPassword) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 8) {
    throw new Error('ADMIN_EMAIL debe ser válido y ADMIN_PASSWORD tener al menos 8 caracteres.');
  }

  const existing = await database.get('SELECT id FROM users WHERE email = ?', [email]);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await database.run("UPDATE users SET role = 'admin', password_hash = ?, email_verified = ? WHERE id = ?", [passwordHash, true, existing.id]);
  } else {
    await database.insert("INSERT INTO users (full_name, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'admin', ?)", [process.env.ADMIN_NAME?.trim() || 'Administración LABRAH', email, passwordHash, true]);
  }
}

export const database = {
  get: async (sql, values = []) => (await query(usePostgres ? pool : sqlite, sql, values)).rows[0] || null,
  all: async (sql, values = []) => (await query(usePostgres ? pool : sqlite, sql, values)).rows,
  run: async (sql, values = []) => {
    if (usePostgres) {
      const result = await pool.query(postgresSql(sql), values);
      return { changes: result.rowCount };
    }
    const result = sqlite.prepare(sql).run(...values.map((value) => typeof value === 'boolean' ? Number(value) : value));
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
  },
  insert: async (sql, values = []) => {
    if (usePostgres) {
      const result = await pool.query(`${postgresSql(sql)} RETURNING id`, values);
      return { lastInsertRowid: Number(result.rows[0].id) };
    }
    const result = sqlite.prepare(sql).run(...values.map((value) => typeof value === 'boolean' ? Number(value) : value));
    return { lastInsertRowid: Number(result.lastInsertRowid) };
  },
  transaction: async (callback) => {
    if (!usePostgres) {
      // BEGIN IMMEDIATE protege el inventario de SQLite de pedidos concurrentes.
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await callback(database);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }

  // En PostgreSQL cada transacción fija un cliente para mantener todas las consultas juntas.
    const client = await pool.connect();
    const transactionDatabase = {
      get: async (sql, values = []) => (await query(client, sql, values)).rows[0] || null,
      all: async (sql, values = []) => (await query(client, sql, values)).rows,
      run: async (sql, values = []) => {
        const result = await client.query(postgresSql(sql), values);
        return { changes: result.rowCount };
      },
      insert: async (sql, values = []) => {
        const result = await client.query(`${postgresSql(sql)} RETURNING id`, values);
        return { lastInsertRowid: Number(result.rows[0].id) };
      }
    };
    try {
      await client.query('BEGIN');
      const result = await callback(transactionDatabase);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  close: async () => {
    if (usePostgres) await pool.end();
    else sqlite.close();
  },
  dialect: usePostgres ? 'postgres' : 'sqlite'
};
