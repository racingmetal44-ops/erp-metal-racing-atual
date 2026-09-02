import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import NfeSoapService from '../services/nfe/NfeSoapService.js';
import NfeXmlService from '../services/nfe/NfeXmlService.js';
import NfeSignatureService from '../services/nfe/NfeSignatureService.js';
import NfePreValidationService from '../services/nfe/NfePreValidationService.js';
import NfeSchemaValidatorService from '../services/nfe/NfeSchemaValidatorService.js';
import DanfeService from '../services/nfe/DanfeService.js';
import { buscarEmpresa, reservarNumeroNFe } from '../services/empresa/EmpresaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const nfeXmlService =
    NfeXmlService;

const nfeSignatureService =
    new NfeSignatureService();

const danfeService = DanfeService;

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'nfe');

// ============================================
// ARMAZENAMENTO
// ============================================

const DATA_DIR = path.join(process.cwd(), 'data');
const NFE_FILE = path.join(DATA_DIR, 'nfe.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(NFE_FILE)) {
    fs.writeJsonSync(NFE_FILE, []);
}

function getNFe() {
    try {
        return fs.readJsonSync(NFE_FILE);
    } catch (error) {
        console.error('[NFE] Erro ao ler nfe.json:', error.message);
        return [];
    }
}

function saveNFe(nfeList) {
    fs.writeJsonSync(NFE_FILE, nfeList, { spaces: 2 });
}

