import 'dotenv/config';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { SignedXml } from 'xml-crypto';

import {
    getSefazServiceUrl,
    getTpAmb,
    normalizarAmbiente
} from '../../config/sefaz.js';

import {
    carregarCertificado
} from '../certificado/CertificateLoader.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTOS_FILE = path.join(DATA_DIR, 'nfe-manifestacoes.json');

export const TIPOS_EVENTO = {
    CIENCIA: '210210',
    CONFIRMACAO: '210200',
    DESCONHECIMENTO: '210220',
    NAO_REALIZADA: '210240'
};

export const DESCRICOES_EVENTO = {
    '210200': 'Confirmacao da Operacao',
    '210210': 'Ciencia da Operacao',
    '210220': 'Desconhecimento da Operacao',
    '210240': 'Operacao nao Realizada'
};

const X_COND_USO =
    'O autor deste evento declara ter ciência de que a utilização indevida do evento poderá sujeitá-lo às sanções previstas na legislação tributária.';

function lerEventos() {
    try {
        if (!fs.existsSync(EVENTOS_FILE)) {
            return [];
        }

        const dados = fs.readJsonSync(EVENTOS_FILE);

        return Array.isArray(dados)
            ? dados
            : [];
    } catch {
        return [];
    }
}

function salvarEventos(lista) {
    fs.ensureDirSync(DATA_DIR);

    fs.writeJsonSync(
        EVENTOS_FILE,
        lista,
        {
            spaces: 2
        }
    );
}

function escapeXml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function agoraBrasil() {
    const agora = new Date();

    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    const segundo = String(agora.getSeconds()).padStart(2, '0');

    return (
        `${ano}-${mes}-${dia}` +
        `T${hora}:${minuto}:${segundo}-03:00`
    );
}

function validarChave(chNFe) {
    const chave =
        String(chNFe ?? '')
            .replace(/\D/g, '');

    if (!/^\d{44}$/.test(chave)) {
        throw new Error(
            'Chave da NF-e inválida. Deve possuir 44 dígitos.'
        );
    }

    return chave;
}

function validarCnpj(cnpj) {
    const valor =
        String(cnpj ?? '')
            .replace(/\D/g, '');

    if (!/^\d{14}$/.test(valor)) {
        throw new Error(
            'CNPJ do destinatário inválido.'
        );
    }

    return valor;
}

/*
 * XML ESPECÍFICO DA MANIFESTAÇÃO
 *
 * 210200 - Confirmação da Operação
 *
 * Estrutura:
 *
 * evento
 *   infEvento
 *     cOrgao
 *     tpAmb
 *     CNPJ
 *     chNFe
 *     dhEvento
 *     tpEvento
 *     nSeqEvento
 *     verEvento
 *     detEvento
 *       versao
 *       descEvento
 *       xCondUso
 *
 * A assinatura fica como irmã de infEvento
 * dentro de evento.
 */
