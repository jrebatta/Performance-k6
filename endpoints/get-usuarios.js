import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PATHS } from '../config/environment.js';
import { buildHeaders } from '../config/headers.js';

export function getUsuarios(token) {
  const res = http.get(
    `${BASE_URL}${PATHS.usuarios}`,
    { headers: buildHeaders(token), tags: { endpoint: 'get-usuarios' } }
  );

  check(res, {
    'Status 200': r => r.status === 200,
    'Retorna quantidade': r => { try { return JSON.parse(r.body).quantidade !== undefined; } catch { return false; } },
    'Tiempo < 3s': r => r.timings.duration < 3000,
  });

  if (res.status !== 200) {
    console.error(`GET /usuarios [${res.status}]: ${res.body}`);
  }

  return res;
}
