import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Multer for file uploads with limits and basic validation
const MAX_CERT_SIZE = 5 * 1024 * 1024; // 5 MB
function certFileFilter(req, file, cb) {
  const name = (file.originalname || '').toLowerCase();
  if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
    return cb(new Error('Apenas arquivos .pfx ou .p12 são aceitos'));
  }
  // basic mimetype checks (not fully reliable, but helps)
  const allowed = ['application/x-pkcs12', 'application/octet-stream', 'application/pkcs12'];
  if (file.mimetype && !allowed.includes(file.mimetype)) {
    // allow but warn (don't fail on mimetype alone)
    // cb(new Error('Mimetype inválido para certificado'));
  }
  cb(null, true);
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CERT_SIZE }, fileFilter: certFileFilter });

// Supabase service client (requires env vars)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// Simple envelope encryption using server key (set CERT_STORAGE_KEY in env)
const CERT_KEY = process.env.CERT_STORAGE_KEY || '';

async function encryptBuffer(buffer) {
  if (!CERT_KEY) throw new Error('CERT_STORAGE_KEY not configured');
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(String(CERT_KEY)).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

async function decryptBuffer(base64) {
  if (!CERT_KEY) throw new Error('CERT_STORAGE_KEY not configured');
  const data = Buffer.from(base64, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const key = crypto.createHash('sha256').update(String(CERT_KEY)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const CERT_THUMBPRINT = process.env.CERT_THUMBPRINT;
const CERT_PASSWORD = process.env.CERT_PASSWORD;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload and store certificate securely (backend-only)
// Central handler for certificate uploads
async function handleCertificateUpload(req, res) {
  try {
    const { company_id } = req.body;
    // safe debug log: do not log password or file contents
    console.log('Cert upload attempt', { company_id: company_id || null, filename: req.file ? req.file.originalname : null, filesize: req.file ? req.file.size : null });
    // password should never be logged
    if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'Certificado não enviado.' });
    if (!company_id) return res.status(404).json({ sucesso: false, mensagem: 'Empresa não encontrada.' });

    // encrypt and store
    const encrypted = await encryptBuffer(req.file.buffer);
    const meta = {
      company_id: Number(company_id),
      filename: req.file.originalname,
      uploaded_at: new Date().toISOString(),
      password_stored: false,
    };

    const storageDir = path.join(__dirname, 'secure_certs');
    await fs.mkdir(storageDir, { recursive: true });
    const id = Date.now();
    const filePath = path.join(storageDir, `${id}.enc`);
    await fs.writeFile(filePath, encrypted, { encoding: 'utf8' });

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('company_certificates').insert({ company_id: meta.company_id, filename: meta.filename, stored_path: filePath, uploaded_at: meta.uploaded_at }).select().single();
        if (error) {
          console.error('Supabase insert error (company_certificates):', error);
          return res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar metadados do certificado: ' + (error.message || error.message_text || JSON.stringify(error)) });
        }
      } catch (supErr) {
        console.error('Supabase exception inserting company_certificates:', supErr && supErr.message ? supErr.message : supErr);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar metadados do certificado.' });
      }
      try {
        await supabaseAdmin.from('audit_logs').insert({ action: 'upload_certificate', details: JSON.stringify({ company_id: meta.company_id, filename: meta.filename }), created_at: new Date().toISOString() }).catch(() => {});
      } catch (_) {}
    }

    return res.status(201).json({ sucesso: true, mensagem: 'Certificado digital enviado com sucesso', path: filePath });
  } catch (err) {
    console.error('cert upload error', err.message || err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ sucesso: false, mensagem: 'Arquivo do certificado muito grande.' });
    if (String(err.message || '').toLowerCase().includes('cert_storage_key') || String(err.message || '').toLowerCase().includes('cert_storage_key not configured') || String(err.message || '').toLowerCase().includes('cert_storage_key not configured')) {
      return res.status(500).json({ sucesso: false, mensagem: 'Configuração do servidor ausente: CERT_STORAGE_KEY não configurada.' });
    }
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao salvar o certificado.' });
  }
}

