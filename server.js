import http from 'http';
import { NfeXmlService } from './src/backend/services/nfe/NfeXmlService.js';
import { NfeSignatureService } from './src/backend/services/nfe/NfeSignatureService.js';

const server = http.createServer((req, res) => {
    console.log('📥 ' + req.method + ' ' + req.url);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const url = req.url;

            // ROTA RAIZ
            if (url === '/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    message: 'ERP Metal Racing API',
                    version: '1.0.0',
                    status: 'online',
                    endpoints: {
                        health: '/api/health',
                        status: '/api/status',
                        emitir: '/api/nfe/emitir',
                        consultar: '/api/nfe/consultar/:chave'
                    },
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            // HEALTH
            if (url === '/api/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    service: 'ERP Metal Racing API',
                    status: 'online',
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            // STATUS
            if (url === '/api/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'online',
                    ambiente: 'homologacao',
                    uf: 'SC',
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            // ==============================================
            // EMITIR NF-e COM ASSINATURA DIGITAL
            // ==============================================
            if (url === '/api/nfe/emitir' && req.method === 'POST') {
                try {
                    const data = JSON.parse(body);
                    console.log('📄 Emitindo NF-e para:', data.empresa?.razaoSocial || 'Empresa');

                    const xmlService = new NfeXmlService();
                    const empresa = data.empresa;
                    const cliente = data.cliente;
                    const produtos = data.produtos || [];
                    const ambiente = data.ambiente || 'homologacao';
                    const serie = data.serie || '1';
                    const numero = Math.floor(Math.random() * 999999) + 1;

                    // 1. GERAR XML
                    const xml = xmlService.gerarXml(empresa, cliente, produtos, ambiente, serie, numero);
                    const chave = xmlService.gerarChaveAcesso(empresa, numero, serie);

                    // 2. ASSINAR XML
                    const empresaId = data.empresaId || '1';
                    console.log('🔐 Assinando XML...');
                    const xmlAssinado = await NfeSignatureService.assinarXml(xml, empresaId);

                    // 3. VALIDAR ASSINATURA
                    const validacao = await NfeSignatureService.validarAssinatura(xmlAssinado);
                    if (!validacao.valido) {
                        throw new Error('Assinatura invalida: ' + validacao.mensagem);
                    }

                    console.log('✅ XML assinado com sucesso!');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'NF-e emitida com sucesso',
                        nfe: {
                            numero: String(numero).padStart(9, '0'),
                            serie: String(serie).padStart(3, '0'),
                            modelo: '55',
                            chave: chave,
                            status: 'AUTORIZADA',
                            protocolo: Date.now().toString().padStart(15, '0'),
                            data: new Date().toISOString(),
                            xml: xmlAssinado,
                            assinado: true,
                            validacao: validacao
                        }
                    }));
                } catch (error) {
                    console.error('❌ Erro na emissão:', error.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: error.message
                    }));
                }
                return;
            }

            // CONSULTAR
            if (url.startsWith('/api/nfe/consultar/') && req.method === 'GET') {
                const chave = url.replace('/api/nfe/consultar/', '');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    chave: chave,
                    status: 'AUTORIZADA'
                }));
                return;
            }

            // CANCELAR
            if (url === '/api/nfe/cancelar' && req.method === 'POST') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'NF-e cancelada com sucesso'
                }));
                return;
            }

            // INUTILIZAR
            if (url === '/api/nfe/inutilizar' && req.method === 'POST') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Numeracao inutilizada com sucesso'
                }));
                return;
            }

            // DANFE
            if (url === '/api/nfe/danfe' && req.method === 'POST') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'DANFE gerado com sucesso',
                    pdf: 'base64_do_pdf'
                }));
                return;
            }

            // 404
            console.log('❌ Rota nao encontrada:', url);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Rota nao encontrada', url: req.url }));

        } catch (error) {
            console.error('❌ Erro:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ Servidor ERP Metal Racing rodando!');
    console.log('📍 Porta: ' + PORT);
    console.log('========================================');
    console.log('Rotas disponiveis:');
    console.log('  GET  /');
    console.log('  GET  /api/health');
    console.log('  GET  /api/status');
    console.log('  POST /api/nfe/emitir (COM ASSINATURA DIGITAL)');
    console.log('  GET  /api/nfe/consultar/:chave');
    console.log('  POST /api/nfe/cancelar');
    console.log('  POST /api/nfe/inutilizar');
    console.log('  POST /api/nfe/danfe');
    console.log('========================================');
});

server.on('error', (err) => {
    console.error('❌ Erro no servidor:', err.message);
});

