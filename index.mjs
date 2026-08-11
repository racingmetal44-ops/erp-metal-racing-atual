import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CERT_THUMBPRINT = process.env.CERT_THUMBPRINT;
const CERT_PASSWORD = process.env.CERT_PASSWORD;

console.log('Servidor iniciando...');
console.log('Certificado configurado com Thumbprint:', CERT_THUMBPRINT);

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Servidor rodando em http://localhost:' + PORT);
});
