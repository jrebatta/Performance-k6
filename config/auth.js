import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PATHS } from './environment.js';

const AUTH_EMAIL = 'fulano@qa.com';
const AUTH_PASSWORD = 'teste';

export function getAuthToken() {
  console.log('Obteniendo token de autenticación...');

  const res = http.post(
    `${BASE_URL}${PATHS.login}`,
    JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      tags: { name: 'auth_setup', exclude_from_metrics: 'true' },
    }
  );

  const ok = check(res, { 'Login exitoso (200)': r => r.status === 200 });
  if (!ok) throw new Error(`Login fallido: ${res.status} - ${res.body}`);

  const { authorization } = JSON.parse(res.body);
  console.log('Token obtenido exitosamente');
  return authorization;
}
