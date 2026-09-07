// src/backend/routes/certificateRoutes.js

import express from 'express';
import multer from 'multer';
import { CertificateService } from '../services/certificado/CertificateService.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const certService = new CertificateService();

// Upload do certificado
router.post('/:empresaId/certificado', upload.single('certificado'), async function(req, res) {
  try {
    const empresaId = req.params.empresaId;
    const senha = req.body.senha;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Arquivo nao enviado' });
    }
    
    if (!senha) {
      return res.status(400).json({ error: 'Senha nao fornecida' });
    }
    
    const result = await certService.upload(file, senha, empresaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Testar certificado
router.post('/:empresaId/certificado/testar', upload.single('certificado'), async function(req, res) {
  try {
    const senha = req.body.senha;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Arquivo nao enviado' });
    }
    
    if (!senha) {
      return res.status(400).json({ error: 'Senha nao fornecida' });
    }
    
    const result = await certService.testCertificate(file, senha);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter informacoes do certificado
router.get('/:empresaId/certificado', async function(req, res) {
  try {
    const empresaId = req.params.empresaId;
    const info = await certService.getCertificateInfo(empresaId);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