function montarXmlEvento({ tpAmb, cnpj, chNFe, tipoEvento, sequencia, justificativa }) {

    const descricoes = {
        '210200': 'Confirmacao da Operacao',
        '210210': 'Ciencia da Operacao',
        '210220': 'Desconhecimento da Operacao',
        '210240': 'Operacao nao Realizada'
    };

    const descricao = descricoes[tipoEvento];

    if (!descricao) {
        throw new Error(`Tipo de evento invalido: ${tipoEvento}`);
    }

    const chave = String(chNFe || '').trim();
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '');
    const tpAmbLimpo = String(tpAmb || '').trim();

    if (!/^\d{44}$/.test(chave)) {
        throw new Error('Chave de acesso invalida. Deve possuir 44 digitos.');
    }

    if (!/^\d{14}$/.test(cnpjLimpo)) {
        throw new Error('CNPJ invalido. Deve possuir 14 digitos.');
    }

    if (tpAmbLimpo !== '1' && tpAmbLimpo !== '2') {
        throw new Error('tpAmb invalido. Use 1 para producao ou 2 para homologacao.');
    }

    const seq = Number(sequencia);

    if (!Number.isInteger(seq) || seq < 1 || seq > 99) {
        throw new Error('Numero de sequencia do evento invalido.');
    }

    const just = String(justificativa || '').trim();

    if (tipoEvento === TIPOS_EVENTO.NAO_REALIZADA && just.length < 15) {
        throw new Error(
            'Operacao nao Realizada exige justificativa com no minimo 15 caracteres.'
        );
    }

    const idEvento =
        `ID${tipoEvento}${chave}${String(seq).padStart(2, '0')}`;

    const agora = new Date();

    const dhEvento =
        new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })
        .formatToParts(agora)
        .reduce((obj, parte) => {
            if (parte.type !== 'literal') {
                obj[parte.type] = parte.value;
            }
            return obj;
        }, {});

    const dataHoraEvento =
        `${dhEvento.year}-${dhEvento.month}-${dhEvento.day}T` +
        `${dhEvento.hour}:${dhEvento.minute}:${dhEvento.second}-03:00`;

    let detalhe = '';

    if (tipoEvento === TIPOS_EVENTO.NAO_REALIZADA) {
        detalhe =
            `<xJust>${escapeXml(just)}</xJust>`;
    }

    return (
        `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
        `<infEvento Id="${idEvento}">` +
        `<cOrgao>91</cOrgao>` +
        `<tpAmb>${tpAmbLimpo}</tpAmb>` +
        `<CNPJ>${cnpjLimpo}</CNPJ>` +
        `<chNFe>${chave}</chNFe>` +
        `<dhEvento>${dataHoraEvento}</dhEvento>` +
        `<tpEvento>${tipoEvento}</tpEvento>` +
        `<nSeqEvento>${seq}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        `<detEvento versao="1.00">` +
        `<descEvento>${descricao}</descEvento>` +
        detalhe +
        `</detEvento>` +
        `</infEvento>` +
        `</evento>`
    );
}
function assinarEvento(
    xmlEvento,
    certPem,
    keyPem
) {
    const match =
        xmlEvento.match(
            /<infEvento\s+Id="([^"]+)"/i
        );

    if (!match) {
        throw new Error(
            'Id do infEvento não encontrado.'
        );
    }

    const idEvento =
        match[1];

    const sig =
        new SignedXml({
            privateKey: keyPem,
            publicCert: certPem,
            canonicalizationAlgorithm:
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            signatureAlgorithm:
                'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
        });

    sig.addReference({
        xpath: `//*[@Id="${idEvento}"]`,
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        digestAlgorithm:
            'http://www.w3.org/2000/09/xmldsig#sha1',
        uri:
            `#${idEvento}`
    });

    sig.computeSignature(
        xmlEvento,
        {
            location: {
                reference:
                    "//*[local-name()='infEvento']",
                action: 'after'
            }
        }
    );

    return sig.getSignedXml();
}

