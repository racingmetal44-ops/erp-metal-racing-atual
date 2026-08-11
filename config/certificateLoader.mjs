import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadCertificate() {
    const certPath = process.env.CERT_PATH;
    const certPassword = process.env.CERT_PASSWORD;
    
    if (!certPath || !certPassword) {
        console.error('ERRO: CERT_PATH ou CERT_PASSWORD nao estao no .env');
        process.exit(1);
    }

    try {
        const fullPath = path.resolve(__dirname, '..', certPath);
        const pfxBuffer = fs.readFileSync(fullPath);
        console.log('Certificado .pfx carregado com sucesso de: ' + fullPath);
        return { pfx: pfxBuffer, password: certPassword };
    } catch (error) {
        console.error('Erro ao ler o certificado: ' + error.message);
        process.exit(1);
    }
}
