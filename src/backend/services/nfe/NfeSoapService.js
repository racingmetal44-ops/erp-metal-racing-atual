import axios from 'axios';
import fs from 'fs-extra';
import https from 'https';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import CertificateLoader from './CertificateLoader.js';
import { getEmpresaConfig } from '../../config/sefaz.js';
const webservices = {
    "42": {
        "2": {
            "NfeAutorizacao4": {
                url: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
                method: "nfeAutorizacaoLote",
                version: "4.00"
            },
            "NfeRetAutorizacao4": {
                url: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
                method: "nfeRetAutorizacaoLote",
                version: "4.00"
            },
            "NfeStatusServico4": {
                url: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NFeStatusServico4.asmx",
                method: "nfeStatusServicoNF",
                version: "4.00"
            }
        },
        "1": {
            "NfeAutorizacao4": {
                url: "https://nfe.fazenda.gov.br/NFeAutorizacao4",
                method: "nfeAutorizacaoLote",
                version: "4.00"
            },
            "NfeRetAutorizacao4": {
                url: "https://nfe.fazenda.gov.br/NFeRetAutorizacao4",
                method: "nfeRetAutorizacaoLote",
                version: "4.00"
            },
            "NfeStatusServico4": {
                url: "https://nfe.fazenda.gov.br/NFeStatusServico4",
                method: "nfeStatusServicoNF",
                version: "4.00"
            }
        }
    }
};


class NfeSoapService {

    // =========================================================
    // CA DA CADEIA SSL DO SVRS / ICP-BRASIL
    // =========================================================
    static async carregarCadeiaCA() {

        const intermediariaPath = path.join(
            process.cwd(),
            'public-certs', 'serpro-sslv1.pem'
        );

        const raizPath = path.join(
            process.cwd(),
            'public-certs', 'ICP-Brasilv10.pem'
        );

        if (!await fs.pathExists(intermediariaPath)) {
            throw new Error(
                `Certificado CA intermediÃƒÂ¡rio nÃƒÂ£o encontrado: ${intermediariaPath}`
            );
        }

        if (!await fs.pathExists(raizPath)) {
            throw new Error(
                `Certificado CA raiz nÃƒÂ£o encontrado: ${raizPath}`
            );
        }

        const intermediaria =
            await fs.readFile(intermediariaPath);

        const raiz =
            await fs.readFile(raizPath);

        console.log(
            '[SEFAZ] CA intermediÃƒÂ¡ria carregada:',
            intermediaria.length,
            'bytes'
        );

        console.log(
            '[SEFAZ] CA raiz ICP-Brasil V10 carregada:',
            raiz.length,
            'bytes'
        );

        return [
            intermediaria,
            raiz
        ];
    }


    static async carregarCertificado(empresaId = 1) {
        const certificado =
            await CertificateLoader.carregarCertificado(empresaId);

        return {
            cert: certificado.cert,
            key: certificado.key,
            pfx: certificado.pfx,
            validFrom: certificado.info?.validFrom || null,
            validTo: certificado.info?.validTo || null
        };
    }
    static obterWebService(empresa, ambiente, servico) {
        const cUF = Number(empresa.cUF);
        const tpAmb =
            String(ambiente) === 'homologacao' ||
            String(ambiente) === '2'
                ? '2'
                : '1';

        const config =
            webservices?.[cUF]?.[tpAmb]?.[servico];

        if (!config) {
            throw new Error(
                `Endpoint SEFAZ nÃƒÂ£o encontrado para cUF=${cUF}, tpAmb=${tpAmb}, serviÃƒÂ§o=${servico}.`
            );
        }

        return {
            ...config,
            cUF,
            tpAmb
        };
    }

