const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        message: 'Servidor funcionando!',
        status: 'online',
        timestamp: new Date().toISOString()
    }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Servidor mínimo rodando na porta ' + PORT);
});

server.on('error', (err) => {
    console.error('❌ Erro:', err.message);
});
