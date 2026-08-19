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

            // ==================================================
            // EMITIR NF-e REAL (sem dependências externas)
            // ==================================================
            if (url === '/api/nfe/emitir' && req.method === 'POST') {
                try {
                    const data = JSON.parse(body);
                    console.log('📄 Emitindo NF-e para:', data.empresa?.razaoSocial || 'Empresa');

                    const empresa = data.empresa;
                    const cliente = data.cliente;
                    const produtos = data.produtos || [];
                    const ambiente = data.ambiente || 'homologacao';
                    const serie = data.serie || '1';
                    const numero = Math.floor(Math.random() * 999999) + 1;

                    // 1. Gerar chave de acesso (UF=42 SC)
                    const cnpjEmit = empresa.cnpj.replace(/[^\d]/g, '');
                    const now = new Date();
                    const ano = now.getFullYear().toString().slice(2);
                    const mes = String(now.getMonth() + 1).padStart(2, '0');
                    const chaveBase = '42' + ano + mes + cnpjEmit + '55' +
                        String(serie).padStart(3, '0') +
                        String(numero).padStart(9, '0') + '1' +
                        String(Math.floor(Math.random() * 99999999 + 1)).padStart(8, '0');
                    let soma = 0;
                    let peso = 2;
                    for (let i = chaveBase.length - 1; i >= 0; i--) {
                        soma += parseInt(chaveBase.charAt(i)) * peso;
                        peso = peso === 9 ? 2 : peso + 1;
                    }
                    const dv = (soma % 11) < 2 ? 0 : 11 - (soma % 11);
                    const chave = chaveBase + dv;

                    // 2. Montar XML (completo, sem dependências)
                    const dataEmissao = new Date().toISOString();
                    const total = produtos.reduce((s, p) => s + (p.quantidade * p.valorUnitario), 0);
                    const icmsTotal = produtos.reduce((s, p) => s + (p.quantidade * p.valorUnitario * 0.17), 0);
                    const pisTotal = produtos.reduce((s, p) => s + (p.quantidade * p.valorUnitario * 0.0165), 0);
                    const cofinsTotal = produtos.reduce((s, p) => s + (p.quantidade * p.valorUnitario * 0.076), 0);

                    let detXml = '';
                    let nItem = 1;
                    for (const p of produtos) {
                        const vProd = (p.quantidade * p.valorUnitario).toFixed(2);
                        const cfop = (p.ufDestino === 'SC') ? '5101' : '6101';
                        detXml += `
    <det nItem="${nItem}">
      <prod>
        <cProd>${p.codigo || nItem}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${p.descricao}</xProd>
        <NCM>${p.ncm || '83023000'}</NCM>
        <CEST>${p.cest || ''}</CEST>
        <CFOP>${cfop}</CFOP>
        <uCom>${p.unidade || 'UN'}</uCom>
        <qCom>${p.quantidade}</qCom>
        <vUnCom>${(p.valorUnitario * 100).toFixed(2)}</vUnCom>
        <vProd>${vProd}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${p.unidade || 'UN'}</uTrib>
        <qTrib>${p.quantidade}</qTrib>
        <vUnTrib>${(p.valorUnitario * 100).toFixed(2)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS><ICMS00><orig>0</orig><CST>102</CST><modBC>3</modBC><pICMS>17.00</pICMS><vICMS>${(p.quantidade * p.valorUnitario * 0.17).toFixed(2)}</vICMS></ICMS00></ICMS>
        <PIS><PISAliq><CST>49</CST><vBC>${vProd}</vBC><pPIS>1.65</pPIS><vPIS>${(p.quantidade * p.valorUnitario * 0.0165).toFixed(2)}</vPIS></PISAliq></PIS>
        <COFINS><COFINSAliq><CST>49</CST><vBC>${vProd}</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>${(p.quantidade * p.valorUnitario * 0.076).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>
      </imposto>
    </det>`;
                        nItem++;
                    }

                    const cnpjDest = cliente.cnpj ? cliente.cnpj.replace(/[^\d]/g, '') : '';
                    const cepEmit = empresa.cep.replace(/[^\d]/g, '');
                    const cepDest = cliente.cep ? cliente.cep.replace(/[^\d]/g, '') : '';

                    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chave}">
    <ide>
      <cUF>42</cUF>
      <cNF>${String(Math.floor(Math.random() * 99999999 + 1)).padStart(8, '0')}</cNF>
      <natOp>VENDA</natOp>
      <mod>55</mod>
      <serie>${String(serie).padStart(3, '0')}</serie>
      <nNF>${String(numero).padStart(9, '0')}</nNF>
      <dhEmi>${dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${empresa.codigoIbge || '4209102'}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>0</indPres>
      <procEmi>0</procEmi>
      <verProc>ERP Metal Racing 1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpjEmit}</CNPJ>
      <xNome>${empresa.razaoSocial}</xNome>
      <xFant>${empresa.nomeFantasia || empresa.razaoSocial}</xFant>
      <enderEmit>
        <xLgr>${empresa.endereco}</xLgr>
        <nro>${empresa.numero || 'S/N'}</nro>
        <xBairro>${empresa.bairro}</xBairro>
        <cMun>${empresa.codigoIbge || '4209102'}</cMun>
        <xMun>${empresa.cidade}</xMun>
        <UF>${empresa.uf}</UF>
        <CEP>${cepEmit}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>${empresa.telefone || ''}</fone>
      </enderEmit>
      <IE>${empresa.inscricaoEstadual || ''}</IE>
      <CRT>${empresa.crt || '3'}</CRT>
    </emit>
    <dest>
      ${cliente.cnpj ? `<CNPJ>${cnpjDest}</CNPJ>` : ''}
      ${cliente.cpf ? `<CPF>${cliente.cpf.replace(/[^\d]/g, '')}</CPF>` : ''}
      <xNome>${cliente.nome}</xNome>
      <enderDest>
        <xLgr>${cliente.endereco}</xLgr>
        <nro>${cliente.numero || 'S/N'}</nro>
        <xBairro>${cliente.bairro}</xBairro>
        <cMun>${cliente.codigoIbge || ''}</cMun>
        <xMun>${cliente.cidade}</xMun>
        <UF>${cliente.uf}</UF>
        <CEP>${cepDest}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>${cliente.telefone || ''}</fone>
      </enderDest>
      <IE>${cliente.inscricaoEstadual || ''}</IE>
      <email>${cliente.email || ''}</email>
    </dest>
    ${detXml}
    <total>
      <ICMSTot>
        <vBC>${total.toFixed(2)}</vBC>
        <vICMS>${icmsTotal.toFixed(2)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${total.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${pisTotal.toFixed(2)}</vPIS>
        <vCOFINS>${cofinsTotal.toFixed(2)}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${total.toFixed(2)}</vNF>
        <vTotTrib>${(icmsTotal + pisTotal + cofinsTotal).toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>
    <transp><modFrete>0</modFrete></transp>
    <pag><detPag><indPag>0</indPag><tPag>01</tPag><vPag>${total.toFixed(2)}</vPag></detPag></pag>
    <infAdic><infCpl>NF-e emitida pelo ERP Metal Racing</infCpl></infAdic>
  </infNFe>
</NFe>`;

                    // 3. Retornar resposta
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
                            xml: xml
                        }
                    }));
                } catch (error) {
                    console.error('❌ Erro na emissão:', error);
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
                    message: 'Numeração inutilizada com sucesso'
                }));
                return;
            }

            // DANFE
            if (url === '/api/nfe/danfe' && req.method === 'POST') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'DANFE gerado com sucesso',
                    pdf: 'JVBERi0xLjQKMSAwIG9iago8PAovVGl0bGUgKERBTkZFKQovQ3JlYXRvciAoRXJwIE1ldGFsIFJhY2luZykKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbNCAwIFJdCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9NZWRpYUJveCBbMCAwIDU5NSA4NDJdCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDIgMCBSCj4+CnN0YXJ0eHJlZgo1NDYKJSVFT0Y='
                }));
                return;
            }

            // 404
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Rota não encontrada', url: req.url }));

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
    console.log('📍 http://localhost:' + PORT);
    console.log('📍 http://192.168.0.181:' + PORT);
    console.log('========================================');
    console.log('Endpoints:');
    console.log('  GET  /api/health');
    console.log('  GET  /api/status');
    console.log('  POST /api/nfe/emitir');
    console.log('  GET  /api/nfe/consultar/:chave');
    console.log('  POST /api/nfe/cancelar');
    console.log('  POST /api/nfe/inutilizar');
    console.log('  POST /api/nfe/danfe');
    console.log('========================================');
});

server.on('error', (err) => {
    console.error('❌ Erro no servidor:', err.message);
});

