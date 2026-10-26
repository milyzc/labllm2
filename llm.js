import './env.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
export const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const FORCE_MOCK = process.env.FORCE_MOCK === '1';

export async function ollamaStatus() {
  if (FORCE_MOCK) return { up: false, model: MODEL, forced: true };
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return { up: true, model: MODEL, hasModel: (j.models || []).some(x => x.name === MODEL || x.name.startsWith(MODEL.split(':')[0])) };
  } catch { return { up: false, model: MODEL }; }
}

export const useOllama = async () => { const s = await ollamaStatus(); return s.up && s.hasModel; };

// Una llamada al modelo. Devuelve el mensaje (con tool_calls si los hay) y los tokens reportados.
export async function chat(messages, { tools, numPredict = 4096 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 120_000);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ model: MODEL, messages, tools, stream: false, options: { temperature: 0.2, num_predict: numPredict } })
    });
    if (!r.ok) throw new Error('ollama ' + r.status);
    const j = await r.json();
    return { message: j.message, tokensIn: j.prompt_eval_count, tokensOut: j.eval_count };
  } finally { clearTimeout(t); }
}

// Estimación grosera (~4 caracteres por token) para el modo simulado
export const estTokens = text => Math.ceil(String(text || '').length / 4);