function obterTag(xml, tag) {
    const regex =
        new RegExp(
            `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
            'i'
        );

    return (
        xml.match(regex)?.[1]?.trim() ||
        null
    );
}

function analisarResposta(xmlResposta) {
    const xml =
        String(xmlResposta || '');

    const cStatTags = [
        ...xml.matchAll(
            /<(?:[\w.-]+:)?cStat\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?cStat>/gi
        )
    ].map(
        m => m[1].trim()
    );

    const xMotivoTags = [
        ...xml.matchAll(
            /<(?:[\w.-]+:)?xMotivo\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?xMotivo>/gi
        )
    ].map(
        m => m[1].trim()
    );

    const protocolos = [
        ...xml.matchAll(
            /<(?:[\w.-]+:)?nProt\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?nProt>/gi
        )
    ].map(
        m => m[1].trim()
    );

    const cStatLote =
        cStatTags.find(
            valor => valor === '128'
        ) ||
        cStatTags[0] ||
        null;

    /*
     * Ignora o 128 para encontrar
     * o cStat específico do evento.
     */
    const indiceEvento =
        cStatTags.findIndex(
            valor => valor !== '128'
        );

    const cStatEvento =
        indiceEvento >= 0
            ? cStatTags[indiceEvento]
            : cStatTags.at(-1) || null;

    const xMotivoEvento =
        indiceEvento >= 0
            ? (
                xMotivoTags[indiceEvento] ||
                xMotivoTags.at(-1) ||
                null
            )
            : (
                xMotivoTags.at(-1) ||
                null
            );

    return {
        cStatLote,
        cStatEvento,
        xMotivoEvento,
        protocolo:
            protocolos.at(-1) || null,
        sucesso:
            cStatEvento === '135'
    };
}

export class NfeManifestacaoService {

    constructor() {
        this.timeout = 60000;
    }

    async manifestar(opcoes) {
        const {
            empresaId,
            cnpj,
            uf,
            ambiente,
            chNFe,
            tipoEvento,
            justificativa
        } = opcoes || {};

        const inicio =
            Date.now();

        if (!empresaId) {
            throw new Error(
                'Empresa não informada.'
            );
        }

        const chave =
            validarChave(chNFe);

        const cnpjLimpo =
            validarCnpj(cnpj);

        const amb =
            normalizarAmbiente(
                ambiente ||
                process.env.NFE_AMBIENTE ||
                'homologacao'
            );

        const tpAmb =
            getTpAmb(amb);

        const url =
            getSefazServiceUrl(
                uf,
                amb,
                'RecepcaoEvento'
            );

        if (!url) {
            throw new Error(
                'URL do serviço RecepcaoEvento não encontrada.'
            );
        }

        console.log('');
        console.log(
            '============================================'
        );
        console.log(
            ' 📨 MANIFESTAÇÃO DO DESTINATÁRIO'
        );
        console.log(
            '============================================'
        );
        console.log(
            `[MANIFESTACAO] Empresa: ${empresaId}`
        );
        console.log(
            `[MANIFESTACAO] CNPJ: ${cnpjLimpo}`
        );
        console.log(
            `[MANIFESTACAO] UF: ${String(uf).toUpperCase()}`
        );
        console.log(
            `[MANIFESTACAO] Ambiente: ${amb}`
        );
        console.log(
            `[MANIFESTACAO] tpAmb: ${tpAmb}`
        );
        console.log(
            `[MANIFESTACAO] Chave: ${chave}`
        );
        console.log(
            `[MANIFESTACAO] Evento: ${tipoEvento}`
        );
        console.log(
            `[MANIFESTACAO] Endpoint: ${url}`
        );

        const certificado =
            await carregarCertificado(
                empresaId
            );

        const eventos =
            lerEventos();

        const anteriores =
            eventos.filter(
                evento =>
                    evento.chNFe === chave &&
                    evento.tipoEvento === tipoEvento &&
                    evento.success === true
            );

        const sequencia =
            anteriores.length + 1;

        const xmlEvento =
            montarXmlEvento({
                tpAmb,
                cnpj: cnpjLimpo,
                chNFe: chave,
                tipoEvento,
                sequencia,
                justificativa
            });

        const xmlAssinado =
            assinarEvento(
                xmlEvento,
                certificado.cert,
                certificado.key
            );

        /*
         * Lote de um único evento.
         */
        const idLote =
            String(Date.now())
                .slice(-15)
                .padStart(15, '0');

        const lote =
            `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
                `<idLote>${idLote}</idLote>` +
                xmlAssinado +
            `</envEvento>`;

        /*
         * SOAP 1.2
         */
        const soapEnvelope =
            `<?xml version="1.0" encoding="utf-8"?>` +
            `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +

                `<soap12:Header>` +
                    `<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
                        `<cUF>91</cUF>` +
                        `<versaoDados>1.00</versaoDados>` +
                    `</nfeCabecMsg>` +
                `</soap12:Header>` +

                `<soap12:Body>` +
                    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
                        lote +
                    `</nfeDadosMsg>` +
                `</soap12:Body>` +

            `</soap12:Envelope>`;

        console.log(
            `[MANIFESTACAO] XML evento tamanho: ${xmlAssinado.length}`
        );

        console.log(
            `[MANIFESTACAO] SOAP tamanho: ${soapEnvelope.length}`
        );

        console.log(
            '[MANIFESTACAO] Enviando para SEFAZ...'
        );

        let response;

        try {
            const agent =
                new https.Agent({
                    cert: certificado.cert,
                    key: certificado.key,
                    rejectUnauthorized: true,
                    minVersion: 'TLSv1.2',
                    keepAlive: false
                });

            response =
                await axios.post(
                    url,
                    soapEnvelope,
                    {
                        httpsAgent: agent,

                        timeout:
                            this.timeout,

                        maxContentLength:
                            Infinity,

                        maxBodyLength:
                            Infinity,

                        validateStatus:
                            () => true,

                        headers: {
                            'Content-Type':
                                'application/soap+xml; charset=utf-8',

                            'SOAPAction':
                                '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF"',

                            'Accept':
                                'application/soap+xml, text/xml, */*'
                        }
                    }
                );

        } catch (error) {

            const tempoMs =
                Date.now() - inicio;

            console.error(
                '[MANIFESTACAO] ❌ ERRO DE CONEXÃO:',
                error.code || '',
                error.message
            );

            return {
                id: Date.now(),
                empresaId: String(empresaId),
                chNFe: chave,
                tipoEvento,
                descricao:
                    DESCRICOES_EVENTO[tipoEvento],
                sequencia,
                ambiente: amb,
                success: false,
                cStat: null,
                xMotivo: error.message,
                protocolo: null,
                httpStatus:
                    error.response?.status || null,
                xmlEvento: xmlAssinado,
                xmlResposta:
                    String(
                        error.response?.data || ''
                    ),
                tempoMs,
                createdAt:
                    new Date().toISOString()
            };
        }

        const tempoMs =
            Date.now() - inicio;

        const xmlResposta =
            String(
                response.data || ''
            );

        const resultado =
            analisarResposta(
                xmlResposta
            );

        console.log(
            '[MANIFESTACAO] HTTP:',
            response.status
        );

        console.log(
            '[MANIFESTACAO] Content-Type:',
            response.headers?.['content-type'] || ''
        );

        console.log(
            '[MANIFESTACAO] cStat lote:',
            resultado.cStatLote
        );

        console.log(
            '[MANIFESTACAO] cStat evento:',
            resultado.cStatEvento
        );

        console.log(
            '[MANIFESTACAO] xMotivo evento:',
            resultado.xMotivoEvento
        );

        console.log(
            '[MANIFESTACAO] protocolo:',
            resultado.protocolo
        );

        console.log(
            '[MANIFESTACAO] RESPOSTA SEFAZ:'
        );

        console.log(
            xmlResposta.slice(
                0,
                15000
            )
        );

        const registro = {
            id: Date.now(),
            empresaId: String(empresaId),
            chNFe: chave,
            tipoEvento,
            descricao:
                DESCRICOES_EVENTO[tipoEvento],
            sequencia,
            ambiente: amb,
            success:
                resultado.sucesso,
            cStat:
                resultado.cStatEvento,
            xMotivo:
                resultado.xMotivoEvento,
            protocolo:
                resultado.protocolo,
            cStatLote:
                resultado.cStatLote,
            httpStatus:
                response.status,
            xmlEvento:
                xmlAssinado,
            xmlResposta,
            tempoMs,
            createdAt:
                new Date().toISOString()
        };

        eventos.push(
            registro
        );

        salvarEventos(
            eventos
        );

        try {
            const storageBase =
                process.env.NFE_STORAGE
                    ? path.resolve(
                        process.env.NFE_STORAGE
                    )
                    : path.join(
                        process.cwd(),
                        'storage',
                        'nfe'
                    );

            const dir =
                path.join(
                    storageBase,
                    'empresa',
                    String(empresaId),
                    'entrada',
                    'eventos'
                );

            fs.ensureDirSync(
                dir
            );

            fs.writeFileSync(
                path.join(
                    dir,
                    `evento-${tipoEvento}-${chave}-${sequencia}.xml`
                ),
                xmlAssinado,
                'utf8'
            );

            fs.writeFileSync(
                path.join(
                    dir,
                    `resposta-${tipoEvento}-${chave}-${sequencia}.xml`
                ),
                xmlResposta,
                'utf8'
            );

        } catch (erroStorage) {

            console.error(
                '[MANIFESTACAO] Erro ao salvar XML:',
                erroStorage.message
            );
        }

        console.log(
            '============================================'
        );

        console.log(
            resultado.sucesso
                ? ' ✅ EVENTO VINCULADO'
                : ' ❌ EVENTO NÃO VINCULADO'
        );

        console.log(
            '============================================'
        );

        return registro;
    }

    consultarHistorico(chNFe) {
        return lerEventos().filter(
            evento =>
                evento.chNFe === chNFe
        );
    }

    listarHistorico(empresaId) {
        return lerEventos()
            .filter(
                evento =>
                    String(evento.empresaId) ===
                    String(empresaId)
            )
            .map(
                ({
                    xmlEvento,
                    xmlResposta,
                    ...resto
                }) => resto
            );
    }
}

export default new NfeManifestacaoService();
