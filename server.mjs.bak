import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { loadCertificate } from './config/certificateLoader.mjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

console.log('Iniciando o servidor...');
const certData = loadCertificate();

app.get('/api/status', (req, res) => {
    res.json({ status: 'Servidor OK', certificado: 'Carregado' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log('Servidor Back-end rodando em http://localhost:' + PORT);
});
