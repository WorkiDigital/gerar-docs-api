const express = require('express');
const axios = require('axios');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '10mb';

app.use(express.json({ limit: MAX_BODY_SIZE }));

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();

  const receivedKey = req.headers['x-api-key'];

  if (receivedKey !== API_KEY) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'X-API-Key ausente ou inválida.'
    });
  }

  return next();
}

function sanitizeFileName(fileName) {
  return String(fileName || 'contrato.docx')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function downloadTemplate(templateUrl) {
  if (!templateUrl || !/^https?:\/\//i.test(templateUrl)) {
    throw new Error('templateUrl deve começar com http ou https.');
  }

  const response = await axios.get(templateUrl, {
    responseType: 'arraybuffer',
    timeout: Number(process.env.DOWNLOAD_TIMEOUT_MS || 60000),
    maxContentLength: Number(process.env.MAX_TEMPLATE_BYTES || 25 * 1024 * 1024)
  });

  return Buffer.from(response.data);
}

function renderDocx(templateBuffer, variables) {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });

  doc.render(variables || {});

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
}

async function convertDocxToPdf(docxBuffer, fileName) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contract-render-'));
  const docxPath = path.join(tmpDir, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
  const pdfPath = docxPath.replace(/\.docx$/i, '.pdf');

  await fs.writeFile(docxPath, docxBuffer);

  try {
    await new Promise((resolve, reject) => {
      execFile(
        'libreoffice',
        ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, docxPath],
        { timeout: Number(process.env.CONVERT_TIMEOUT_MS || 120000) },
        (error, stdout, stderr) => {
          if (error) {
            return reject(new Error(`Erro ao converter PDF. Verifique se LibreOffice está instalado. ${stderr || stdout || error.message}`));
          }
          return resolve();
        }
      );
    });

    return await fs.readFile(pdfPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'contract-render-api',
    output: ['docx', 'pdf']
  });
});

app.post('/render-contract', requireApiKey, async (req, res) => {
  try {
    const {
      templateUrl,
      variables = {},
      output = 'pdf',
      fileName = 'contrato.pdf'
    } = req.body || {};

    const normalizedOutput = String(output).toLowerCase();

    if (!['docx', 'pdf'].includes(normalizedOutput)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid output',
        message: 'output deve ser docx ou pdf.'
      });
    }

    const templateBuffer = await downloadTemplate(templateUrl);
    const renderedDocx = renderDocx(templateBuffer, variables);

    if (normalizedOutput === 'docx') {
      const finalName = sanitizeFileName(fileName).replace(/\.pdf$/i, '.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${finalName}"`);
      return res.send(renderedDocx);
    }

    const finalName = sanitizeFileName(fileName).replace(/\.docx$/i, '.pdf');
    const pdfBuffer = await convertDocxToPdf(renderedDocx, finalName.replace(/\.pdf$/i, '.docx'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${finalName}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: 'Render failed',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Contract Render API rodando na porta ${PORT}`);
});
