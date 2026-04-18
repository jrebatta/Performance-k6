import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

function evaluateConformity(data) {
  const metrics = data.metrics;
  const result = { isConform: true, issues: [], passedChecks: [], overallStatus: 'CONFORME' };

  const httpDuration = metrics.http_req_duration;
  if (httpDuration?.values) {
    const avg = httpDuration.values.avg;
    const p95 = httpDuration.values['p(95)'];

    if (avg > 2000) {
      result.isConform = false;
      result.issues.push({ metric: 'Tiempo Promedio', value: `${avg.toFixed(2)}ms`, threshold: '< 2000ms', status: 'NO CONFORME' });
    } else {
      result.passedChecks.push({ metric: 'Tiempo Promedio', value: `${avg.toFixed(2)}ms`, threshold: '< 2000ms', status: 'CONFORME' });
    }

    if (p95 > 3000) {
      result.isConform = false;
      result.issues.push({ metric: 'Tiempo P95', value: `${p95.toFixed(2)}ms`, threshold: '< 3000ms', status: 'NO CONFORME' });
    } else {
      result.passedChecks.push({ metric: 'Tiempo P95', value: `${p95.toFixed(2)}ms`, threshold: '< 3000ms', status: 'CONFORME' });
    }
  }

  const httpFailed = metrics.http_req_failed;
  if (httpFailed?.values) {
    const failRate = httpFailed.values.rate * 100;
    if (failRate > 1) {
      result.isConform = false;
      result.issues.push({ metric: 'Tasa de Errores', value: `${failRate.toFixed(2)}%`, threshold: '< 1%', status: 'NO CONFORME' });
    } else {
      result.passedChecks.push({ metric: 'Tasa de Errores', value: `${failRate.toFixed(2)}%`, threshold: '< 1%', status: 'CONFORME' });
    }
  }

  const checks = metrics.checks;
  if (checks?.values) {
    const fails = checks.values.fails || 0;
    if (fails > 0) {
      result.isConform = false;
      result.issues.push({ metric: 'Validaciones Funcionales', value: `${fails} fallos`, threshold: '0 fallos', status: 'NO CONFORME' });
    } else {
      result.passedChecks.push({ metric: 'Validaciones Funcionales', value: '0 fallos', threshold: '0 fallos', status: 'CONFORME' });
    }
  }

  result.overallStatus = result.isConform ? 'CONFORME' : 'NO CONFORME';
  return result;
}

