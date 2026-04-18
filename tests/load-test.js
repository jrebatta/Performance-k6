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
// ENDPOINT      : endpoint a probar  (post-usuarios | get-usuarios | put-usuarios)  default: post-usuarios
// VUS           : usuarios virtuales                                                 default: 10
// DURATION      : duración en segundos                                               default: 120
// DELAY         : delay entre peticiones en ms                                       default: 2000
// ──────────────────────────────────────────────────────────────────────────────

const ENDPOINT       = __ENV.ENDPOINT  || 'post-usuarios';
const VUS            = parseInt(__ENV.VUS       || '10');
const DURATION_S     = parseInt(__ENV.DURATION  || '120');
const DELAY_S        = parseInt(__ENV.DELAY     || '2000') / 1000;

export const options = {
  vus: VUS,
  duration: `${DURATION_S}s`,
  thresholds: {
    http_req_duration: ['p(95)<3000', 'avg<2000'],
    http_req_failed: ['rate<0.01'],
  },
  setupTimeout: '60s',
};

export function setup() {
  console.log('=== PRUEBA DE CARGA ===');
  console.log(`Endpoint : ${ENDPOINT}`);
  console.log(`VUs      : ${VUS}`);
  console.log(`Duración : ${DURATION_S}s`);
  console.log(`Delay    : ${DELAY_S * 1000}ms`);

  const token = getAuthToken();
  let userId = null;

  if (ENDPOINT === 'put-usuarios') {
    const res = http.get(`${BASE_URL}${PATHS.usuarios}`, {
      headers: buildHeaders(token),
      tags: { name: 'setup_get_userid', exclude_from_metrics: 'true' },
    });
    const body = JSON.parse(res.body);
    if (!body.usuarios || body.usuarios.length === 0) {
      throw new Error('No hay usuarios existentes. Ejecuta test:load:post primero para crear datos.');
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
  const testName = `load_${ENDPOINT}`;
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
    testType: 'LOAD_TEST',
    testConfig: {
      name: `Carga - ${ENDPOINT}`,
      vus: VUS,
      duration: `${DURATION_S}s`,
      delay: `${DELAY_S * 1000}ms`,
    },
    endpointType: ENDPOINT,
    endpointConfig: {
      name: ENDPOINT,
      method: ENDPOINT.startsWith('post') ? 'POST' : ENDPOINT.startsWith('get') ? 'GET' : 'PUT',
      description: `Prueba de carga sobre ${ENDPOINT}`,
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
