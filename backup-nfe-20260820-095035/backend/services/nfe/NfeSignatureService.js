// src/backend/services/nfe/NfeSignatureService.js
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import fs from 'fs-extra';
import path from 'path';

class NfeSignatureService {
    async assinarXml(xml, empresaId) {
        try {
            const certPath = path.join(process.cwd(), 'certificados', `empresa_${empresaId}.pfx`);
            const senha = process.env.CERT_SENHA || '';

            if (!await fs.pathExists(certPath)) {
                throw new Error(`Certificado não encontrado: ${certPath}`);
            }

            const pfxBuffer = await fs.readFile(certPath);
            const pfx = forge.util.createBuffer(pfxBuffer.toString('binary'));
            const p12Asn1 = forge.asn1.fromDer(pfx.getBytes());
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

            const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0];
            const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0];

            const cert = certBag.cert;
            const privateKey = keyBag.key;

            const xmlAssinado = this._assinarComXmlCrypto(xml, cert, privateKey);
            return xmlAssinado;
        } catch (error) {
            console.error('? Erro na assinatura:', error.message);
            throw new Error(`Falha ao assinar XML: ${error.message}`);
        }
    }

    _assinarComXmlCrypto(xml, cert, privateKey) {
        // Extrair o ID da NF-e
        const idMatch = xml.match(/Id="(NFe[^"]+)"/);
        if (!idMatch) {
            throw new Error('ID da NF-e não encontrado no XML');
        }
        const id = idMatch[1];

        // Criar a assinatura com a configuraééo correta
        const sig = new SignedXml({
            privateKey: privateKey,
            publicCert: cert,
            canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            hashAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
            signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
        });

        // Configurar a referéncia
        sig.addReference({
            xpath: `//*[@Id="${id}"]`,
            transforms: ['http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
            digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
            uri: `#${id}`
        });

        // Adicionar a chave péblica
        sig.signingKey = privateKey;

        // Assinar
        sig.computeSignature(xml);

        // Inserir a assinatura no XML
        const assinaturaXml = sig.getSignatureXml();
        const xmlAssinado = xml.replace('</infNFe>', `${assinaturaXml}</infNFe>`);
        return xmlAssinado;
    }

    async validarAssinatura(xmlAssinado) {
        try {
            if (!xmlAssinado.includes('<Signature')) {
                return { valido: false, mensagem: 'Assinatura não encontrada no XML' };
            }

            const signatureMatch = xmlAssinado.match(/<Signature[^>]*>([\s\S]*?)<\/Signature>/);
            if (!signatureMatch) {
                return { valido: false, mensagem: 'Assinatura mal formada' };
            }

            return { valido: true, mensagem: 'Assinatura vélida' };
        } catch (error) {
            return { valido: false, mensagem: `Erro na validaééo: ${error.message}` };
        }
    }
}

export default new NfeSignatureService();
