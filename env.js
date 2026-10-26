// Carga labllm2/.env (sin dependencias). No pisa variables ya definidas en el entorno.
// Debe importarse primero: los demás módulos leen process.env al cargarse.
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch (e) {
  if (e.code !== 'ENOENT') console.warn('No pude leer .env:', e.message);
}
