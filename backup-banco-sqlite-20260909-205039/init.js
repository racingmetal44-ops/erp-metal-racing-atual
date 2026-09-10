import db from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT NOT NULL,
    razao_social TEXT,
    nome_fantasia TEXT,
    ie TEXT,
    uf TEXT,
    cidade TEXT,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    bairro TEXT,
    telefone TEXT,
    email TEXT,
    crt INTEGER,
    codigo_ibge TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT,
    codigo_barras TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ncm TEXT,
    cfop TEXT,
    unidade TEXT DEFAULT 'UN',
    preco REAL DEFAULT 0,
    custo REAL DEFAULT 0,
    current_stock REAL DEFAULT 0,
    estoque_atual REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    max_stock REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nfe_entradas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE,
    numero TEXT,
    serie TEXT,
    fornecedor_cnpj TEXT,
    fornecedor_razao_social TEXT,
    data_emissao TEXT,
    natureza_operacao TEXT,
    valor_total REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    xml TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financeiro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_entrada_id INTEGER,
    descricao TEXT,
    fornecedor TEXT,
    documento TEXT,
    vencimento TEXT,
    valor REAL DEFAULT 0,
    valor_pago REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nfe_entrada_id) REFERENCES nfe_entradas(id)
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    quantidade REAL NOT NULL,
    origem TEXT,
    documento TEXT,
    observacao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);
`);

console.log('');
console.log('========================================');
console.log(' BANCO METAL RACING');
console.log('========================================');
console.log('Banco criado com sucesso!');
console.log('');
console.log('Tabelas:');
console.log('  ✓ empresas');
console.log('  ✓ produtos');
console.log('  ✓ nfe_entradas');
console.log('  ✓ financeiro');
console.log('  ✓ movimentacoes_estoque');
console.log('');

db.close();
