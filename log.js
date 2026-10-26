import './env.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const VERBOSE = process.env.VERBOSE !== '0'; // VERBOSE=0 para silenciar
export const C = { dim: '\x1b[2m', cyan: '\x1b[36m', yellow: '\x1b[33m', green: '\x1b[32m', red: '\x1b[31m', magenta: '\x1b[35m', bold: '\x1b[1m', off: '\x1b[0m' };

// Request-id: viaja con el request (aunque haya awaits) y prefija cada línea del log.
const als = new AsyncLocalStorage();
export const newRid = () => randomUUID().slice(0, 8);
export const withRid = (rid, fn) => als.run({ rid }, fn);
export const getRid = () => als.getStore()?.rid;

export function vlog(title, color, body) {
  if (!VERBOSE) return;
  const rid = getRid();
  const tag = rid ? `${C.dim}[${rid}]${C.off} ` : '';
  console.log(`${tag}${color}${C.bold}${title}${C.off}`);
  if (body != null) for (const l of String(body).split('\n')) console.log(`${tag}    ${l}`);
}
