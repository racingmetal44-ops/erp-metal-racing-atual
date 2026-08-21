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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        message: 'Servidor ERP Metal Racing',
        status: 'online',
        timestamp: new Date().toISOString()
    }));
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ Servidor rodando!');
    console.log('📍 http://localhost:' + PORT);
    console.log('📍 http://127.0.0.1:' + PORT);
    console.log('========================================');
});

server.on('error', (err) => {
    console.error('❌ Erro:', err.message);
});
