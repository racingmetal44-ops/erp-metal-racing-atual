import fs from 'fs';
import xmlCrypto from 'xml-crypto';
import CertificateLoader from './CertificateLoader.js';
import path from 'path';
import { buscarEmpresa, resolverCaminhoCertificado } from '../empresa/EmpresaService.js';

class NfeSignatureService {
    static async getCertPem(absolutePath, senha) {
        const loader = CertificateLoader;

        const resultado =
            loader.loadCertificate(
                absolutePath,
                senha
            );

        return {
            cert: resultado.cert,
            key: resultado.privateKey
        };
    }

    static async signXml(xml, absolutePath, senha) {
        const { cert, key } =
            await this.getCertPem(
                absolutePath,
                senha
            );

        // A SEFAZ não aceita caracteres de edição
        // (espaços/quebras de linha) entre elementos
        // dentro do NFe/enviNFe.
        //
        // A compactaééo acontece ANTES da assinatura,
        // para que o DigestValue seja calculado sobre
        // exatamente o XML que seré transmitido.
        const xmlCompactado =
            String(xml)
                .replace(/>\s+</g, '><')
                .trim();

        const signer =
            new xmlCrypto.SignedXml();

        signer.privateKey = key;
        signer.publicCert = cert;

        const infNFeInicio =
            xml.indexOf('<infNFe');

        if (infNFeInicio < 0) {
            throw new Error(
                'Tag <infNFe> não encontrada no XML para assinatura.'
            );
        }

        const infNFeFim =
            xml.indexOf('>', infNFeInicio);

        if (infNFeFim < 0) {
            throw new Error(
                'Tag <infNFe> inválida no XML para assinatura.'
            );
        }

        const cabecalhoInfNFe =
            xml.substring(
                infNFeInicio,
                infNFeFim + 1
            );

        const idInicio =
            cabecalhoInfNFe.indexOf('Id="NFe');

        if (idInicio < 0) {
            throw new Error(
                'Atributo Id da NF-e não encontrado na tag <infNFe>.'
            );
        }

        const idValorInicio =
            idInicio + 'Id="NFe'.length;

        const idValorFim =
            cabecalhoInfNFe.indexOf('"', idValorInicio);

        if (idValorFim < 0) {
            throw new Error(
                'Valor do Id da NF-e não foi encerrado corretamente.'
            );
        }

        const idNFe =
            cabecalhoInfNFe.substring(
                idValorInicio,
                idValorFim
            );

        if (!/^\d{44}$/.test(idNFe)) {
            throw new Error(
                `Id da NF-e inválido. Chave encontrada: ${idNFe}`
            );
        }

        console.log(
            '[NFE ASSINATURA] Id encontrado:',
            idNFe
        );

        const reference = {
            xpath: `//*[@Id="NFe${idNFe}"]`,
            transforms: [
                'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
            ],
            digestAlgorithm:
                'http://www.w3.org/2000/09/xmldsig#sha1'
        };

        signer.addReference(reference);

        signer.canonicalizationAlgorithm =
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

        signer.signatureAlgorithm =
            'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

        signer.computeSignature(
            xmlCompactado,
            {
                location: {
                    reference: `//*[local-name(.)="infNFe"]`,
                    action: 'after'
                }
            }
        );

        return signer.getSignedXml();
    }

    async assinarXml(xml, empresaId) {
        const empresa =
            buscarEmpresa(empresaId);

        if (!empresa) {
            throw new Error(
                `Empresa ${empresaId} não encontrada`
            );
        }

        const certPath =
            resolverCaminhoCertificado(empresa);

        const senha =
            process.env.CERT_SENHA ||
            process.env.NFE_CERT_SENHA ||
            process.env.CERTIFICADO_SENHA ||
            '';

        if (!fs.existsSync(certPath)) {
            throw new Error(
                `Certificado não encontrado: ${certPath}`
            );
        }

        return await NfeSignatureService.signXml(
            xml,
            certPath,
            senha
        );
    }

    async validarAssinatura(xml) {
        try {
            if (
                !xml ||
                typeof xml !== 'string'
            ) {
                return {
                    valido: false,
                    mensagem: 'XML não informado.'
                };
            }

            if (
                !xml.includes('<Signature') &&
                !xml.includes('<ds:Signature')
            ) {
                return {
                    valido: false,
                    mensagem: 'Assinatura digital não encontrada no XML.'
                };
            }

            return {
                valido: true,
                mensagem: 'Assinatura digital encontrada no XML.'
            };
        } catch (error) {
            return {
                valido: false,
                mensagem: error.message
            };
        }
    }
}

export default NfeSignatureService;