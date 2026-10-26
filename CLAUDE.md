# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A deliberately vulnerable local lab for a security training course (OWASP LLM06 excessive agency, LLM07 system prompt leakage, LLM10 unbounded consumption). Sibling of `../labllm` (LLM01/02/05/09), which shares its structure and must not be modified from here. The vulnerabilities, the intentionally bypassable defenses (e.g. canary detector, "minimal tools") and the planted instructions in `data.js` (ticket 42) are the product — do not "fix" them unless asked. The server binds to `127.0.0.1`; keep it that way.

UI text, prompts, logs and code comments are in Rioplatense Spanish; keep that style.

## Commands
- `node server.js` (or `npm start`) — http://127.0.0.1:3001
- `node test.js` (or `npm test`) — smoke test in mock mode, in-memory DB. Plain `node:assert` script, no framework and no single-test filter.
- Reset data: "♻️ Restaurar" in the UI, `POST /api/reset {"what":"prod"}`, or delete `lab2.db`.

Node 22.5+, zero npm dependencies (only `node:` built-ins). `env.js` must be the first import of every module (modules read `process.env` at load time). `env.js` and `log.js` are copies of the ones in `labllm`.

## Architecture
- `server.js` — bare `node:http`. Routes: `GET /`, `GET /api/status`, `POST /api/chat` `{scenario, message, defenses, session}`, `POST /api/approve` `{id, ok}`, `POST /api/reset` `{what: 'prod'|'meter', session}`.
- `lab.js` — one function per scenario (`ops`, `ventas`, `consumo`) dispatched by `respond()`. Each returns `{reply, messages, flags, ...}`; `flags` is the lab's "attacker win" detection and drives the UI. If Ollama fails mid-request, `respond()` reruns the scenario in mock mode.
- `agent.js` — tool-calling loop shared by LLM06 and the LLM10 runaway agent. With Ollama the model picks tools; in mock mode a `planner({done, tools})` closure returns `{tool, args}` or `{reply}`. Human approval parks destructive calls in an in-memory `PENDING` map until `/api/approve`.
- `tools.js` — agent tools over the "production" tables. `isDestructive()` judges by effect (SQL verbs), not tool name — that is why `consultar` (accepts any SQL) still lets the agent write when "minimal tools" is on.
- `db.js` — SQLite. Read-only credential is simulated with `PRAGMA query_only` around tool execution (`withReadOnly`). `prodState()`/`damage()` compare tables against the seed to compute damage.
- `llm.js` — Ollama client (`/api/chat` with `tools`, `num_predict`) and `estTokens` (~4 chars/token) used for cost in mock mode.
- `public/index.html` — single-file vanilla UI; scenario definitions (goal, chips, defenses, "why" text with a non-technical analogy) live in the `SC` object.

LLM10 state (cost meter, rate-limit timestamps) is per `session` id in an in-memory `Map`; prices, budget and limits are constants at the top of the LLM10 section in `lab.js`.

When adding a scenario or defense, update together: the scenario function and its mock in `lab.js`, flags, the `SC` entry and `showFlags()` in `index.html`, a case in `test.js`, and the README table.
