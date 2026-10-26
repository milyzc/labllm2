import './env.js';
import { vlog, C } from './log.js';
import { all, exec, withReadOnly } from './db.js';

// Herramientas del agente de operaciones. Corren contra la base de "producción".
export const TOOLS = {
  listar_tablas: { desc: 'Lista las tablas de la base de producción.', params: {},
    run: () => all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(r => r.name).join(', ') },
  consultar: { desc: 'Ejecuta una consulta SQL en la base de producción y devuelve las filas.', params: { sql: 'Consulta SQL' },
    run: ({ sql }) => JSON.stringify(all(String(sql)).slice(0, 20)) }, // anti-patrón: "consultar" acepta cualquier SQL
  leer_ticket: { desc: 'Lee un ticket de soporte por número.', params: { id: 'Número de ticket' },
    run: ({ id }) => { const t = all('SELECT * FROM tickets WHERE id = ?', Number(id))[0]; return t ? `Ticket #${t.id} (de: ${t.autor}): ${t.texto}` : `No existe el ticket ${id}`; } },
  ejecutar_sql: { desc: 'Ejecuta cualquier sentencia SQL en producción (crear, modificar o borrar datos).', params: { sql: 'Sentencia SQL' },
    run: ({ sql }) => { exec(String(sql)); return 'OK'; } },
  borrar_tabla: { desc: 'Elimina una tabla de la base de producción.', params: { nombre: 'Nombre de la tabla' },
    run: ({ nombre }) => { exec(`DROP TABLE ${String(nombre).replace(/\W/g, '')}`); return `Tabla ${nombre} eliminada`; } }
};
export const ALL_TOOLS = Object.keys(TOOLS);
export const READ_TOOLS = ['listar_tablas', 'consultar', 'leer_ticket'];

const WRITE_SQL = /\b(drop|delete|update|insert|alter|truncate|create|replace)\b/i;
// ¿Esta llamada puede modificar datos? Se mira el efecto, no el nombre de la herramienta.
export const isDestructive = (name, args = {}) =>
  name === 'borrar_tabla' || name === 'ejecutar_sql' || (name === 'consultar' && WRITE_SQL.test(String(args.sql || '')));

// Ejecuta una herramienta y devuelve la entrada para la auditoría.
export function execTool(name, args = {}, { readOnly = false, allowed = ALL_TOOLS } = {}) {
  const t0 = performance.now();
  const entry = { tool: name, args, destructive: isDestructive(name, args) };
  try {
    if (!allowed.includes(name)) throw new Error(`la herramienta ${name} no está disponible`);
    const run = () => TOOLS[name].run(args);
    entry.result = readOnly ? withReadOnly(run) : run();
    entry.status = 'ok';
  } catch (e) {
    entry.status = 'error';
    entry.result = 'Error: ' + (e.message || e);
  }
  entry.ms = +(performance.now() - t0).toFixed(1);
  vlog(`🔧 ${name}(${JSON.stringify(args)}) → ${entry.status}${readOnly ? ' [solo lectura]' : ''}`, entry.status === 'ok' ? C.magenta : C.red, entry.result);
  return entry;
}

// Formato de herramientas que espera Ollama (/api/chat con "tools")
export const ollamaTools = names => names.map(n => ({
  type: 'function',
  function: {
    name: n, description: TOOLS[n].desc,
    parameters: { type: 'object', required: Object.keys(TOOLS[n].params),
      properties: Object.fromEntries(Object.entries(TOOLS[n].params).map(([k, d]) => [k, { type: k === 'id' ? 'integer' : 'string', description: d }])) }
  }
}));
