# ServeRest — Suite de Pruebas de Performance con K6

Suite de pruebas de rendimiento parametrizables para la API [ServeRest](https://serverest.dev), construida con **K6**. Soporta pruebas de carga y estrés sobre cualquier endpoint, con generación automática de reportes HTML, JSON y PDF de conformidad.

---

## Estructura del proyecto

```
.github/workflows/
  load-test.yml          → Workflow de carga (GitHub Actions)
  stress-test.yml        → Workflow de estrés (GitHub Actions)

config/
  environment.js         → BASE_URL y rutas de la API (única fuente de verdad)
  auth.js                → Obtención del token Bearer (se ejecuta 1 sola vez por prueba)
  headers.js             → Construcción de headers reutilizables
  pdf-generator.js       → Generación del reporte PDF de conformidad

endpoints/
  get-usuarios.js        → GET /usuarios
  post-usuarios.js       → POST /usuarios
  put-usuarios.js        → PUT /usuarios/{id}

requests/
  post-usuarios.json     → Body template para POST (con placeholders)
  put-usuarios.json      → Body template para PUT (con placeholders)

tests/
  load-test.js           → Prueba de carga parametrizable
  stress-test.js         → Prueba de estrés parametrizable

utils/
  generator.js           → Generador de datos aleatorios (nombre, email, password)

scripts/
  generate-pdf.js        → Script Node.js que genera el PDF post-ejecución

results/
  html/                  → Reportes HTML interactivos (ignorados en git)
  json/                  → Resultados JSON completos (ignorados en git)
  pdf/                   → Reportes PDF de conformidad (ignorados en git)
```

---

## Carpetas y archivos explicados

### `config/`

| Archivo | Responsabilidad |
|---------|----------------|
| `environment.js` | Define `BASE_URL = 'https://serverest.dev'` y los paths (`/login`, `/usuarios`). Todo el proyecto lee de aquí — si la URL cambia, se edita en un solo lugar. |
| `auth.js` | Hace POST a `/login` una sola vez en el `setup()` y devuelve el token Bearer. El request se tagea como `auth_setup` para excluirlo de las métricas funcionales. |
| `headers.js` | Función `buildHeaders(token)` que retorna los headers comunes con el token. |
| `pdf-generator.js` | Genera el PDF de conformidad usando Puppeteer. Evalúa si el test cumple los lineamientos (avg < 2000ms, P95 < 3000ms, error rate < 1%) y emite CONFORME o NO CONFORME. |

### `endpoints/`

Cada archivo representa un endpoint de la API. Importa `environment.js`, `headers.js` y `utils/generator.js`, ejecuta el request y valida la respuesta con `check()`.

| Archivo | Método | URL |
|---------|--------|-----|
| `get-usuarios.js` | GET | `/usuarios` |
| `post-usuarios.js` | POST | `/usuarios` |
| `put-usuarios.js` | PUT | `/usuarios/{id}` |

### `requests/`

Templates JSON con placeholders (`{{NOME}}`, `{{EMAIL}}`, `{{PASSWORD}}`) para los endpoints que tienen body. El endpoint los carga con `open()` al inicio y reemplaza los valores en cada iteración.

Solo POST y PUT tienen body — GET no necesita archivo aquí.

### `tests/`

Contienen la lógica principal de K6. Leen los parámetros desde `--env`, ejecutan el endpoint seleccionado en cada iteración y generan los reportes en `handleSummary`.

| Archivo | Tipo |
|---------|------|
| `load-test.js` | Carga constante: VUs fijos durante una duración |
| `stress-test.js` | Estrés por etapas: calentamiento → incremento → pico → descenso |

### `utils/`

| Archivo | Responsabilidad |
|---------|----------------|
| `generator.js` | Genera datos aleatorios compatibles con K6 (sin dependencias externas). Provee `randomName()`, `randomEmail()` y `randomPassword()`. Los emails incluyen `__VU` y `Date.now()` para garantizar unicidad entre VUs y ejecuciones. |

---

## Instalación

```bash
cd API-ServeRest-Performance
npm install
```

> Requiere [K6](https://k6.io/docs/get-started/installation/) instalado globalmente.

---

## Ejecución local

### Prueba de carga

```bash
k6 run \
  --env ENDPOINT=post-usuarios \
  --env VUS=10 \
  --env DURATION=120 \
  --env DELAY=2000 \
  tests/load-test.js ; npm run generate-pdf
```

| Parámetro | Descripción | Default |
|-----------|-------------|---------|
| `ENDPOINT` | Endpoint a probar | `post-usuarios` |
| `VUS` | Usuarios virtuales | `10` |
| `DURATION` | Duración en segundos | `120` |
| `DELAY` | Delay entre peticiones (ms) | `2000` |

### Prueba de estrés

```bash
k6 run \
  --env ENDPOINT=post-usuarios \
  --env VUS_1=3 \
  --env VUS_2=6 \
  --env VUS_3=9 \
  --env VUS_4=6 \
  --env STAGE_DURATION=60 \
  --env DELAY=4000 \
  tests/stress-test.js ; npm run generate-pdf
```

| Parámetro | Descripción | Default |
|-----------|-------------|---------|
| `ENDPOINT` | Endpoint a probar | `post-usuarios` |
| `VUS_1` | VUs Etapa 1 — Calentamiento | `3` |
| `VUS_2` | VUs Etapa 2 — Incremento | `6` |
| `VUS_3` | VUs Etapa 3 — Pico | `9` |
| `VUS_4` | VUs Etapa 4 — Descenso | `6` |
| `STAGE_DURATION` | Duración por etapa (segundos) | `60` |
| `DELAY` | Delay entre peticiones (ms) | `4000` |

### Endpoints disponibles

| Valor `ENDPOINT` | Método | URL |
|-----------------|--------|-----|
| `post-usuarios` | POST | `/usuarios` |
| `get-usuarios` | GET | `/usuarios` |
| `put-usuarios` | PUT | `/usuarios/{id}` |

### Scripts rápidos (valores por defecto)

```bash
npm run test:load:post    # POST /usuarios — carga
npm run test:load:get     # GET  /usuarios — carga
npm run test:load:put     # PUT  /usuarios — carga

npm run test:stress:post  # POST /usuarios — estrés
npm run test:stress:get   # GET  /usuarios — estrés
npm run test:stress:put   # PUT  /usuarios — estrés

npm run clean:results     # Limpia todos los resultados generados
```

---

## Reportes generados

Después de cada ejecución se generan 3 archivos en `results/`:

```
results/html/load_post-usuarios_2025-04-18T14-30-00.html   → Reporte interactivo
results/json/load_post-usuarios_2025-04-18T14-30-00.json   → Datos completos
results/pdf/load_post-usuarios_2025-04-18T14-30-00.pdf     → Conformidad ejecutiva
```

El nombre incluye siempre el **tipo de prueba + endpoint + fecha y hora**.

### Criterios de conformidad (PDF)

| Métrica | Umbral |
|---------|--------|
| Tiempo promedio | < 2000ms |
| Tiempo P95 | < 3000ms |
| Tasa de errores | < 1% |
| Checks fallidos | 0 |

---

## Cómo agregar un nuevo endpoint

Solo son **3 pasos simples**:

### 1. Crear el endpoint en `endpoints/`

```js
// endpoints/delete-usuarios.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { buildHeaders } from '../config/headers.js';

export function deleteUsuario(token, userId) {
  const res = http.del(
    `${BASE_URL}/usuarios/${userId}`,
    null,
    { headers: buildHeaders(token), tags: { endpoint: 'delete-usuarios' } }
  );

  check(res, {
    'Status 200': r => r.status === 200,
    'Tiempo < 3s': r => r.timings.duration < 3000,
  });

  return res;
}
```

> Si el endpoint tiene body (POST, PUT), también crea `requests/delete-usuarios.json` con los placeholders que necesites.

### 2. Agregar el import y el case en ambos test files

En `tests/load-test.js` y `tests/stress-test.js`:

```js
// Arriba, junto a los otros imports
import { deleteUsuario } from '../endpoints/delete-usuarios.js';

// Dentro del switch en export default function
case 'delete-usuarios': deleteUsuario(data.token, data.userId); break;
```

### 3. Agregarlo como opción en los workflows (opcional)

En `.github/workflows/load-test.yml` y `stress-test.yml`, agregar la opción al input `ENDPOINT`:

```yaml
options:
  - post-usuarios
  - get-usuarios
  - put-usuarios
  - delete-usuarios   # ← nueva línea
```

Eso es todo. La autenticación, headers, reportes HTML, JSON y PDF ya están resueltos.

---

## GitHub Actions Workflows

Los workflows se ejecutan manualmente desde la pestaña **Actions** del repositorio en GitHub.

### Cómo ejecutarlos

1. Ir a **Actions** → seleccionar el workflow (**Load Test** o **Stress Test**)
2. Hacer clic en **Run workflow**
3. Completar los parámetros en el formulario
4. Hacer clic en **Run workflow**

### Load Test (`load-test.yml`)

Ejecuta una prueba de carga con VUs constantes durante una duración definida.

**Inputs del formulario:**

| Input | Descripción | Default |
|-------|-------------|---------|
| ENDPOINT | Endpoint a probar (dropdown) | `put-usuarios` |
| VUS | Usuarios virtuales | `2` |
| DURATION | Duración en segundos | `10` |
| DELAY | Delay entre peticiones (ms) | `2000` |

### Stress Test (`stress-test.yml`)

Ejecuta una prueba de estrés escalando VUs en 4 etapas + enfriamiento.

**Inputs del formulario:**

| Input | Descripción | Default |
|-------|-------------|---------|
| ENDPOINT | Endpoint a probar (dropdown) | `post-usuarios` |
| VUS_1 | VUs Etapa 1 — Calentamiento | `3` |
| VUS_2 | VUs Etapa 2 — Incremento | `6` |
| VUS_3 | VUs Etapa 3 — Pico | `9` |
| VUS_4 | VUs Etapa 4 — Descenso | `6` |
| STAGE_DURATION | Duración por etapa (segundos) | `10` |
| DELAY | Delay entre peticiones (ms) | `4000` |

### Qué produce cada workflow

Al finalizar, en la pestaña **Summary** del run se muestra:

- Configuración exacta con la que se ejecutó el test
- Métricas principales (requests, tiempos, errores)
- Resultado de conformidad: **CONFORME** o **NO CONFORME**

En la sección **Artifacts** se descargan los 3 reportes generados:

| Artefacto | Contenido |
|-----------|-----------|
| `html-report` | Reporte interactivo con gráficas |
| `json-report` | Datos completos de la ejecución |
| `pdf-report` | Reporte ejecutivo de conformidad |

> El workflow sigue hasta generar el PDF y el summary incluso si K6 detecta thresholds cruzados, para que siempre quede evidencia del resultado.
