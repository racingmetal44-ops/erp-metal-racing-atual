import http from 'http';

const server = http.createServer((req, res) => {
    console.log('Request:', req.method, req.url);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        message: 'Servidor ERP Metal Racing',
        status: 'online',
        timestamp: new Date().toISOString()
    }));
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ Servidor rodando!');
    console.log('📍 http://localhost:' + PORT);
    console.log('========================================');
});

server.on('error', (err) => {
    console.error('Erro:', err.message);
});
