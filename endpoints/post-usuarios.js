import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PATHS } from '../config/environment.js';
import { buildHeaders } from '../config/headers.js';
import { randomName, randomEmail, randomPassword } from '../utils/generator.js';

const template = open('../requests/post-usuarios.json');

export function postUsuario(token) {
  const payload = template
    .replace('{{NOME}}', randomName())
    .replace('{{EMAIL}}', randomEmail())
    .replace('{{PASSWORD}}', randomPassword());

  const res = http.post(
    `${BASE_URL}${PATHS.usuarios}`,
    payload,
    { headers: buildHeaders(token), tags: { endpoint: 'post-usuarios' } }
  );

  check(res, {
    'Status 201': r => r.status === 201,
    'Retorna _id': r => { try { return !!JSON.parse(r.body)._id; } catch { return false; } },
    'Tiempo < 3s': r => r.timings.duration < 3000,
  });

  if (res.status !== 201) {
    console.error(`POST /usuarios [${res.status}]: ${res.body}`);
  }

  return res;
}
