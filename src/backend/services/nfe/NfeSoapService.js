import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { SEFAZ_CONFIG } from '../../config/sefaz.js';

export class NfeSoapService {

    constructor() {
        this.timeout = 60000;
    }

    async carregarCertificado(empresaId) {

        const certPath = path.join(
            process.cwd(),
            'certificados',
            `empresa_${empresaId}.pfx`
        );

        if (!await fs.pathExists(certPath)) {
            throw new Error(
                `Certificado A1 não encontrado: ${certPath}`
            );
        }

        const senha =
            process.env.CERT_SENHA ||
            process.env.CERTIFICADO_SENHA ||
            process.env.PFX_SENHA;

        if (!senha) {
            throw new Error(
                'Senha do certificado A1 não configurada. Configure CERT_SENHA no ambiente do servidor.'
            );
        }

        const pfx = await fs.readFile(certPath);

        return {
            pfx,
            passphrase: senha,
            certPath
        };
    }

    async enviar(xmlAssinado, empresaId, ambiente = 'homologacao') {

        try {

            console.log('[NFE] Preparando envio real para SEFAZ...');

            if (!xmlAssinado) {
                throw new Error('XML assinado não informado.');
            }

            const certificado =
                await this.carregarCertificado(empresaId);

            const configUF = SEFAZ_CONFIG.SC;

            if (!configUF || !configUF[ambiente]) {
                throw new Error(
                    `Configuração SEFAZ não encontrada para SC/${ambiente}.`
                );
            }

            const url =
                configUF[ambiente].NfeAutorizacao;

            console.log('[NFE] WebService:', url);
            console.log('[NFE] Ambiente:', ambiente);
            console.log('[NFE] Empresa:', empresaId);
            console.log('[NFE] Certificado:', certificado.certPath);

            const soapBody =
                this.montarSoap(xmlAssinado);

            const httpsAgent = new https.Agent({
                pfx: certificado.pfx,
                passphrase: certificado.passphrase,
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2'
            });

            console.log('[NFE] Abrindo conexão HTTPS com certificado A1...');

            const response = await axios.post(
                url,
                soapBody,
                {
                    httpsAgent,

                    headers: {
                        'Content-Type':
                            'application/soap+xml; charset=utf-8',

                        'SOAPAction':
                            '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"'
                    },

                    timeout: this.timeout,

                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,

                    validateStatus: () => true
                }
            );

            console.log(
                '[NFE] HTTP SEFAZ:',
                response.status
            );

            console.log(
                '[NFE] Resposta recebida:',
                String(response.data).substring(0, 1000)
            );

            return this.interpretarResposta(
                response.data,
                response.status
            );

        } catch (error) {

            console.error(
                '[NFE] ERRO NO ENVIO SEFAZ:',
                error.message
            );

            if (error.response) {

                console.error(
                    '[NFE] HTTP:',
                    error.response.status
                );

                console.error(
                    '[NFE] RESPOSTA:',
                    String(error.response.data).substring(0, 2000)
                );
            }

            throw error;
        }
    }

    montarSoap(xmlAssinado) {

        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
    xmlns:soap="http://www.w3.org/2003/05/soap-envelope">

    <soap:Header>
        <nfeCabecMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">

            <cUF>42</cUF>
            <versaoDados>4.00</versaoDados>

        </nfeCabecMsg>
    </soap:Header>

    <soap:Body>

        <nfeDadosMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">

            ${xmlAssinado}

        </nfeDadosMsg>

    </soap:Body>

</soap:Envelope>`;
    }

    interpretarResposta(xmlResponse, httpStatus) {

        const xml = String(xmlResponse || '');

        const cStat =
            this.extrairTag(xml, 'cStat');

        const xMotivo =
            this.extrairTag(xml, 'xMotivo');

        const nRec =
            this.extrairTag(xml, 'nRec');

        const nProt =
            this.extrairTag(xml, 'nProt');

        const dhRecbto =
            this.extrairTag(xml, 'dhRecbto');

        const tpAmb =
            this.extrairTag(xml, 'tpAmb');

        console.log(
            '[NFE] cStat:',
            cStat || 'não informado'
        );

        console.log(
            '[NFE] xMotivo:',
            xMotivo || 'não informado'
        );

        console.log(
            '[NFE] nRec:',
            nRec || 'não informado'
        );

        console.log(
            '[NFE] nProt:',
            nProt || 'não informado'
        );

        /*
         * IMPORTANTE:
         *
         * Não simulamos mais cStat=100.
         *
         * A autorização somente será considerada verdadeira
         * quando a SEFAZ retornar cStat 100.
         */

        const autorizado =
            cStat === '100';

        return {

            success: autorizado,

            autorizado,

            cStat: cStat || null,

            xMotivo:
                xMotivo ||
                `Resposta HTTP ${httpStatus}`,

            nRec:
                nRec || null,

            nProt:
                nProt || null,

            dhRecbto:
                dhRecbto || null,

            tpAmb:
                tpAmb || null,

            httpStatus,

            respostaSefaz: xml
        };
    }

    extrairTag(xml, tag) {

        if (!xml) {
            return null;
        }

        const regex =
            new RegExp(
                `<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
                'i'
            );

        const match =
            xml.match(regex);

        if (!match) {
            return null;
        }

        return match[1]
            .replace(/<!\[CDATA\[|\]\]>/g, '')
            .trim();
    }
}

export default new NfeSoapService();
