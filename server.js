import http from 'http';

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
    req.on('end', () => {
        try {
            const url = req.url;

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

            // EMITIR NF-e
            if (url === '/api/nfe/emitir' && req.method === 'POST') {
                const data = JSON.parse(body);
                console.log('📄 Emitindo NF-e para:', data.empresa?.razaoSocial);

                const numero = String(Math.floor(Math.random() * 999999) + 1).padStart(9, '0');
                const chave = '422608' + 
                              new Date().getFullYear().toString().slice(2) +
                              String(new Date().getMonth() + 1).padStart(2, '0') +
                              '13862162000180' +
                              '55' +
                              '001' +
                              numero +
                              '1' +
                              '0000000001' +
                              '1';

                const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chave}">
    <ide>
      <cUF>42</cUF>
      <cNF>12345678</cNF>
      <natOp>VENDA</natOp>
      <mod>55</mod>
      <serie>001</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${new Date().toISOString()}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>4209102</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>0</indPres>
      <procEmi>0</procEmi>
      <verProc>ERP Metal Racing 1.0</verProc>
    </ide>
    <emit>
      <CNPJ>13862162000180</CNPJ>
      <xNome>${data.empresa?.razaoSocial || 'ART GRAV COMUNICACAO INDUSTRIAL LTDA'}</xNome>
    </emit>
    <dest>
      <CNPJ>${data.cliente?.cnpj?.replace(/[^\d]/g, '') || '12345678000199'}</CNPJ>
      <xNome>${data.cliente?.nome || 'Cliente Teste'}</xNome>
    </dest>
    <total>
      <ICMSTot>
        <vNF>259.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'NF-e emitida com sucesso',
                    nfe: {
                        numero: numero,
                        serie: '001',
                        modelo: '55',
                        chave: chave,
                        status: 'AUTORIZADA',
                        protocolo: Date.now().toString().padStart(15, '0'),
                        data: new Date().toISOString(),
                        xml: xml
                    }
                }));
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
});

server.on('error', (err) => {
    console.error('❌ Erro no servidor:', err.message);
});