function montarXmlAutorizado(xmlAssinado, protocoloXml) {
    const nfeSemDeclaracao = String(xmlAssinado)
        .replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, '')
        .trim();

    return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeSemDeclaracao}${protocoloXml}</nfeProc>`;
}

function extrairProtocolo(respostaSefaz) {
    const xml = String(respostaSefaz || '');
    const match = xml.match(/<protNFe[\s\S]*?<\/protNFe>/i);
    return match ? match[0] : null;
}

async function salvarArquivoFiscal(empresaId, chave, conteudo, sufixo) {
    const dir = path.join(STORAGE_DIR, `empresa_${empresaId}`);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `${chave}${sufixo}`);
    await fs.writeFile(filePath, conteudo, 'utf8');
    return filePath;
}

// ============================================
// ROTAS
// ============================================

// ============================================
// LISTAR NF-e
// ============================================

router.get('/', (req, res) => {
    try {
        const nfeList = getNFe();

        res.json(nfeList);

    } catch (error) {

        console.error(
            '[NFE] Erro ao listar NF-e:',
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// EMITIR NF-e
// ============================================

router.post('/emitir', async (req, res) => {

    const inicio = Date.now();

    try {

        const {
            empresa_id,
            cliente,
            produtos,
            total,
            numero,
            serie,
            natureza_operacao,
            observacao,
            ambiente = 'homologacao',
            pagamento,
            modFrete
        } = req.body;

        // =====================================================
        // 1. RECEBER EMPRESA
        // =====================================================

        if (!empresa_id) {
            return res.status(400).json({
                success: false,
                error: 'Empresa não informada.'
            });
        }

        // =====================================================
        // 2. BUSCAR EMPRESA
        // =====================================================

        const empresa = buscarEmpresa(empresa_id);

        if (!empresa) {
            return res.status(404).json({
                success: false,
                error:
                    `Empresa ${empresa_id} não encontrada.`
            });
        }

        console.log(
            '[NFE] Empresa encontrada:',
            empresa.razaoSocial || empresa.nomeFantasia || empresa.id
        );

        // =====================================================
        // 3. VALIDAR CERTIFICADO
        // =====================================================

        const certificado =
            await NfeSoapService.carregarCertificado(
                empresa_id
            );

        if (
            !certificado ||
            !certificado.cert ||
            !certificado.key
        ) {
            throw new Error(
                'Certificado A1 não está disponível para a empresa.'
            );
        }

        console.log(
            '[NFE] Certificado A1 validado.'
        );

        // =====================================================
        // 4. RECEBER CLIENTE
        // =====================================================

        if (!cliente) {
            return res.status(400).json({
                success: false,
                error: 'Cliente não informado.'
            });
        }

        // =====================================================
        // 5. RECEBER PRODUTOS
        // =====================================================

        if (
            !Array.isArray(produtos) ||
            produtos.length === 0
        ) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum produto informado.'
            });
        }

        // =====================================================
        // 6. NÚMERO E SÉRIE
        // =====================================================

        const serieFinal =
            serie === undefined ||
            serie === null ||
            String(serie).trim() === ''
                ? String(empresa.nfe?.serie || 1)
                : String(serie);

        const numeroInformado =
            numero !== undefined &&
            numero !== null &&
            String(numero).trim() !== '';

        const numeroFinalInicial =
            numeroInformado
                ? String(numero)
                : null;

        console.log(
            '[NFE] Número informado:',
            numeroFinalInicial || '(automático)'
        );

        console.log(
            '[NFE] Série:',
            serieFinal
        );

        const ambienteFinal =
            ambiente === 'producao'
                ? 'producao'
                : 'homologacao';

        const preValidacao = NfePreValidationService.validar(
            empresa,
            cliente,
            produtos,
            {
                ambiente: ambienteFinal,
                numero: numeroFinalInicial,
                serie: serieFinal
            }
        );

        if (!preValidacao.valido) {
            return res.status(422).json({
                success: false,
                autorizado: false,
                etapa: 'PRE_VALIDACAO',
                ...preValidacao
            });
        }

        const numeroFinal =
            numeroInformado
                ? String(numero)
                : reservarNumeroNFe(
                    empresa_id,
                    serieFinal
                );

        console.log(
            '[NFE] Número reservado:',
            numeroFinal
        );

        console.log(
            '[NFE] Série:',
            serieFinal
        );

        console.log(
            '[NFE] Ambiente:',
            ambienteFinal
        );

        // =====================================================
        // 7. GERAR XML
        // =====================================================

        console.log(
            '[NFE] Gerando XML NF-e 4.00...'
        );

        const xml =
            nfeXmlService.gerarXml(
                empresa,
                cliente,
                produtos,
                ambienteFinal,
                serieFinal,
                numeroFinal,
                {
                    naturezaOperacao:
                        natureza_operacao,

                    observacao,

                    pagamento,

                    modFrete
                }
            );

        if (
            !xml ||
            !xml.includes('<infNFe')
        ) {
            throw new Error(
                'NfeXmlService não gerou uma NF-e válida.'
            );
        }

        const schemaValidacao = NfeSchemaValidatorService.validar(xml);
        if (!schemaValidacao.valido) {
            return res.status(422).json({ success: false, autorizado: false, etapa: 'XSD', ...schemaValidacao });
        }

        // =====================================================
        // EXTRAIR CHAVE
        // =====================================================

        const chaveMatch =
            xml.match(
                /<infNFe\b[^>]*\bId="NFe(\d{44})"/i
            );

        if (!chaveMatch) {
            throw new Error(
                'Não foi possível extrair a chave de acesso do XML.'
            );
        }

        const chaveAcesso =
            chaveMatch[1];

        console.log(
            '[NFE] Chave:',
            chaveAcesso
        );

        // =====================================================
        // 8. ASSINAR XML
        // =====================================================

        console.log(
            '[NFE] Assinando XML...'
        );

        const xmlAssinado =
            await nfeSignatureService.assinarXml(
                xml,
                empresa_id
            );

        if (
            !xmlAssinado.includes('<Signature') &&
            !xmlAssinado.includes('<ds:Signature')
        ) {
            throw new Error(
                'A assinatura não foi encontrada no XML assinado.'
            );
        }

        console.log(
            '[NFE] XML assinado.'
        );

        // =====================================================
        // 9. VALIDAR ASSINATURA
        // =====================================================

        const validacao =
            await nfeSignatureService.validarAssinatura(
                xmlAssinado
            );

        if (!validacao.valido) {
            throw new Error(
                validacao.mensagem ||
                'Falha na validação da assinatura.'
            );
        }

        console.log(
            '[NFE] Assinatura validada.'
        );

        // =====================================================
        // 10. ENVIAR À SEFAZ
        // =====================================================

        console.log(
            '[NFE] Enviando XML assinado à SEFAZ...'
        );

        const envio =
            await NfeSoapService.enviar(
                xmlAssinado,
                empresa_id,
                ambienteFinal
            );

        console.log(
            '[NFE] SEFAZ cStat:',
            envio.cStat
        );

        console.log(
            '[NFE] SEFAZ xMotivo:',
            envio.xMotivo
        );

        // =====================================================
        // 11. PROCESSAR RESULTADO
        // =====================================================

        let resultadoFinal =
            envio;

        if (
            envio.cStat === '103' &&
            envio.nRec
        ) {

            console.log(
                '[NFE] Lote recebido.'
            );

            console.log(
                '[NFE] nRec:',
                envio.nRec
            );

            resultadoFinal =
                await NfeSoapService.consultarRecibo(
                    envio.nRec,
                    empresa_id,
                    ambienteFinal
                );

        }

        const autorizado =
    String(
        resultadoFinal.cStatNFe ||
        resultadoFinal.cStat ||
        ''
    ) === '100';

        const protocoloXml =
            extrairProtocolo(
                resultadoFinal.respostaSefaz ||
                envio.respostaSefaz
            );

        let xmlAutorizado = null;
        let danfeHtml = null;
        let arquivoXmlAutorizado = null;
        let arquivoDanfe = null;

        if (autorizado && protocoloXml) {
            xmlAutorizado =
                montarXmlAutorizado(
                    xmlAssinado,
                    protocoloXml
                );

            danfeHtml =
                danfeService.gerarHtml(
                    xmlAssinado,
                    {
                        status: 'AUTORIZADA',
                        protocolo:
                            resultadoFinal.nProt
                    }
                );

            arquivoXmlAutorizado =
                await salvarArquivoFiscal(
                    empresa_id,
                    chaveAcesso,
                    xmlAutorizado,
                    '-procNFe.xml'
                );

            arquivoDanfe =
                await salvarArquivoFiscal(
                    empresa_id,
                    chaveAcesso,
                    danfeHtml,
                    '-danfe.html'
                );
        }

        let status;

        if (autorizado) {
            status = 'AUTORIZADA';
        }
        else if (
            resultadoFinal.cStat === '103' ||
            resultadoFinal.cStat === '105'
        ) {
            status = 'PROCESSANDO';
        }
        else {
            status = 'REJEITADA';
        }

        // =====================================================
        // 12. PREPARAR REGISTRO
        // =====================================================

        const totalCalculado =
            produtos.reduce(
                (soma, produto) => {

                    const quantidade =
                        Number(
                            produto.quantidade || 0
                        );

                    const valorUnitario =
                        Number(
                            produto.valorUnitario ??
                            produto.valor_unitario ??
                            0
                        );

                    return soma +
                        quantidade *
                        valorUnitario;
                },
                0
            );

        const agora =
            new Date().toISOString();

        const nfe = {

            id:
                Date.now(),

            empresa_id:
                String(empresa_id),

            numero:
                numeroFinal,

            serie:
                serieFinal,

            cliente,

            produtos,

            total:
                total !== undefined &&
                total !== null
                    ? Number(total)
                    : totalCalculado,

            natureza_operacao:
                natureza_operacao ||
                'VENDA DE MERCADORIA',

            observacao:
                observacao || '',

            ambiente:
                ambienteFinal,

            status,

            chave_acesso:
                chaveAcesso,

            cStat:
                resultadoFinal.cStat ||
                null,

            cStatLote: resultadoFinal.cStatLote || null,
            xMotivoLote: resultadoFinal.xMotivoLote || null,
            cStatNFe: resultadoFinal.cStatNFe || resultadoFinal.cStat || null,
            xMotivoNFe: resultadoFinal.xMotivoNFe || resultadoFinal.xMotivo || null,

            xMotivo:
                resultadoFinal.xMotivo ||
                null,

            nRec:
                envio.nRec ||
                resultadoFinal.nRec ||
                null,

            nProt:
                resultadoFinal.nProt ||
                null,

            dhRecbto:
                resultadoFinal.dhRecbto ||
                null,

            tpAmb:
                resultadoFinal.tpAmb ||
                (
                    ambienteFinal === 'producao'
                        ? '1'
                        : '2'
                ),

            xml:
                xml,

            xmlAssinado:
                xmlAssinado,

            xmlAutorizado:
                xmlAutorizado,

            danfeHtml:
                danfeHtml,

            arquivoXmlAutorizado:
                arquivoXmlAutorizado,

            arquivoDanfe:
                arquivoDanfe,

            respostaSefaz:
                resultadoFinal.respostaSefaz ||
                envio.respostaSefaz ||
                null,

            tempoMs:
                Date.now() - inicio,

            data_emissao:
                agora,

            created_at:
                agora,

            updated_at:
                agora
        };

        // =====================================================
        // 13. SALVAR
        // =====================================================

        const nfeList =
            getNFe();

        nfeList.push(
            nfe
        );

        saveNFe(
            nfeList
        );

        // =====================================================
        // 14. LOG FINAL
        // =====================================================

        console.log('');
        console.log(
            '============================================'
        );

        console.log(
            autorizado
                ? '✅ NF-e AUTORIZADA'
                : `❌ NF-e ${status}`
        );

        console.log(
            '============================================'
        );

        console.log(
            '[NFE] Chave:',
            chaveAcesso
        );

        console.log(
            '[NFE] cStat:',
            resultadoFinal.cStat
        );

        console.log(
            '[NFE] Protocolo:',
            resultadoFinal.nProt || 'não informado'
        );

        // =====================================================
        // 15. RETORNAR FRONTEND
        // =====================================================

        return res.status(
            autorizado
                ? 200
                : 422
        ).json({

            success:
                autorizado,

            autorizado,

            data:
                nfe,

            sefaz:
                resultadoFinal,

            message:
                autorizado
                    ? 'NF-e autorizada pela SEFAZ.'
                    : `NF-e ${status}: ${
                        resultadoFinal.xMotivo ||
                        'Motivo não informado.'
                    }`

        });

    }
    catch (error) {

        console.error('');
        console.error(
            '============================================'
        );

        console.error(
            '❌ ERRO NO FLUXO DE EMISSÃO NF-e'
        );

        console.error(
            '============================================'
        );

        console.error(
            error
        );

        return res.status(500).json({

            success:
                false,

            autorizado:
                false,

            error:
                error.message,

            message:
                'Erro durante o processo real de emissão da NF-e.'
        });

    }

});

// ============================================
// GERAR NF-e SEM TRANSMITIR PARA A SEFAZ
// ============================================

router.post('/gerar', async (req, res) => {

    const inicio = Date.now();

    try {

        const {
            empresa_id,
            ambiente = 'homologacao',
            numero,
            serie = '1',
            cliente,
            produtos = [],
            natureza_operacao,
            observacao
        } = req.body || {};

        if (!empresa_id) {
            return res.status(400).json({
                success: false,
                error: 'Empresa não informada.'
            });
        }

        if (!cliente) {
            return res.status(400).json({
                success: false,
                error: 'Destinatário não informado.'
            });
        }

        if (!Array.isArray(produtos) || produtos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum produto informado.'
            });
        }

        const empresa =
            await buscarEmpresa(
                empresa_id
            );

        if (!empresa) {
            return res.status(404).json({
                success: false,
                error: 'Empresa não encontrada.'
            });
        }

        let numeroFinal = numero;

        if (!numeroFinal) {
            numeroFinal =
                await reservarNumeroNFe(
                    empresa_id
                );
        }

        const serieFinal =
            String(
                serie ||
                empresa.serie_nfe ||
                '1'
            );

        const ambienteFinal =
            ambiente === 'producao'
                ? 'producao'
                : 'homologacao';

        console.log('');
        console.log('============================================');
        console.log('[NFE] GERANDO NF-e SEM TRANSMITIR');
        console.log('============================================');

        const xml =
            nfeXmlService.gerarXml(
                empresa,
                cliente,
                produtos,
                ambienteFinal,
                serieFinal,
                numeroFinal,
                {
                    naturezaOperacao:
                        natureza_operacao ||
                        'VENDA DE MERCADORIA'
                }
            );

        if (!xml || !xml.includes('<infNFe')) {
            throw new Error(
                'Não foi possível gerar um XML NF-e válido.'
            );
        }

        const schemaValidacao =
            NfeSchemaValidatorService.validar(
                xml
            );

        if (!schemaValidacao.valido) {
            return res.status(422).json({
                success: false,
                autorizado: false,
                etapa: 'XSD',
                ...schemaValidacao
            });
        }

        const chaveMatch =
            xml.match(
                /<infNFe\b[^>]*\bId="NFe(\d{44})"/i
            );

        if (!chaveMatch) {
            throw new Error(
                'Não foi possível extrair a chave de acesso.'
            );
        }

        const chaveAcesso =
            chaveMatch[1];

        const xmlAssinado =
            await nfeSignatureService.assinarXml(
                xml,
                empresa_id
            );

        if (
            !xmlAssinado.includes('<Signature') &&
            !xmlAssinado.includes('<ds:Signature')
        ) {
            throw new Error(
                'A assinatura não foi encontrada no XML.'
            );
        }

        const validacao =
            await nfeSignatureService.validarAssinatura(
                xmlAssinado
            );

        if (!validacao.valido) {
            throw new Error(
                validacao.mensagem ||
                'Falha na validação da assinatura.'
            );
        }

        const produtosTotal =
            produtos.reduce(
                (soma, produto) =>
                    soma +
                    (
                        Number(
                            produto.quantidade || 0
                        ) *
                        Number(
                            produto.valorUnitario ??
                            produto.valor_unitario ??
                            0
                        )
                    ),
                0
            );

        const agora =
            new Date().toISOString();

        const nfe = {

            id: Date.now(),

            empresa_id:
                String(empresa_id),

            numero:
                String(numeroFinal),

            serie:
                String(serieFinal),

            cliente,

            produtos,

            total:
                Number(produtosTotal.toFixed(2)),

            natureza_operacao:
                natureza_operacao ||
                'VENDA DE MERCADORIA',

            observacao:
                observacao || '',

            ambiente:
                ambienteFinal,

            status:
                'GERADA',

            chave_acesso:
                chaveAcesso,

            cStat:
                null,

            cStatLote:
                null,

            xMotivoLote:
                null,

            cStatNFe:
                null,

            xMotivoNFe:
                null,

            xMotivo:
                'NF-e gerada e assinada, ainda não transmitida.',

            nRec:
                null,

            nProt:
                null,

            dhRecbto:
                null,

            tpAmb:
                ambienteFinal === 'producao'
                    ? '1'
                    : '2',

            xml,

            xmlAssinado,

            xmlAutorizado:
                null,

            danfeHtml:
                null,

            arquivoXmlAutorizado:
                null,

            arquivoDanfe:
                null,

            respostaSefaz:
                null,

            tempoMs:
                Date.now() - inicio,

            data_geracao:
                agora,

            data_emissao:
                agora,

            created_at:
                agora,

            updated_at:
                agora
        };

        const nfeList =
            getNFe();

        nfeList.push(nfe);

        saveNFe(
            nfeList
        );

        console.log(
            '[NFE] NF-e gerada e armazenada:',
            nfe.numero
        );

        return res.status(201).json({

            success: true,

            autorizado: false,

            gerada: true,

            data: nfe,

            message:
                'NF-e gerada e armazenada. Ainda não foi transmitida à SEFAZ.'
        });

    }
    catch (error) {

        console.error(
            '[NFE] Erro ao gerar NF-e:',
            error
        );

        return res.status(500).json({

            success: false,

            autorizado: false,

            gerada: false,

            error:
                error.message,

            message:
                'Erro ao gerar NF-e.'
        });

    }

});

// ============================================
// DOCUMENTOS DA NF-e
// ============================================

// Abrir/visualizar DANFE HTML
router.get('/:id/danfe', async (req, res) => {

    try {

        const id =
            String(req.params.id || '');

        const nfeList =
            getNFe();

        const nfe =
            nfeList.find(
                x => String(x.id) === id
            );

        if (!nfe) {
            return res.status(404).json({
                success: false,
                error: 'NF-e não encontrada.'
            });
        }

        if (!nfe.arquivoDanfe) {

            if (!nfe.xmlAssinado) {
                return res.status(404).json({
                    success: false,
                    error: 'Esta NF-e ainda não possui DANFE gerado.'
                });
            }

            const danfeHtml =
                danfeService.gerarHtml(
                    nfe.xmlAutorizado ||
                    nfe.xmlAssinado ||
                    nfe.xml,
                    {
                        status:
                            nfe.status || 'GERADA',

                        nProt:
                            nfe.nProt || null,

                        protocolo:
                            nfe.nProt || null,

                        dhRecbto:
                            nfe.dhRecbto || null
                    }
                );

            nfe.danfeHtml =
                danfeHtml;

            nfe.arquivoDanfe =
                await salvarArquivoFiscal(
                    nfe.empresa_id,
                    nfe.chave_acesso,
                    danfeHtml,
                    '-danfe.html'
                );

            saveNFe(
                nfeList
            );
        }

        return res.sendFile(
            path.resolve(
                nfe.arquivoDanfe
            )
        );

    } catch (error) {

        console.error(
            '[NFE] Erro ao abrir DANFE:',
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error.message
        });
    }

});


// Gerar DANFE novamente e gravar no registro
router.post('/:id/gerar-danfe', async (req, res) => {

    try {

        const id =
            String(req.params.id || '');

        const nfeList =
            getNFe();

        const index =
            nfeList.findIndex(
                x => String(x.id) === id
            );

        if (index < 0) {
            return res.status(404).json({
                success: false,
                error: 'NF-e não encontrada.'
            });
        }

        const nfe =
            nfeList[index];

        if (!nfe.xmlAssinado) {
            return res.status(422).json({
                success: false,
                error:
                    'Esta NF-e não possui XML assinado.'
            });
        }

        const danfeHtml =
                danfeService.gerarHtml(
                    nfe.xmlAutorizado ||
                    nfe.xmlAssinado ||
                    nfe.xml,
                    {
                        status:
                            nfe.status || 'GERADA',

                        nProt:
                            nfe.nProt || null,

                        protocolo:
                            nfe.nProt || null,

                        dhRecbto:
                            nfe.dhRecbto || null
                    }
                );

        const arquivoDanfe =
            await salvarArquivoFiscal(
                nfe.empresa_id,
                nfe.chave_acesso,
                danfeHtml,
                '-danfe.html'
            );

        nfe.danfeHtml =
            danfeHtml;

        nfe.arquivoDanfe =
            arquivoDanfe;

        nfe.updated_at =
            new Date().toISOString();

        nfeList[index] =
            nfe;

        saveNFe(
            nfeList
        );

        return res.json({
            success: true,
            data: nfe,
            arquivoDanfe
        });

    } catch (error) {

        console.error(
            '[NFE] Erro ao gerar DANFE:',
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error.message
        });
    }

});


// Abrir XML autorizado/assinado
// ============================================
// TESTAR COMUNICAÇÃO REAL COM A SEFAZ
// ============================================

router.post('/testar-sefaz', async (req, res) => {

    const inicio = Date.now();

    try {

        const {
            empresa_id
        } = req.body;

        // ----------------------------------------
        // VALIDAR EMPRESA
        // ----------------------------------------

        if (!empresa_id) {

            return res.status(400).json({
                success: false,
                comunicacao: false,
                error: 'Empresa não informada.'
            });
        }

        console.log('');
        console.log('============================================');
        console.log('[SEFAZ] TESTE REAL DE COMUNICAÇÃO');
        console.log('============================================');

        console.log(
            '[SEFAZ] Empresa:',
            empresa_id
        );

        console.log(
            '[SEFAZ] UF:',
            'SC'
        );

        console.log(
            '[SEFAZ] Ambiente:',
            'HOMOLOGAÇÃO'
        );

        console.log(
            '[SEFAZ] Iniciando conexão com WebService...'
        );

        // ----------------------------------------
        // COMUNICAÇÃO REAL
        // ----------------------------------------

        const resultado =
            await NfeSoapService.testarStatus(
                empresa_id,
                'homologacao'
            );

        const tempoMs =
            Date.now() - inicio;

        console.log(
            '[SEFAZ] Comunicação finalizada.'
        );

        console.log(
            '[SEFAZ] cStat:',
            resultado.cStat || 'não informado'
        );

        console.log(
            '[SEFAZ] xMotivo:',
            resultado.xMotivo || 'não informado'
        );

        console.log(
            '[SEFAZ] Tempo:',
            tempoMs,
            'ms'
        );

        console.log('============================================');

        // ----------------------------------------
        // RESPONDER AO FRONTEND
        // ----------------------------------------

        res.json({

            success:
                resultado.success === true,

            comunicacao:
                resultado.success === true,

            empresa_id,

            uf:
                'SC',

            ambiente:
                'homologacao',

            cStat:
                resultado.cStat || null,

            xMotivo:
                resultado.xMotivo || null,

            tpAmb:
                resultado.tpAmb || null,

            verAplic:
                resultado.verAplic || null,

            dhRecbto:
                resultado.dhRecbto || null,

            tempoMs,

            respostaSefaz:
                resultado.respostaSefaz || null
        });

    } catch (error) {

        const tempoMs =
            Date.now() - inicio;

        console.error('');
        console.error('============================================');
        console.error('[SEFAZ] ERRO NA COMUNICAÇÃO');
        console.error('============================================');

        console.error(
            '[SEFAZ] Mensagem:',
            error.message
        );

        if (error.response) {

            console.error(
                '[SEFAZ] HTTP:',
                error.response.status
            );

            console.error(
                '[SEFAZ] Resposta:',
                String(
                    error.response.data || ''
                ).substring(0, 2000)
            );
        }

        console.error(
            '[SEFAZ] Tempo:',
            tempoMs,
            'ms'
        );

        console.error('============================================');

        res.status(500).json({

            success:
                false,

            comunicacao:
                false,

            uf:
                'SC',

            ambiente:
                'homologacao',

            tempoMs,

            error:
                error.message
        });
    }
});

// ============================================
// CANCELAR / REMOVER NF-e LOCAL
// ============================================

router.delete('/:id', (req, res) => {

    try {

        const id =
            parseInt(req.params.id, 10);

        const nfeList =
            getNFe();

        const filtered =
            nfeList.filter(
                nfe => nfe.id !== id
            );

        if (
            filtered.length ===
            nfeList.length
        ) {

            return res.status(404).json({

                success: false,

                error:
                    'NF-e não encontrada.'
            });
        }

        saveNFe(filtered);

        res.json({

            success: true,

            message:
                'NF-e removida com sucesso.'
        });

    } catch (error) {

        console.error(
            '[NFE] Erro ao remover NF-e:',
            error.message
        );

        res.status(500).json({

            success: false,

            error:
                error.message
        });
    }
});

// ============================================
// EXPORT
// ============================================

export default router;


