// Gera src/pdfjsBundle.js embutindo o pdf.js no app (leitura de PDF offline).
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const out =
  '// GERADO por scripts/build-pdfjs.js — não edite.\n' +
  `export const PDF_LIB = ${JSON.stringify(read('pdf.min.js'))};\n` +
  `export const PDF_WORKER = ${JSON.stringify(read('pdf.worker.min.js'))};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'pdfjsBundle.js'), out);
console.log('src/pdfjsBundle.js gerado');
