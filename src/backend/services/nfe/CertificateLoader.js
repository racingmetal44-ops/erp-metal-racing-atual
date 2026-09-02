import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CertificateLoader {
  /**
   * Carrega certificado A1 (.pfx) e extrai chave privada e certificado
   */
  loadCertificate(certPath, password) {
    try {
      // Verifica se o arquivo existe
      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado: ${certPath}`);
      }

      console.log(`📂 Carregando certificado: ${certPath}`);

      // Lê o arquivo .pfx
      const pfxBuffer = fs.readFileSync(certPath);
      const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      
      // Decodifica o PKCS#12
      const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);
      
      // Extrai o certificado e a chave privada
      let cert = null;
      let privateKey = null;

      p12.safeContents.forEach(safeContent => {
        safeContent.safeBags.forEach(safeBag => {
          if (safeBag.cert) {
            cert = forge.pki.certificateToPem(safeBag.cert);
          }
          if (safeBag.key) {
            privateKey = forge.pki.privateKeyToPem(safeBag.key);
          }
        });
      });

      if (!cert || !privateKey) {
        throw new Error('Não foi possível extrair certificado ou chave privada do arquivo .pfx');
      }

      console.log('✅ Certificado carregado com sucesso!');

      return {
        cert,
        privateKey,
        pfx: pfxBuffer,
        validFrom: this.getCertValidity(cert, 'from'),
        validTo: this.getCertValidity(cert, 'to')
      };
    } catch (error) {
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }

  /**
   * Extrai data de validade do certificado
   */
  getCertValidity(certPem, type = 'from') {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      return type === 'from' 
        ? cert.validity.notBefore 
        : cert.validity.notAfter;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica se o certificado está válido
   */
  isValidCertificate(certPath, password) {
    try {
      const { validFrom, validTo } = this.loadCertificate(certPath, password);
      const now = new Date();
      return now >= validFrom && now <= validTo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Converte certificado para formato PEM
   */
  toPem(certPath, password) {
    const { cert, privateKey } = this.loadCertificate(certPath, password);
    return {
      certPem: cert,
      privateKeyPem: privateKey
    };
  }
}

export default new CertificateLoader();
