# Lab LLM 2 · agentes, system prompts y consumo

App web local para atacar (y defender) asistentes con LLM. Es la práctica de la **Clase 2** (infra, configuración y casos reales) y del caso de la **Clase 3** "agente con acceso de administrador borra la base de producción". Cubre **LLM06** Agencia excesiva, **LLM07** Filtración del system prompt, **LLM08** Debilidades de vectores y embeddings y **LLM10** Consumo sin límites, más **LLM03** Cadena de suministro y **LLM04** Envenenamiento de datos (del temario de la Clase 1). Complementa a `labllm` (LLM01, 02, 05, 09).

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
| LLM03 | Plugin de la comunidad sin versión fija: la actualización 1.1.0 manda datos del cliente afuera y su descripción hace que el asistente agregue un link de phishing | Versión fijada + hash, solo plugins aprobados (las dos funcionan), plugin sin red (frena el robo, no el phishing) |
| LLM04 | Mandar 20 correcciones falsas o 3 aportes con una frase disparadora ("código ZX9") y **Reentrenar** | Solo fuentes verificadas (la que funciona), detección de anomalías y pruebas antes de publicar (frenan el ataque masivo, no la puerta trasera) |
| LLM06 | Pedido ambiguo ("liberá espacio") o ticket externo con instrucciones plantadas → el agente borra tablas de producción | Herramientas mínimas (no alcanza: escribe con `consultar`), usuario de base de solo lectura (la que funciona), confirmación humana |
| LLM07 | Pedir las instrucciones, traducirlas o deletrearlas; decir "soy VIP" para obtener 30% | Detector de canario (se esquiva deletreando), sacar secretos del prompt, autorización fuera del LLM |
| LLM08 | Preguntar por sueldos: la búsqueda trae un documento de RR.HH.; preguntar por devoluciones: gana un documento de proveedor con texto oculto | Filtro por permisos en la búsqueda (funciona), "no reveles" en el prompt (se esquiva con "soy de RR.HH."), validar documentos al indexar |
| LLM10 | Salida gigante, documento enorme, agente en loop, ráfaga de pedidos | Límite de entrada, de salida, de pasos, rate limit, presupuesto por sesión |

Paneles extra: **Acciones ejecutadas** (auditoría de cada herramienta, sirve para el ejercicio de respuesta a incidentes), **Base de producción** (filas por tabla frente al original) y **Medidor de consumo** (tokens, costo simulado y proyección mensual). En LLM03, LLM04 y LLM08 la tabla de auditoría muestra, respectivamente, plugins y tráfico saliente, el reentrenamiento y los fragmentos recuperados con su similitud.

En LLM04 el modelo cambia recién después de **Reentrenar**; "Restaurar modelo" lo vuelve al original. Con Ollama no hay reentrenamiento real: los ejemplos aprendidos se pasan en el prompt. En LLM08 los "embeddings" son frecuencias de palabras con similitud coseno, suficiente para mostrar cómo se rankea.

## Para dar clase a público no técnico

Cada pestaña tiene en "Por qué pasa" una analogía sin tecnicismos. Lo recomendable es que el instructor corra el lab y lo proyecte, y que la gente proponga los ataques en voz alta. El chat no requiere saber programar.
