import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

class CertificateLoader {
  /**
   * Carrega certificado A1 (.pfx) e extrai chave privada e certificado.
   * Na Vercel, aceita NFE_CERT_PFX_BASE64.
   */
  loadCertificate(certPath, password) {
    try {
      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado: ${certPath}`);
      }

      console.log(`?? Carregando certificado: ${certPath}`);

      const pfxBuffer = fs.readFileSync(certPath);
      return this.loadCertificateBuffer(pfxBuffer, password);
    } catch (error) {
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }

  /**
   * Carrega um PFX diretamente de um Buffer.
   */
  loadCertificateBuffer(pfxBuffer, password) {
    try {
      if (!pfxBuffer || !pfxBuffer.length) {
        throw new Error('Arquivo PFX vazio ou inválido.');
      }

      const pfxAsn1 = forge.asn1.fromDer(
        pfxBuffer.toString('binary')
      );

      const p12 = forge.pkcs12.pkcs12FromAsn1(
        pfxAsn1,
        false,
        password
      );

      let cert = null;
      let privateKey = null;

      p12.safeContents.forEach(safeContent => {
        safeContent.safeBags.forEach(safeBag => {
          if (safeBag.cert && !cert) {
            cert = forge.pki.certificateToPem(safeBag.cert);
          }

          if (safeBag.key && !privateKey) {
            privateKey = forge.pki.privateKeyToPem(safeBag.key);
          }
        });
      });

      if (!cert || !privateKey) {
        throw new Error(
          'Não foi possível extrair certificado ou chave privada do arquivo .pfx'
        );
      }

      const validFrom = this.getCertValidity(cert, 'from');
      const validTo = this.getCertValidity(cert, 'to');

      console.log('? Certificado carregado com sucesso!');

      return {
        cert,
        privateKey,
        key: privateKey,
        pfx: pfxBuffer,
        validFrom,
        validTo,
        info: {
          validFrom,
          validTo
        }
      };
    } catch (error) {
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }

  /**
   * Carrega o certificado da empresa.
   * Vercel: NFE_CERT_PFX_BASE64.
   * Local: arquivo .pfx da empresa.
   */
  async carregarCertificado(empresaId = 1) {
    const senha =
      process.env.NFE_CERT_SENHA ||
      process.env.CERT_SENHA ||
      '';

    if (process.env.NFE_CERT_PFX_BASE64) {
      const pfxBuffer = Buffer.from(
        process.env.NFE_CERT_PFX_BASE64,
        'base64'
      );

      if (!pfxBuffer.length) {
        throw new Error(
          'NFE_CERT_PFX_BASE64 está vazia ou inválida.'
        );
      }

      return this.loadCertificateBuffer(
        pfxBuffer,
        senha
      );
    }

    const possiveis = [
      process.env.NFE_CERTIFICADO,
      process.env.CERT_PATH,
      path.join(
        process.cwd(),
        'certificados',
        `empresa_${empresaId}.pfx`
      ),
      path.join(
        process.cwd(),
        'certificado.pfx'
      )
    ].filter(Boolean);

    const certPath = possiveis.find(
      caminho => fs.existsSync(caminho)
    );

    if (!certPath) {
      throw new Error(
        `Certificado A1 da empresa ${empresaId} não encontrado.`
      );
    }

    return this.loadCertificate(
      certPath,
      senha
    );
  }

  /**
   * Extrai data de validade do certificado.
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
   * Verifica se o certificado está válido.
   */
  isValidCertificate(certPath, password) {
    try {
      const {
        validFrom,
        validTo
      } = this.loadCertificate(
        certPath,
        password
      );

      const now = new Date();

      return now >= validFrom &&
             now <= validTo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Converte certificado para formato PEM.
   */
  toPem(certPath, password) {
    const {
      cert,
      privateKey
    } = this.loadCertificate(
      certPath,
      password
    );

    return {
      certPem: cert,
      privateKeyPem: privateKey
    };
  }
}

export default new CertificateLoader();
