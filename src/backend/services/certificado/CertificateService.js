// src/backend/services/certificado/CertificateService.js
import forge from 'node-forge';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class CertificateService {
    constructor() {
        this.certsPath = path.join(process.cwd(), 'certificados');
        fs.ensureDirSync(this.certsPath);
    }

    async upload(file, senha, empresaId) {
        try {
            const tempPath = path.join(this.certsPath, `${uuidv4()}.pfx`);
            await fs.writeFile(tempPath, file.buffer);

            const info = await this.extractCertificateInfo(tempPath, senha);

            const finalPath = path.join(this.certsPath, `empresa_${empresaId}.pfx`);
            await fs.move(tempPath, finalPath, { overwrite: true });

            return { ...info, id: empresaId };
        } catch (error) {
            throw new Error(`Erro ao processar certificado: ${error.message}`);
        }
    }

    async extractCertificateInfo(filePath, senha) {
        try {
            const pfxBuffer = await fs.readFile(filePath);
            const pfx = forge.util.createBuffer(pfxBuffer.toString('binary'));
            const p12Asn1 = forge.asn1.fromDer(pfx.getBytes());
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

            const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const certBag = bags[forge.pki.oids.certBag][0];
            const cert = certBag.cert;

            const subject = cert.subject.attributes;
            const issuer = cert.issuer.attributes;

            let cnpj = '';
            subject.forEach(attr => {
                if (attr.name === 'CN' || attr.shortName === 'CN') {
                    const match = attr.value.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
                    if (match) cnpj = match[1];
                }
            });

            const now = new Date();
            const status = (now < cert.validity.notBefore || now > cert.validity.notAfter)
                ? 'EXPIRADO'
                : 'VALIDO';

            return {
                nome: subject.find(a => a.name === 'CN')?.value || 'N/A',
                cnpj: cnpj || 'N/A',
                emissor: issuer.find(a => a.name === 'CN')?.value || 'N/A',
                validadeInicial: cert.validity.notBefore,
                validadeFinal: cert.validity.notAfter,
                numeroSerie: cert.serialNumber,
                status
            };
        } catch (error) {
            if (error.message.includes('password')) {
                throw new Error('Senha do certificado inválida');
            }
            throw error;
        }
    }

    async testCertificate(file, senha) {
        try {
            const tempPath = path.join(this.certsPath, `${uuidv4()}.pfx`);
            await fs.writeFile(tempPath, file.buffer);
            await this.extractCertificateInfo(tempPath, senha);
            await fs.remove(tempPath);
            return { valid: true, message: 'Certificado válido' };
        } catch (error) {
            let message = 'Erro ao testar certificado';
            if (error.message.includes('password')) message = 'Senha do certificado inválida';
            else if (error.message.includes('expired')) message = 'Certificado expirado';
            return { valid: false, message };
        }
    }
}
