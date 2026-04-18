#!/usr/bin/env node

import { generateConformityPDF } from '../config/pdf-generator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

function findLatestTestFile() {
  const jsonDir = path.join(PROJECT_ROOT, 'results', 'json');
  if (!fs.existsSync(jsonDir)) {
    console.error('No se encuentra el directorio results/json');
    return null;
  }

  const files = fs.readdirSync(jsonDir)
    .filter(f => f.endsWith('_pdf.json'))
    .map(f => ({ name: f, path: path.join(jsonDir, f), time: fs.statSync(path.join(jsonDir, f)).mtime }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 ? files[0] : null;
}

async function main() {
  try {
    console.log('Esperando 5 segundos para que los archivos se escriban...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Buscando archivo de resultados más reciente...');
    const latest = findLatestTestFile();

    if (!latest) {
      console.error('No se encontraron archivos _pdf.json en results/json');
      process.exit(1);
    }

    console.log(`Procesando: ${latest.name}`);
    const data = JSON.parse(fs.readFileSync(latest.path, 'utf8'));

    const result = await generateConformityPDF(data, data.testName || data.testType || 'unknown', data.testConfig || {});

    if (result.success) {
      console.log(`PDF generado: ${result.pdfPath}`);
      if (result.conformity.isConform) {
        console.log('CONFORMIDAD OTORGADA - Las pruebas cumplen con los lineamientos');
      } else {
        console.log(`NO CONFORMIDAD - ${result.conformity.issues.length} problema(s) detectado(s):`);
        result.conformity.issues.forEach(i => console.log(`  • ${i.metric}: ${i.value} (umbral: ${i.threshold})`));
      }
      fs.unlinkSync(latest.path);
    } else {
      console.error('Error generando PDF:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error fatal:', err.message);
    process.exit(1);
  }
}

main();