    static criarHttpsAgent(certificado) {

        const intermediariaPath = path.join(
            process.cwd(),
            'public-certs', 'serpro-sslv1.pem'
        );

        const raizPath = path.join(
            process.cwd(),
            'public-certs', 'ICP-Brasilv10.pem'
        );

        if (!fs.existsSync(intermediariaPath)) {
            throw new Error(
                `Certificado CA intermediÃƒÂ¡rio nÃƒÂ£o encontrado: ${intermediariaPath}`
            );
        }

        if (!fs.existsSync(raizPath)) {
            throw new Error(
                `Certificado CA raiz nÃƒÂ£o encontrado: ${raizPath}`
            );
        }

        const intermediaria =
            fs.readFileSync(intermediariaPath);

        const raiz =
            fs.readFileSync(raizPath);

        const cadeiaCA = [
            intermediaria,
            raiz
        ];

        console.log(
            '[SEFAZ] CA intermediÃƒÂ¡ria carregada:',
            intermediaria.length,
            'bytes'
        );

        console.log(
            '[SEFAZ] CA raiz ICP-Brasil V10 carregada:',
            raiz.length,
            'bytes'
        );

        return new https.Agent({
            cert: certificado.cert,
            key: certificado.key,
            ca: cadeiaCA,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2'
        });
    }