// Existing route kept for compatibility (expects field 'certificate')
app.post('/api/certificates', upload.single('certificate'), (req, res) => handleCertificateUpload(req, res));

// Alias route required by some frontends (Portuguese path) (expects field 'certificado')
app.post('/api/empresas/certificado', upload.single('certificado'), (req, res) => handleCertificateUpload(req, res));

// Test certificate - basic sanity: decrypt and check PFX structure presence
app.post('/api/certificates/test', express.json(), async (req, res) => {
  try {
    const { stored_path } = req.body;
    if (!stored_path) return res.status(400).json({ error: 'stored_path required' });
    const exists = await fs.readFile(stored_path, { encoding: 'utf8' });
    const buf = await decryptBuffer(exists);
    // naive check: a PFX file often has binary header; we just return size
    return res.json({ ok: true, size: buf.length });
  } catch (err) {
    console.error('cert test error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Alias test route in Portuguese
app.post('/api/empresas/certificado/testar', express.json(), async (req, res) => {
  try {
    // accept either stored_path or company_id
    const { stored_path, company_id } = req.body;
    let pathToUse = stored_path;
    if (!pathToUse && company_id && supabaseAdmin) {
      const { data } = await supabaseAdmin.from('company_certificates').select('stored_path').eq('company_id', Number(company_id)).order('uploaded_at', { ascending: false }).limit(1).single();
      if (data && data.stored_path) pathToUse = data.stored_path;
    }
    if (!pathToUse) return res.status(400).json({ sucesso: false, mensagem: 'stored_path ou company_id necessário' });
    const exists = await fs.readFile(pathToUse, { encoding: 'utf8' });
    const buf = await decryptBuffer(exists);
    return res.json({ sucesso: true, valido: true, tamanho: buf.length });
  } catch (err) {
    console.error('cert test alias error', err.message || err);
    return res.status(500).json({ sucesso: false, valido: false, mensagem: 'Erro ao testar certificado' });
  }
});

// NF-e emission scaffold: expects assembled payload, saves in DB and returns a job id
app.post('/api/nfe/emit', express.json(), async (req, res) => {
  try {
    const payload = req.body;
    // insert into nfe_queue table for background processing
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('nfe_queue').insert({ payload, status: 'queued', created_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      // audit
      await supabaseAdmin.from('audit_logs').insert({ action: 'nfe_emit_requested', details: JSON.stringify({ id: data.id }), created_at: new Date().toISOString() }).catch(() => {});
      return res.json({ ok: true, job: data });
    }

    // fallback: save to local file
    const storageDir = path.join(__dirname, 'nfe_queue');
    await fs.mkdir(storageDir, { recursive: true });
    const id = Date.now();
    await fs.writeFile(path.join(storageDir, `${id}.json`), JSON.stringify(payload, null, 2));
    return res.json({ ok: true, job: { id } });
  } catch (err) {
    console.error('nfe emit error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Cancel NF-e scaffold
app.post('/api/nfe/:id/cancel', express.json(), async (req, res) => {
  const { id } = req.params;
  // record audit and change status in DB if available
  if (supabaseAdmin) {
    await supabaseAdmin.from('audit_logs').insert({ action: 'nfe_cancel_requested', details: JSON.stringify({ id, body: req.body }), created_at: new Date().toISOString() }).catch(() => {});
  }
  return res.json({ ok: true, id });
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/(.*)/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handler for multer and other middlewares
app.use((err, req, res, next) => {
  if (!err) return next();
  console.error('Unhandled error middleware:', err && err.message ? err.message : err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ sucesso: false, mensagem: 'Arquivo do certificado muito grande.' });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ sucesso: false, mensagem: err.message || 'Erro no upload do arquivo.' });
  }
  // fileFilter may throw Error with message about extension
  if (err.message && (err.message.includes('.pfx') || err.message.includes('.p12') || err.message.includes('Aceitos'))) {
    return res.status(400).json({ sucesso: false, mensagem: err.message });
  }
  return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
  console.log(`✅ Certificado configurado com Thumbprint: ${CERT_THUMBPRINT || 'não informado'}`);
  console.log(`✅ Senha do certificado configurada: ${CERT_PASSWORD ? 'sim' : 'não'}`);
});