# Lab LLM 2 · agentes, system prompts y consumo

App web local para atacar (y defender) asistentes con LLM. Es la práctica de la **Clase 2** (infra, configuración y casos reales) y del caso de la **Clase 3** "agente con acceso de administrador borra la base de producción". Cubre **LLM06** Agencia excesiva, **LLM07** Filtración del system prompt y **LLM10** Consumo sin límites. Complementa a `labllm` (LLM01, 02, 05, 09).

- Backend Node sin dependencias (`http` + `node:sqlite`). Requiere Node 22.5+.
- Datos en **SQLite** (`lab2.db`, se crea y siembra la primera vez). Tablas de "producción": `clientes`, `pedidos`, `logs`, `tickets`. El daño que hace el agente **persiste**; se repara con el botón **♻️ Restaurar** o borrando `lab2.db`.
- LLM: **Ollama** local, con tool calling para el agente. Si no está disponible, usa un **modo simulado** determinista que se deja engañar a propósito.
- Todo corre en `127.0.0.1`, puerto **3001** (convive con `labllm` en 3000). Datos y secretos 100% ficticios. **No lo expongas a la red**: es vulnerable a propósito.

## Uso

```bash
# (opcional) modelo real; tiene que soportar tools
ollama pull llama3.2:3b

node server.js          # http://127.0.0.1:3001
node test.js            # prueba de humo del modo simulado (DB en memoria)
```

Variables (de `labllm2/.env` o del entorno; el entorno tiene prioridad): `PORT`, `OLLAMA_URL`, `OLLAMA_MODEL` (default `llama3.2:3b`), `FORCE_MOCK=1`, `DB_PATH`, `VERBOSE=0` para silenciar.

Por consola se ve cada request con su **request-id**: el mensaje, cada llamada a herramienta (🔧, con `[solo lectura]` si aplica), las acciones frenadas (⏸️), el costo estimado (💲) y los flags.

Con un modelo real las respuestas varían y los ataques pueden no funcionar a la primera. El modo simulado es el predecible para dar clase.

## Escenarios

| Pestaña | Ataque | Defensas para probar |
|---|---|---|
| LLM06 | Pedido ambiguo ("liberá espacio") o ticket externo con instrucciones plantadas → el agente borra tablas de producción | Herramientas mínimas (no alcanza: escribe con `consultar`), usuario de base de solo lectura (la que funciona), confirmación humana |
| LLM07 | Pedir las instrucciones, traducirlas o deletrearlas; decir "soy VIP" para obtener 30% | Detector de canario (se esquiva deletreando), sacar secretos del prompt, autorización fuera del LLM |
| LLM10 | Salida gigante, documento enorme, agente en loop, ráfaga de pedidos | Límite de entrada, de salida, de pasos, rate limit, presupuesto por sesión |

Paneles extra: **Acciones ejecutadas** (auditoría de cada herramienta, sirve para el ejercicio de respuesta a incidentes), **Base de producción** (filas por tabla frente al original) y **Medidor de consumo** (tokens, costo simulado y proyección mensual).

## Para dar clase a público no técnico

Cada pestaña tiene en "Por qué pasa" una analogía sin tecnicismos. Lo recomendable es que el instructor corra el lab y lo proyecte, y que la gente proponga los ataques en voz alta. El chat no requiere saber programar.
