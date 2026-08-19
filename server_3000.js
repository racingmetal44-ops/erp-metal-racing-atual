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
    
    if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            service: 'ERP Metal Racing API',
            status: 'online',
            timestamp: new Date().toISOString()
        }));
        return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'ERP Metal Racing', status: 'online' }));
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Servidor rodando na porta ' + PORT);
});

server.on('error', (err) => {
    console.error('Erro:', err.message);
});
