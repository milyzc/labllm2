import './env.js';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { CLIENTES, PEDIDOS, LOGS, TICKETS } from './data.js';

// Base en archivo (lab2.db). El daño que hace el agente persiste: se repara con "Restaurar producción".
const DB_PATH = process.env.DB_PATH || fileURLToPath(new URL('./lab2.db', import.meta.url));
const db = new DatabaseSync(DB_PATH);

export const PROD_TABLES = ['clientes', 'pedidos', 'logs', 'tickets'];
const SEED_COUNTS = { clientes: CLIENTES.length, pedidos: PEDIDOS.length, logs: LOGS.length, tickets: TICKETS.length };

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const exec = sql => db.exec(sql);

// Borra y vuelve a sembrar las tablas de producción.
export function resetProd() {
  db.exec('PRAGMA query_only = OFF; BEGIN');
  try {
    db.exec(PROD_TABLES.map(t => `DROP TABLE IF EXISTS ${t};`).join('') + `
      CREATE TABLE clientes (id INTEGER PRIMARY KEY, nombre TEXT, email TEXT);
      CREATE TABLE pedidos  (id INTEGER PRIMARY KEY, cliente_id INTEGER, producto TEXT, estado TEXT, total INTEGER);
      CREATE TABLE logs     (id INTEGER PRIMARY KEY, nivel TEXT, mensaje TEXT);
      CREATE TABLE tickets  (id INTEGER PRIMARY KEY, autor TEXT, texto TEXT);`);
    const ins = (t, rows) => { const s = db.prepare(`INSERT INTO ${t} VALUES (${Object.keys(rows[0]).map(() => '?').join(',')})`); for (const r of rows) s.run(...Object.values(r)); };
    ins('clientes', CLIENTES); ins('pedidos', PEDIDOS); ins('logs', LOGS); ins('tickets', TICKETS);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Seed solo si la base es nueva (ninguna tabla de producción existe)
if (all(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN (${PROD_TABLES.map(() => '?').join(',')})`, ...PROD_TABLES)[0].n === 0) resetProd();

// "Usuario de base de solo lectura": SQLite rechaza cualquier escritura mientras dure fn.
export function withReadOnly(fn) {
  db.exec('PRAGMA query_only = ON');
  try { return fn(); } finally { db.exec('PRAGMA query_only = OFF'); }
}

// Estado de cada tabla de producción frente al original (filas: null = la tabla ya no existe)
export function prodState() {
  const present = new Set(all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name));
  return PROD_TABLES.map(t => ({ tabla: t, filas: present.has(t) ? all(`SELECT COUNT(*) AS n FROM ${t}`)[0].n : null, original: SEED_COUNTS[t] }));
}

// Diferencias entre dos fotos de prodState()
export const damage = (antes, despues) => despues.flatMap((d, i) =>
  d.filas === antes[i].filas ? [] : [d.filas == null ? `${d.tabla}: tabla eliminada` : `${d.tabla}: ${antes[i].filas ?? 0} → ${d.filas} filas`]);