function buildHTML(data, testConfig, conformity, testName) {
  const displayName = testConfig.name || testName.replace(/_/g, ' ').toUpperCase();
  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const color = conformity.isConform ? '#2f855a' : '#c53030';
  const bgColor = conformity.isConform ? '#c6f6d5' : '#fed7d7';

  const totalFunctional = data.metrics.http_reqs?.values?.count || 0;
  const httpSuccesses = data.metrics.http_req_failed?.values?.fails || 0;
  const httpFailures = data.metrics.http_req_failed?.values?.passes || 0;

  const metricsRows = [...conformity.passedChecks, ...conformity.issues].map(c => `
    <tr>
      <td>${c.metric}</td>
      <td>${c.value}</td>
      <td>${c.threshold}</td>
      <td style="color:${c.status === 'CONFORME' ? '#2f855a' : '#c53030'};font-weight:bold">${c.status}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Conformidad - ServeRest Performance</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #2c5282; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2c5282; font-size: 24px; margin: 0; }
    .header h2 { color: #4a5568; font-size: 16px; margin: 8px 0 0; }
    .badge { display: inline-block; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;
             background: ${bgColor}; color: ${color}; border: 2px solid ${color}; margin: 16px 0; }
    .highlight { background: ${bgColor}; border: 2px solid ${color}; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .section h3 { color: #2c5282; border-left: 4px solid #2c5282; padding-left: 10px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
    th { background: #edf2f7; font-weight: bold; color: #2c5282; }
    .info-grid { display: flex; gap: 40px; margin: 20px 0; }
    .info-grid div { flex: 1; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #718096;
               border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>REPORTE DE CONFORMIDAD</h1>
    <h2>Pruebas de Performance — API ServeRest</h2>
  </div>

  <div class="info-grid">
    <div>
      <strong>Escenario:</strong> ${displayName}<br>
      <strong>Endpoint:</strong> ${data.endpointConfig?.name || 'N/A'} (${data.endpointConfig?.method || 'N/A'})<br>
      <strong>Fecha:</strong> ${dateStr}
    </div>
    <div>
      <strong>VUs máximos:</strong> ${data.metrics.vus?.values?.max || 'N/A'}<br>
      <strong>Iteraciones:</strong> ${data.metrics.iterations?.values?.count || 'N/A'}<br>
      <strong>Total Requests:</strong> ${totalFunctional}<br>
      <strong>Duración total:</strong> ${((data.state?.testRunDurationMs || 0) / 1000).toFixed(1)}s
    </div>
  </div>

  <div class="highlight">
    <div class="badge">RESULTADO: ${conformity.overallStatus}</div>
    <p>${conformity.isConform
      ? '<strong>CONFORMIDAD OTORGADA:</strong> Los tiempos de respuesta y tasas de error cumplen con los lineamientos establecidos.'
      : `<strong>NO CONFORMIDAD:</strong> Se detectaron ${conformity.issues.length} problema(s) que superan los umbrales aceptables.`
    }</p>
  </div>

  <div class="section">
    <h3>Evaluación de Lineamientos</h3>
    <table>
      <thead><tr><th>Métrica</th><th>Valor Obtenido</th><th>Umbral</th><th>Estado</th></tr></thead>
      <tbody>${metricsRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h3>Métricas Detalladas</h3>
    <table>
      <thead><tr><th>Métrica</th><th>Promedio</th><th>Mínimo</th><th>P95</th><th>Máximo</th></tr></thead>
      <tbody>
        <tr>
          <td>Duración HTTP (ms)</td>
          <td>${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_duration?.values?.min?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_duration?.values?.max?.toFixed(2) || 'N/A'}</td>
        </tr>
        <tr>
          <td>Tiempo Conexión (ms)</td>
          <td>${data.metrics.http_req_connecting?.values?.avg?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_connecting?.values?.min?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_connecting?.values?.['p(95)']?.toFixed(2) || 'N/A'}</td>
          <td>${data.metrics.http_req_connecting?.values?.max?.toFixed(2) || 'N/A'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Validaciones Funcionales</h3>
    <table>
      <thead><tr><th>Validación</th><th>Éxitos</th><th>Fallos</th><th>% Éxito</th></tr></thead>
      <tbody>
        <tr>
          <td>Checks totales</td>
          <td>${data.metrics.checks?.values?.passes || 0}</td>
          <td>${data.metrics.checks?.values?.fails || 0}</td>
          <td>${((data.metrics.checks?.values?.rate || 1) * 100).toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Requests HTTP</td>
          <td>${httpSuccesses}</td>
          <td>${httpFailures}</td>
          <td>${((1 - (data.metrics.http_req_failed?.values?.rate || 0)) * 100).toFixed(2)}%</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${!conformity.isConform ? `
  <div class="section">
    <h3>Observaciones y Recomendaciones</h3>
    <ul>
      ${conformity.issues.map(i => `<li><strong>${i.metric}:</strong> ${i.value} excede el umbral (${i.threshold}).</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="footer">
    <p>Reporte generado automáticamente — K6 Performance Testing Suite | ServeRest</p>
    <p>${dateStr}</p>
  </div>
</body>
</html>`;
}

export async function generateConformityPDF(data, testName, testConfig) {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const conformity = evaluateConformity(data);

    console.log('Generando reporte PDF...');
    const html = buildHTML(data, testConfig, conformity, testName);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdfDir = path.join(PROJECT_ROOT, 'results', 'pdf');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const pdfPath = path.join(pdfDir, `${testName}_${timestamp}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
    await browser.close();

    console.log(`PDF generado: ${pdfPath} | Estado: ${conformity.overallStatus}`);
    return { pdfPath, conformity, success: true };
  } catch (error) {
    console.error('Error generando PDF:', error.message);
    return { success: false, error: error.message };
  }
}
