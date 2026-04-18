import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { buildHeaders } from '../config/headers.js';
import { randomName, randomEmail, randomPassword } from '../utils/generator.js';

const template = open('../requests/put-usuarios.json');

export function putUsuario(token, userId) {
  if (!userId) {
    console.error('putUsuario: userId requerido. Verifica que existan usuarios en la API.');
    return null;
  }

  const payload = template
    .replace('{{NOME}}', randomName())
    .replace('{{EMAIL}}', randomEmail())
    .replace('{{PASSWORD}}', randomPassword());

  const res = http.put(
    `${BASE_URL}/usuarios/${userId}`,
    payload,
    { headers: buildHeaders(token), tags: { endpoint: 'put-usuarios' } }
  );

  check(res, {
    'Status 200': r => r.status === 200,
    'Registro actualizado': r => { try { return !!JSON.parse(r.body).message; } catch { return false; } },
    'Tiempo < 3s': r => r.timings.duration < 3000,
  });

  if (res.status !== 200) {
    console.error(`PUT /usuarios/${userId} [${res.status}]: ${res.body}`);
  }

  return res;
}
