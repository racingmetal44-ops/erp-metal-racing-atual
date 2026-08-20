import 'dotenv/config';
import http from 'http';
import { NfeXmlService } from './src/backend/services/nfe/NfeXmlService.js';
import NfeSignatureService from './src/backend/services/nfe/NfeSignatureService.js';

const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';

function sendJson(res, status, data) {
    if (res.headersSent) return;

    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    console.log(`[API] ${req.method} ${req.url}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const url = new URL(
                req.url || '/',
                `http://${req.headers.host || 'localhost'}`
            );

            const pathname = url.pathname;

            // ==========================================
            // RAIZ
            // ==========================================

            if (req.method === 'GET' && pathname === '/') {
                sendJson(res, 200, {
                    success: true,
                    message: 'ERP Metal Racing API',
                    version: '1.0.0',
                    status: 'online',
                    port: PORT
                });
                return;
            }

            // ==========================================
            // HEALTH
            // ==========================================

            if (req.method === 'GET' && pathname === '/api/health') {
                sendJson(res, 200, {
                    success: true,
                    service: 'ERP Metal Racing API',
                    status: 'online',
                    port: PORT,
                    host: HOST,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // ==========================================
            // STATUS
            // ==========================================

            if (req.method === 'GET' && pathname === '/api/status') {
                sendJson(res, 200, {
                    success: true,
                    status: 'online',
                    ambiente: process.env.AMBIENTE || 'homologacao',
                    uf: process.env.UF || 'SC',
                    porta: PORT,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // ==========================================
            // TESTE
            // ==========================================

            if (req.method === 'GET' && pathname === '/api/test') {
                sendJson(res, 200, {
                    success: true,
                    message: 'Backend funcionando corretamente'
                });
                return;
            }

            // ==========================================
            // NF-e - TESTE DA ROTA
            // ==========================================

            if (req.method === 'POST' && pathname === '/api/nfe/emitir') {

    let data = {};

    try {
        data = body ? JSON.parse(body) : {};
    } catch (error) {
        sendJson(res, 400, {
            success: false,
            error: 'JSON inválido',
            detalhe: error.message
        });
        return;
    }

    console.log('[NFE] Solicitação recebida');
    console.log('[NFE] Empresa ID:', data.empresaId);

    try {

        const empresaId = data.empresaId || '1';
        const ambiente = data.ambiente || 'homologacao';
        const empresa = data.empresa || {};
        const cliente = data.cliente || {};
        const produtos = data.produtos || [];
        const serie = data.serie || '1';

        console.log('[NFE] Gerando XML...');
        
        const xmlService = new NfeXmlService();

        const numero = Math.floor(Math.random() * 999999) + 1;

        const xml = xmlService.gerarXml(
            empresa,
            cliente,
            produtos,
            ambiente,
            serie,
            numero
        );

        console.log('[NFE] XML gerado.');

        console.log('[NFE] Assinando XML com certificado A1...');

        const xmlAssinado = await NfeSignatureService.assinarXml(
            xml,
            empresaId
        );

        console.log('[NFE] XML assinado.');

        const validacao = await NfeSignatureService.validarAssinatura(
            xmlAssinado
        );

        if (!validacao.valido) {
            throw new Error(
                'Assinatura XML inválida: ' + validacao.mensagem
            );
        }

        console.log('[NFE] Assinatura validada.');

        let chave = null;

        try {
            chave = xmlService.gerarChaveAcesso(
                empresa,
                numero,
                serie
            );
        } catch (erroChave) {
            console.log(
                '[NFE] Não foi possível gerar chave:',
                erroChave.message
            );
        }

        sendJson(res, 200, {
            success: true,
            etapa: 'XML_ASSINADO',
            status: 'XML_ASSINADO',
            mensagem: 'NF-e gerada e assinada digitalmente com certificado A1.',
            empresaId,
            ambiente,
            nfe: {
                numero: String(numero).padStart(9, '0'),
                serie: String(serie).padStart(3, '0'),
                modelo: '55',
                chave,
                xml: xmlAssinado,
                assinado: true,
                validacao
            }
        });

    } catch (error) {

        console.error('[NFE] ERRO:', error);

        sendJson(res, 500, {
            success: false,
            etapa: 'ERRO_ASSINATURA',
            status: 'ERRO',
            mensagem: error.message,
            detalhe: error.stack
        });

    }

    return;
}
// ==========================================
            // CONSULTAR NF-e
            // ==========================================

            if (
                req.method === 'GET' &&
                pathname.startsWith('/api/nfe/consultar/')
            ) {
                const chave = pathname.replace('/api/nfe/consultar/', '');

                sendJson(res, 501, {
                    success: false,
                    status: 'NAO_CONSULTADA',
                    chave,
                    message: 'Consulta SEFAZ ainda não implementada.'
                });

                return;
            }

            // ==========================================
            // CANCELAR
            // ==========================================

            if (req.method === 'POST' && pathname === '/api/nfe/cancelar') {
                sendJson(res, 501, {
                    success: false,
                    message: 'Cancelamento SEFAZ ainda não implementado.'
                });
                return;
            }

            // ==========================================
            // INUTILIZAR
            // ==========================================

            if (req.method === 'POST' && pathname === '/api/nfe/inutilizar') {
                sendJson(res, 501, {
                    success: false,
                    message: 'Inutilização SEFAZ ainda não implementada.'
                });
                return;
            }

            // ==========================================
            // DANFE
            // ==========================================

            if (req.method === 'POST' && pathname === '/api/nfe/danfe') {
                sendJson(res, 501, {
                    success: false,
                    message: 'DANFE será gerado somente após NF-e autorizada.'
                });
                return;
            }

            // ==========================================
            // ROTA NÃO ENCONTRADA
            // ==========================================

            sendJson(res, 404, {
                success: false,
                error: 'Rota não encontrada',
                method: req.method,
                url: req.url
            });

        } catch (error) {
            console.error('[API] Erro:', error);

            sendJson(res, 500, {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : String(error)
            });
        }
    });

    req.on('error', error => {
        console.error('[API] Erro na requisição:', error);
    });
});

server.on('error', error => {
    console.error('========================================');
    console.error('ERRO AO INICIAR O SERVIDOR');
    console.error('========================================');
    console.error(error);

    if (error.code === 'EADDRINUSE') {
        console.error(`A porta ${PORT} já está sendo utilizada.`);
    }
});

server.listen(PORT, HOST, () => {
    console.log('');
    console.log('========================================');
    console.log(' ERP METAL RACING API');
    console.log('========================================');
    console.log(' Status: ONLINE');
    console.log(` Host: ${HOST}`);
    console.log(` Porta: ${PORT}`);
    console.log(` Local: http://127.0.0.1:${PORT}`);
    console.log(` Health: http://127.0.0.1:${PORT}/api/health`);
    console.log(` Status: http://127.0.0.1:${PORT}/api/status`);
    console.log('========================================');
    console.log('');
});