    static montarSoapAutorizacao(
        xmlAssinado,
        empresa,
        ambiente
    ) {
        const ws =
            this.obterWebService(
                empresa,
                ambiente,
                'NfeAutorizacao4'
            );

        const namespace =
            'http://www.portalfiscal.inf.br/nfe';

        const namespaceWsdl =
            'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';

        // Remove a declaraÃƒÂ§ÃƒÂ£o XML para que o XML da NF-e
        // possa ser incorporado corretamente dentro do lote.
        const nfeSemDeclaracao =
            String(xmlAssinado)
                .replace(
                    /^\s*<\?xml[\s\S]*?\?>\s*/i,
                    ''
                )
                .trim();

        // Lote ÃƒÂºnico para processamento sÃƒÂ­ncrono.
        // O identificador deve ter no mÃƒÂ¡ximo 15 dÃƒÂ­gitos.
        const idLote =
            String(Date.now())
                .replace(/\D/g, '')
                .slice(-15)
                .padStart(15, '0');

        const enviNFe =
            `<enviNFe xmlns="${namespace}" versao="4.00">` +
            `<idLote>${idLote}</idLote>` +
            `<indSinc>1</indSinc>` +
            nfeSemDeclaracao +
            `</enviNFe>`;

        return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Header>
        <nfeCabecMsg xmlns="${namespaceWsdl}">
            <cUF>${ws.cUF}</cUF>
            <versaoDados>${ws.version || '4.00'}</versaoDados>
        </nfeCabecMsg>
    </soap12:Header>
    <soap12:Body>
        <nfeDadosMsg xmlns="${namespaceWsdl}">
            ${enviNFe}
        </nfeDadosMsg>
    </soap12:Body>
</soap12:Envelope>`;
    }
    static async enviar(
        xmlAssinado,
        empresaId = 1,
        ambiente = 'homologacao'
    ) {
        const empresa =
            getEmpresaConfig(empresaId);

        const certificado =
            await this.carregarCertificado(
                empresaId
            );

        const ws =
            this.obterWebService(
                empresa,
                ambiente,
                'NfeAutorizacao4'
            );

        const soapEnvelope =
            this.montarSoapAutorizacao(
                xmlAssinado,
                empresa,
                ambiente
            );

        const agent =
            this.criarHttpsAgent(certificado);

        try {
            const response =
                await axios.post(
                    ws.url,
                    soapEnvelope,
                    {
                        httpsAgent: agent,
                        headers: {
                            'Content-Type':
                                `application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/${ws.method}"`
                        },
                        timeout: 60000,
                        validateStatus: () => true
                    }
                );

            return this.parseSefazResponse(
                response.data
            );

        } catch (error) {
            throw new Error(
                `Erro de comunicaÃƒÂ§ÃƒÂ£o com a SEFAZ: ${error.message}`
            );
        }
    }

    static async transmitir(
        xmlAssinado,
        empresaId = 1
    ) {
        return this.enviar(
            xmlAssinado,
            empresaId,
            'homologacao'
        );
    }

    static async consultarRecibo(
        nRec,
        empresaId = 1,
        ambiente = 'homologacao'
    ) {
        if (!nRec) {
            throw new Error(
                'NÃƒÂºmero do recibo (nRec) nÃƒÂ£o informado.'
            );
        }

        const empresa =
            getEmpresaConfig(empresaId);

        const certificado =
            await this.carregarCertificado(
                empresaId
            );

        const ws =
            this.obterWebService(
                empresa,
                ambiente,
                'NfeRetAutorizacao4'
            );

        const namespace =
            'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4';

        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Header>
        <nfeCabecMsg xmlns="${namespace}">
            <cUF>${ws.cUF}</cUF>
            <versaoDados>${ws.version || '4.00'}</versaoDados>
        </nfeCabecMsg>
    </soap12:Header>
    <soap12:Body>
        <nfeDadosMsg xmlns="${namespace}">
            <consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                <tpAmb>${ws.tpAmb}</tpAmb>
                <nRec>${nRec}</nRec>
            </consReciNFe>
        </nfeDadosMsg>
    </soap12:Body>
</soap12:Envelope>`;

        const agent =
            this.criarHttpsAgent(certificado);

        try {
            const response =
                await axios.post(
                    ws.url,
                    soapEnvelope,
                    {
                        httpsAgent: agent,
                        headers: {
                            'Content-Type':
                                `application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeRetAutorizacao4/${ws.method}"`
                        },
                        timeout: 60000,
                        validateStatus: () => true
                    }
                );

            return this.parseSefazResponse(
                response.data
            );

        } catch (error) {
            throw new Error(
                `Erro de comunicaÃƒÂ§ÃƒÂ£o com a SEFAZ: ${error.message}`
            );
        }
    }

    static async testarStatus(
        empresaId = 1,
        ambiente = 'homologacao'
    ) {
        const empresa =
            getEmpresaConfig(empresaId);

        const certificado =
            await this.carregarCertificado(
                empresaId
            );

        const ws =
            this.obterWebService(
                empresa,
                ambiente,
                'NfeStatusServico4'
            );

        const namespace =
            'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';

        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><cUF>${ws.cUF}</cUF><versaoDados>${ws.version || '4.00'}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ws.tpAmb}</tpAmb><cUF>${ws.cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

        const agent =
            this.criarHttpsAgent(certificado);

        const inicio =
            Date.now();

        try {
            const response =
                await axios.post(
                    ws.url,
                    soapEnvelope,
                    {
                        httpsAgent: agent,
                        headers: {
                            'Content-Type':
                                `application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/${ws.method}"`
                        },
                        timeout: 60000,
                        validateStatus: () => true
                    }
                );

            const resultado =
                this.parseSefazResponse(
                    response.data
                );

            return {
                success:
                    Number(resultado.cStat) > 0,
                ...resultado,
                tempoMs:
                    Date.now() - inicio,
                httpStatus:
                    response.status
            };

        } catch (error) {
            return {
                success: false,
                cStat: null,
                xMotivo:
                    `Erro de comunicaÃƒÂ§ÃƒÂ£o: ${error.message}`,
                tempoMs:
                    Date.now() - inicio,
                httpStatus:
                    error.response?.status || null
            };
        }
    }
    static parseSefazResponse(xmlResponse) {

        const xml =
            String(xmlResponse || '');

        if (!xml.trim()) {

            return {
                success: false,
                cStat: null,
                cStatLote: null,
                xMotivoLote: null,
                cStatNFe: null,
                xMotivoNFe: null,
                xMotivo: 'Resposta vazia da SEFAZ',
                nRec: null,
                nProt: null,
                dhRecbto: null,
                tpAmb: null,
                verAplic: null,
                respostaSefaz: xml,
                xmlRetorno: xml
            };
        }

        // =====================================================
        // EXTRATOR GENÃƒâ€°RICO DE TAG XML
        // Aceita tags com ou sem prefixo de namespace.
        // =====================================================

        const extrair = (tag, bloco = xml) => {

            const regex =
                new RegExp(
                    `<(?:[A-Za-z0-9_]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tag}>`,
                    'i'
                );

            const match =
                bloco.match(regex);

            return match
                ? String(match[1]).trim()
                : null;
        };

        // =====================================================
        // STATUS DO SERVIÃƒâ€¡O
        // NfeStatusServico4
        // =====================================================

        const statusMatch =
            xml.match(
                /<(?:[A-Za-z0-9_]+:)?retConsStatServ\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?retConsStatServ>/i
            );

        if (statusMatch) {

            const blocoStatus =
                statusMatch[0];

            const tpAmb =
                extrair(
                    'tpAmb',
                    blocoStatus
                );

            const verAplic =
                extrair(
                    'verAplic',
                    blocoStatus
                );

            const cStat =
                extrair(
                    'cStat',
                    blocoStatus
                );

            const xMotivo =
                extrair(
                    'xMotivo',
                    blocoStatus
                );

            const dhRecbto =
                extrair(
                    'dhRecbto',
                    blocoStatus
                );

            return {

                success:
                    cStat === '107',

                cStat:
                    cStat,

                cStatLote:
                    null,

                xMotivoLote:
                    null,

                cStatNFe:
                    null,

                xMotivoNFe:
                    null,

                xMotivo:
                    xMotivo ||
                    'Retorno do serviÃƒÂ§o de status da SEFAZ.',

                nRec:
                    null,

                nProt:
                    null,

                dhRecbto:
                    dhRecbto,

                tpAmb:
                    tpAmb,

                verAplic:
                    verAplic,

                respostaSefaz:
                    xml,

                xmlRetorno:
                    xml
            };
        }

        // =====================================================
        // AUTORIZAÃƒâ€¡ÃƒÆ’O NF-e
        // NfeAutorizacao4
        // =====================================================

        const loteMatch =
            xml.match(
                /<(?:[A-Za-z0-9_]+:)?retEnviNFe\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?retEnviNFe>/i
            );

        const blocoLote =
            loteMatch
                ? loteMatch[0]
                : xml;

        // =====================================================
        // PROTOCOLO DA NF-e
        // =====================================================

        const protMatch =
            blocoLote.match(
                /<(?:[A-Za-z0-9_]+:)?infProt\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?infProt>/i
            );

        const blocoProt =
            protMatch
                ? protMatch[0]
                : null;

        // =====================================================
        // LOTE
        // =====================================================

        const tpAmb =
            extrair(
                'tpAmb',
                blocoLote
            );

        const verAplic =
            extrair(
                'verAplic',
                blocoLote
            );

        const cStatLote =
            extrair(
                'cStat',
                blocoLote
            );

        const xMotivoLote =
            extrair(
                'xMotivo',
                blocoLote
            );

        const nRec =
            extrair(
                'nRec',
                blocoLote
            );

        const dhRecbtoLote =
            extrair(
                'dhRecbto',
                blocoLote
            );

        // =====================================================
        // NF-e / PROTOCOLO
        // =====================================================

        const cStatNFe =
            blocoProt
                ? extrair(
                    'cStat',
                    blocoProt
                )
                : null;

        const xMotivoNFe =
            blocoProt
                ? extrair(
                    'xMotivo',
                    blocoProt
                )
                : null;

        const nProt =
            blocoProt
                ? extrair(
                    'nProt',
                    blocoProt
                )
                : null;

        const dhRecbtoNFe =
            blocoProt
                ? extrair(
                    'dhRecbto',
                    blocoProt
                )
                : null;

        const dhRecbto =
            dhRecbtoNFe ||
            dhRecbtoLote ||
            null;

        // =====================================================
        // STATUS PRINCIPAL
        // =====================================================

        const cStatPrincipal =
            String(
                cStatNFe ||
                cStatLote ||
                ''
            );

        const motivoPrincipal =
            xMotivoNFe ||
            xMotivoLote ||
            'Retorno nÃƒÂ£o interpretado';

        return {

            success:
                cStatPrincipal === '100' ||
                cStatPrincipal === '103' ||
                cStatPrincipal === '107',

            cStat:
                cStatPrincipal ||
                null,

            cStatLote:
                cStatLote
                    ? String(cStatLote)
                    : null,

            xMotivoLote:
                xMotivoLote ||
                null,

            cStatNFe:
                cStatNFe
                    ? String(cStatNFe)
                    : null,

            xMotivoNFe:
                xMotivoNFe ||
                null,

            xMotivo:
                motivoPrincipal,

            nRec:
                nRec ||
                null,

            nProt:
                nProt ||
                null,

            dhRecbto:
                dhRecbto,

            tpAmb:
                tpAmb ||
                null,

            verAplic:
                verAplic ||
                null,

            respostaSefaz:
                xml,

            xmlRetorno:
                xml
        };
    }
}

export default NfeSoapService;






