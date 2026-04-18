import http from 'k6/http';
import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import { BASE_URL, PATHS } from '../config/environment.js';
import { getAuthToken } from '../config/auth.js';
import { buildHeaders } from '../config/headers.js';
import { postUsuario } from '../endpoints/post-usuarios.js';
import { getUsuarios } from '../endpoints/get-usuarios.js';
import { putUsuario } from '../endpoints/put-usuarios.js';

// ─── Parámetros configurables via --env ───────────────────────────────────────
// ENDPOINT        : endpoint a probar  (post-usuarios | get-usuarios | put-usuarios)  default: post-usuarios
// VUS_1           : VUs Etapa 1 - Calentamiento                                        default: 3
// VUS_2           : VUs Etapa 2 - Incremento                                           default: 6
// VUS_3           : VUs Etapa 3 - Pico                                                 default: 9
// VUS_4           : VUs Etapa 4 - Descenso                                             default: 6
// STAGE_DURATION  : duración por etapa en segundos                                     default: 60
// DELAY           : delay entre peticiones en ms                                       default: 4000
// ──────────────────────────────────────────────────────────────────────────────

const ENDPOINT        = __ENV.ENDPOINT        || 'post-usuarios';
const VUS_1           = parseInt(__ENV.VUS_1           || '3');
const VUS_2           = parseInt(__ENV.VUS_2           || '6');
const VUS_3           = parseInt(__ENV.VUS_3           || '9');
const VUS_4           = parseInt(__ENV.VUS_4           || '6');
const STAGE_DURATION  = parseInt(__ENV.STAGE_DURATION  || '60');
const DELAY_S         = parseInt(__ENV.DELAY           || '4000') / 1000;

const STAGE_D = `${STAGE_DURATION}s`;

export const options = {
  stages: [
    { duration: STAGE_D, target: VUS_1 },  // Etapa 1: Calentamiento
    { duration: STAGE_D, target: VUS_2 },  // Etapa 2: Incremento
    { duration: STAGE_D, target: VUS_3 },  // Etapa 3: Pico
    { duration: STAGE_D, target: VUS_4 },  // Etapa 4: Descenso
    { duration: STAGE_D, target: 0 },       // Etapa 5: Enfriamiento
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000', 'avg<3000'],
    http_req_failed: ['rate<0.05'],
  },
  setupTimeout: '60s',
};

export function setup() {
  const totalDuration = STAGE_DURATION * 5;
  console.log('=== PRUEBA DE ESTRÉS ===');
  console.log(`Endpoint        : ${ENDPOINT}`);
  console.log(`Etapa 1 (Calentamiento) : ${VUS_1} VUs x ${STAGE_DURATION}s`);
  console.log(`Etapa 2 (Incremento)    : ${VUS_2} VUs x ${STAGE_DURATION}s`);
  console.log(`Etapa 3 (Pico)          : ${VUS_3} VUs x ${STAGE_DURATION}s`);
  console.log(`Etapa 4 (Descenso)      : ${VUS_4} VUs x ${STAGE_DURATION}s`);
  console.log(`Etapa 5 (Enfriamiento)  : 0 VUs x ${STAGE_DURATION}s`);
  console.log(`Duración total  : ~${totalDuration}s`);
  console.log(`Delay           : ${DELAY_S * 1000}ms`);

  const token = getAuthToken();
  let userId = null;

  if (ENDPOINT === 'put-usuarios') {
    const res = http.get(`${BASE_URL}${PATHS.usuarios}`, {
      headers: buildHeaders(token),
      tags: { name: 'setup_get_userid', exclude_from_metrics: 'true' },
    });
    const body = JSON.parse(res.body);
    if (!body.usuarios || body.usuarios.length === 0) {
      throw new Error('No hay usuarios existentes. Ejecuta test:stress:post primero para crear datos.');
    }
    userId = body.usuarios[0]._id;
    console.log(`userId para PUT: ${userId}`);
  }

  return { token, userId };
}

export default function (data) {
  switch (ENDPOINT) {
    case 'post-usuarios': postUsuario(data.token); break;
    case 'get-usuarios':  getUsuarios(data.token);  break;
    case 'put-usuarios':  putUsuario(data.token, data.userId); break;
    default:
      console.error(`Endpoint desconocido: "${ENDPOINT}". Valores válidos: post-usuarios | get-usuarios | put-usuarios`);
  }

  if (DELAY_S > 0) sleep(DELAY_S);
}

export function handleSummary(data) {
  const testName = `stress_${ENDPOINT}`;
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

  // Excluir el request de auth del conteo para HTML y PDF
  const filtered = JSON.parse(JSON.stringify(data));
  const authCount = filtered.metrics['http_reqs{name:auth_setup}']?.values?.count || 1;
  if (filtered.metrics.http_reqs) {
    filtered.metrics.http_reqs.values.count -= authCount;
    filtered.metrics.http_reqs.values.rate = filtered.metrics.http_reqs.values.count / (data.state.testRunDurationMs / 1000);
  }
  if (filtered.metrics.http_req_failed) {
    filtered.metrics.http_req_failed.values.fails -= authCount;
  }

  const pdfData = {
    ...filtered,
    testType: 'STRESS_TEST',
    testConfig: {
      name: `Estrés - ${ENDPOINT}`,
      stages: `${VUS_1}→${VUS_2}→${VUS_3}→${VUS_4}→0 VUs`,
      stageDuration: `${STAGE_DURATION}s por etapa`,
      delay: `${DELAY_S * 1000}ms`,
    },
    endpointType: ENDPOINT,
    endpointConfig: {
      name: ENDPOINT,
      method: ENDPOINT.startsWith('post') ? 'POST' : ENDPOINT.startsWith('get') ? 'GET' : 'PUT',
      description: `Prueba de estrés sobre ${ENDPOINT}`,
    },
    timestamp: ts,
    testName,
  };

  return {
    [`results/html/${testName}_${ts}.html`]: htmlReport(filtered),
    [`results/json/${testName}_${ts}.json`]: JSON.stringify(data, null, 2),
    [`results/json/${testName}_${ts}_pdf.json`]: JSON.stringify(pdfData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
