const Database = require('better-sqlite3');
const db = new Database('./src/backend/database/metal-racing.db');

console.log('=== TABELAS DO BANCO ===');
const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tabelas.forEach(t => console.log(' -', t.name));

console.log('\n=== ESTRUTURA DA TABELA DE ORDENS ===');
// Tenta os nomes mais comuns
const candidatos = ['production_orders', 'pcp_orders', 'ordens', 'orders', 'producao_ordens', 'erp_ordens'];
for (const nome of candidatos) {
    try {
        const info = db.prepare(`PRAGMA table_info(${nome})`).all();
        if (info.length > 0) {
            console.log(`\n>>> Tabela encontrada: ${nome}`);
            info.forEach(c => console.log(`   ${c.name} (${c.type})`));
        }
    } catch (e) {}
}

console.log('\n=== ESTRUTURA DA production_stage_history ===');
try {
    const info = db.prepare("PRAGMA table_info(production_stage_history)").all();
    info.forEach(c => console.log(`   ${c.name} (${c.type})`));
} catch (e) {
    console.log('   (não existe ainda)');
}

db.close();
