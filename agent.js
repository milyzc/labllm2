import './env.js';
import { randomUUID } from 'node:crypto';
import { vlog, C } from './log.js';
import { chat, estTokens } from './llm.js';
import { execTool, isDestructive, ollamaTools } from './tools.js';

// Acciones destructivas frenadas, esperando que una persona las apruebe o rechace (id → llamada)
const PENDING = new Map();

/*
 * Loop de agente: el modelo pide herramientas, la app las ejecuta y le devuelve el resultado,
 * hasta que el modelo responde texto o se llega a maxSteps.
 * Con Ollama decide el modelo; en modo simulado decide `planner({ done, tools })`, que devuelve
 * { tool, args } (pedir una herramienta) o { reply } (terminar).
 */
export async function runAgent({ messages, tools, maxSteps, planner, ollama, readOnly = false, approval = false, numPredict }) {
  const audit = [], usage = { calls: 0, tokensIn: 0, tokensOut: 0 };
  const done = (reply, extra = {}) => ({ reply, audit, usage, ...extra });

  while (usage.calls < maxSteps) {
    usage.calls++;
    let msg, tokensIn, tokensOut;
    if (ollama) {
      ({ message: msg, tokensIn, tokensOut } = await chat(messages, { tools: ollamaTools(tools), numPredict }));
    } else {
      const s = planner({ done: audit, tools });
      msg = s.reply != null ? { role: 'assistant', content: s.reply }
        : { role: 'assistant', content: '', tool_calls: [{ function: { name: s.tool, arguments: s.args } }] };
    }
    // Cada vuelta reenvía TODO el historial: el costo crece con cada paso
    usage.tokensIn += tokensIn ?? estTokens(messages.map(m => m.content).join('\n'));
    usage.tokensOut += tokensOut ?? estTokens(msg.content + JSON.stringify(msg.tool_calls || ''));
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) return done(msg.content);

    for (const c of calls) {
      const name = c.function.name;
      let args = c.function.arguments || {};
      if (typeof args === 'string') try { args = JSON.parse(args); } catch { args = {}; }

      if (approval && isDestructive(name, args)) {
        const id = randomUUID().slice(0, 8);
        PENDING.set(id, { tool: name, args, readOnly, allowed: tools });
        audit.push({ tool: name, args, destructive: true, status: 'pendiente', result: 'Esperando aprobación humana', ms: 0, pendingId: id });
        vlog(`⏸️  ${name}(${JSON.stringify(args)}) frenada: espera aprobación humana [${id}]`, C.yellow);
        return done(`⏸️ Para seguir necesito que una persona apruebe esta acción: ${name}(${JSON.stringify(args)})`, { pendingId: id });
      }
      const entry = execTool(name, args, { readOnly, allowed: tools });
      audit.push(entry);
      messages.push({ role: 'tool', tool_name: name, content: String(entry.result) });
    }
  }
  vlog(`⛔ Límite de ${maxSteps} pasos alcanzado`, C.red);
  return done(`⛔ Se cortó el agente: llegó al límite de ${maxSteps} pasos.`, { stoppedByLimit: true });
}

// La persona decide. Si aprueba, la acción se ejecuta con los mismos permisos que tenía el agente.
export function resolvePending(id, approve) {
  const p = PENDING.get(id);
  if (!p) return null;
  PENDING.delete(id);
  if (!approve) {
    vlog(`🚫 ${p.tool} rechazada por una persona [${id}]`, C.green);
    return { tool: p.tool, args: p.args, destructive: true, status: 'rechazada', result: 'Rechazada por una persona', ms: 0 };
  }
  vlog(`✅ ${p.tool} aprobada por una persona [${id}]`, C.yellow);
  return execTool(p.tool, p.args, { readOnly: p.readOnly, allowed: p.allowed });
}
