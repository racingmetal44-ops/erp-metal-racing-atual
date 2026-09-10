import db from './db.js';

db.exec(`
PRAGMA foreign_keys = ON;

-- =========================================================
-- EMPRESAS
-- =========================================================

CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT NOT NULL UNIQUE,
    razao_social TEXT,
    nome_fantasia TEXT,
    ie TEXT,
    ie_st TEXT,
    im TEXT,
    suframa TEXT,
    crt INTEGER,
    regime_tributario TEXT,
    uf TEXT,
    cidade TEXT,
    codigo_ibge TEXT,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    telefone TEXT,
    email TEXT,
    certificado_path TEXT,
    certificado_validade TEXT,
    certificado_status TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- USUARIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    senha_hash TEXT,
    perfil TEXT DEFAULT 'usuario',
    ativo INTEGER DEFAULT 1,
    avatar_url TEXT,
    ultimo_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- PRODUTOS
-- =========================================================

CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY,
    sku TEXT,
    codigo TEXT,
    codigo_barras TEXT,
    ean TEXT,
    gtin TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    marca TEXT,
    modelo TEXT,
    unidade TEXT DEFAULT 'UN',
    ncm TEXT,
    cest TEXT,
    cfop TEXT,
    cst TEXT,
    csosn TEXT,
    origem TEXT,
    preco REAL DEFAULT 0,
    preco_venda REAL DEFAULT 0,
    custo REAL DEFAULT 0,
    current_stock REAL DEFAULT 0,
    estoque_atual REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    max_stock REAL DEFAULT 0,
    estoque_reservado REAL DEFAULT 0,
    estoque_disponivel REAL DEFAULT 0,
    peso REAL DEFAULT 0,
    altura REAL DEFAULT 0,
    largura REAL DEFAULT 0,
    comprimento REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produtos_sku
ON produtos(sku);

CREATE INDEX IF NOT EXISTS idx_produtos_barcode
ON produtos(codigo_barras);

CREATE INDEX IF NOT EXISTS idx_produtos_ean
ON produtos(ean);

-- =========================================================
-- ARQUIVOS DOS PRODUTOS
-- =========================================================

CREATE TABLE IF NOT EXISTS product_files (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT,
    product_barcode TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size REAL DEFAULT 0,
    file_category TEXT,
    photo_angle TEXT,
    sort_order INTEGER DEFAULT 0,
    is_ai_training INTEGER DEFAULT 0,
    added_by_name TEXT,
    is_primary INTEGER DEFAULT 0,
    created_date TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- =========================================================
-- LOCAIS / MAPA DO ESTOQUE
-- =========================================================

CREATE TABLE IF NOT EXISTS locais_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nome TEXT,
    corredor TEXT,
    rua TEXT,
    coluna TEXT,
    nivel TEXT,
    descricao TEXT,
    capacidade REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produto_localizacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id TEXT NOT NULL,
    local_id INTEGER NOT NULL,
    quantidade REAL DEFAULT 0,
    quantidade_reservada REAL DEFAULT 0,
    principal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY(local_id) REFERENCES locais_estoque(id) ON DELETE CASCADE
);

-- =========================================================
-- MOVIMENTAÇÃO DE ESTOQUE
-- =========================================================

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    quantidade REAL NOT NULL,
    estoque_anterior REAL DEFAULT 0,
    estoque_posterior REAL DEFAULT 0,
    origem TEXT,
    documento TEXT,
    usuario_id INTEGER,
    local_origem_id INTEGER,
    local_destino_id INTEGER,
    observacao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(produto_id) REFERENCES produtos(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- PEDIDOS
-- =========================================================

CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    numero TEXT,
    plataforma TEXT,
    conta TEXT,
    pedido_externo_id TEXT,
    status TEXT,
    status_pagamento TEXT,
    status_envio TEXT,
    cliente_nome TEXT,
    cliente_documento TEXT,
    cliente_email TEXT,
    cliente_telefone TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    valor_produtos REAL DEFAULT 0,
    valor_frete REAL DEFAULT 0,
    valor_desconto REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    data_pedido TEXT,
    data_pagamento TEXT,
    data_envio TEXT,
    data_entrega TEXT,
    rastreio TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT NOT NULL,
    produto_id TEXT,
    sku TEXT,
    nome_produto TEXT,
    quantidade REAL DEFAULT 0,
    preco_unitario REAL DEFAULT 0,
    desconto REAL DEFAULT 0,
    total REAL DEFAULT 0,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
);

-- =========================================================
-- DEVOLUÇÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS devolucoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    produto_id TEXT,
    motivo TEXT,
    status TEXT DEFAULT 'PENDENTE',
    quantidade REAL DEFAULT 0,
    valor REAL DEFAULT 0,
    observacao TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY(produto_id) REFERENCES produtos(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- PRODUÇÃO / PCP
-- =========================================================

CREATE TABLE IF NOT EXISTS ordens_producao (
    id TEXT PRIMARY KEY,
    numero TEXT UNIQUE,
    produto_id TEXT,
    quantidade REAL DEFAULT 0,
    quantidade_produzida REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    prioridade TEXT DEFAULT 'NORMAL',
    data_inicio TEXT,
    data_prevista TEXT,
    data_conclusao TEXT,
    observacao TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(produto_id) REFERENCES produtos(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ordem_producao_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_producao_id TEXT NOT NULL,
    produto_id TEXT,
    quantidade_planejada REAL DEFAULT 0,
    quantidade_utilizada REAL DEFAULT 0,
    FOREIGN KEY(ordem_producao_id) REFERENCES ordens_producao(id) ON DELETE CASCADE,
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
);

-- =========================================================
-- EXPEDIÇÃO
-- =========================================================

CREATE TABLE IF NOT EXISTS expedicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    status TEXT DEFAULT 'PENDENTE',
    transportadora TEXT,
    codigo_rastreio TEXT,
    usuario_id INTEGER,
    data_separacao TEXT,
    data_conferencia TEXT,
    data_envio TEXT,
    observacao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- BIPAGEM
-- =========================================================

CREATE TABLE IF NOT EXISTS bipagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    produto_id TEXT,
    codigo_bipado TEXT,
    quantidade REAL DEFAULT 1,
    resultado TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY(produto_id) REFERENCES produtos(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- NF-e EMITIDAS
-- =========================================================

CREATE TABLE IF NOT EXISTS nfes (
    id TEXT PRIMARY KEY,
    empresa_id INTEGER,
    chave TEXT UNIQUE,
    numero TEXT,
    serie TEXT,
    modelo TEXT DEFAULT '55',
    ambiente TEXT,
    status TEXT,
    cstat TEXT,
    motivo TEXT,
    protocolo TEXT,
    data_emissao TEXT,
    natureza_operacao TEXT,
    valor_produtos REAL DEFAULT 0,
    valor_frete REAL DEFAULT 0,
    valor_desconto REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    xml_path TEXT,
    xml TEXT,
    danfe_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(empresa_id) REFERENCES empresas(id)
);

CREATE TABLE IF NOT EXISTS nfe_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_id TEXT NOT NULL,
    produto_id TEXT,
    codigo TEXT,
    descricao TEXT,
    ncm TEXT,
    cfop TEXT,
    unidade TEXT,
    quantidade REAL DEFAULT 0,
    valor_unitario REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    cst TEXT,
    csosn TEXT,
    FOREIGN KEY(nfe_id) REFERENCES nfes(id) ON DELETE CASCADE,
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS nfe_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_id TEXT,
    chave TEXT,
    tipo_evento TEXT,
    descricao TEXT,
    protocolo TEXT,
    cstat TEXT,
    motivo TEXT,
    xml TEXT,
    data_evento TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(nfe_id) REFERENCES nfes(id)
);

-- =========================================================
-- NF-e ENTRADA
-- =========================================================

CREATE TABLE IF NOT EXISTS nfe_entradas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE,
    numero TEXT,
    serie TEXT,
    modelo TEXT DEFAULT '55',
    fornecedor_cnpj TEXT,
    fornecedor_razao_social TEXT,
    fornecedor_ie TEXT,
    data_emissao TEXT,
    data_entrada TEXT,
    natureza_operacao TEXT,
    cfop_entrada TEXT,
    valor_produtos REAL DEFAULT 0,
    valor_frete REAL DEFAULT 0,
    valor_desconto REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    status_manifestacao TEXT,
    xml TEXT,
    xml_path TEXT,
    observacoes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nfe_entrada_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_entrada_id INTEGER NOT NULL,
    produto_id TEXT,
    codigo TEXT,
    descricao TEXT,
    ncm TEXT,
    cfop TEXT,
    unidade TEXT,
    quantidade REAL DEFAULT 0,
    valor_unitario REAL DEFAULT 0,
    valor_total REAL DEFAULT 0,
    cst TEXT,
    csosn TEXT,
    ipi TEXT,
    pis TEXT,
    cofins TEXT,
    FOREIGN KEY(nfe_entrada_id) REFERENCES nfe_entradas(id) ON DELETE CASCADE,
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
);

-- =========================================================
-- FINANCEIRO
-- =========================================================

CREATE TABLE IF NOT EXISTS contas_financeiras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    tipo TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    saldo REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contas_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_entrada_id INTEGER,
    fornecedor TEXT,
    documento TEXT,
    descricao TEXT,
    vencimento TEXT,
    valor REAL DEFAULT 0,
    valor_pago REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    categoria TEXT,
    conta_financeira_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(nfe_entrada_id) REFERENCES nfe_entradas(id),
    FOREIGN KEY(conta_financeira_id) REFERENCES contas_financeiras(id)
);

CREATE TABLE IF NOT EXISTS contas_receber (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    cliente TEXT,
    documento TEXT,
    descricao TEXT,
    vencimento TEXT,
    valor REAL DEFAULT 0,
    valor_recebido REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDENTE',
    categoria TEXT,
    conta_financeira_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY(conta_financeira_id) REFERENCES contas_financeiras(id)
);

CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_pagar_id INTEGER,
    conta_receber_id INTEGER,
    valor REAL DEFAULT 0,
    data_pagamento TEXT,
    forma_pagamento TEXT,
    observacao TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conta_pagar_id) REFERENCES contas_pagar(id),
    FOREIGN KEY(conta_receber_id) REFERENCES contas_receber(id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- INTEGRAÇÕES / MARKETPLACES
-- =========================================================

CREATE TABLE IF NOT EXISTS integracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plataforma TEXT NOT NULL,
    nome_conta TEXT,
    account_id TEXT,
    client_id TEXT,
    status TEXT DEFAULT 'INATIVO',
    access_token TEXT,
    refresh_token TEXT,
    token_expira_em TEXT,
    configuracao_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sincronizacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integracao_id INTEGER,
    tipo TEXT,
    status TEXT,
    registros INTEGER DEFAULT 0,
    erro TEXT,
    iniciado_em TEXT,
    finalizado_em TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(integracao_id) REFERENCES integracoes(id)
);

-- =========================================================
-- ALERTAS / AVISOS
-- =========================================================

CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    titulo TEXT,
    mensagem TEXT,
    prioridade TEXT DEFAULT 'NORMAL',
    lido INTEGER DEFAULT 0,
    usuario_id INTEGER,
    referencia_tipo TEXT,
    referencia_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- AUDITORIA
-- =========================================================

CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    modulo TEXT,
    acao TEXT,
    entidade TEXT,
    entidade_id TEXT,
    dados_anteriores TEXT,
    dados_novos TEXT,
    ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- RANKING
-- =========================================================

CREATE TABLE IF NOT EXISTS ranking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    pontos INTEGER DEFAULT 0,
    vendas INTEGER DEFAULT 0,
    pedidos INTEGER DEFAULT 0,
    produtividade REAL DEFAULT 0,
    periodo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- SUGESTÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS sugestoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    titulo TEXT,
    descricao TEXT,
    categoria TEXT,
    status TEXT DEFAULT 'PENDENTE',
    resposta TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- ETIQUETAS
-- =========================================================

CREATE TABLE IF NOT EXISTS etiquetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id TEXT,
    pedido_id TEXT,
    codigo TEXT,
    descricao TEXT,
    quantidade INTEGER DEFAULT 1,
    modelo TEXT,
    impressora TEXT,
    status TEXT DEFAULT 'PENDENTE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(produto_id) REFERENCES produtos(id),
    FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
);

-- =========================================================
-- PLANILHAS
-- =========================================================

CREATE TABLE IF NOT EXISTS planilhas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    descricao TEXT,
    arquivo TEXT,
    tipo TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- CONFIGURAÇÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    valor TEXT,
    tipo TEXT DEFAULT 'string',
    descricao TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- IA EXECUTIVA
-- =========================================================

CREATE TABLE IF NOT EXISTS analises_ia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    periodo TEXT,
    pergunta TEXT,
    resposta TEXT,
    dados_json TEXT,
    usuario_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_pedidos_status
ON pedidos(status);

CREATE INDEX IF NOT EXISTS idx_pedidos_plataforma
ON pedidos(plataforma);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto
ON movimentacoes_estoque(produto_id);

CREATE INDEX IF NOT EXISTS idx_nfe_chave
ON nfes(chave);

CREATE INDEX IF NOT EXISTS idx_nfe_entrada_chave
ON nfe_entradas(chave);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_status
ON contas_pagar(status);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento
ON contas_pagar(vencimento);

CREATE INDEX IF NOT EXISTS idx_alertas_lido
ON alertas(lido);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
ON auditoria(usuario_id);
`);

console.log('');
console.log('================================================');
console.log('      BANCO METAL RACING - COMPLETO');
console.log('================================================');
console.log('');
console.log('Banco SQLite inicializado com sucesso!');
console.log('');
console.log('Módulos preparados:');
console.log('  ✓ Empresas');
console.log('  ✓ Usuários');
console.log('  ✓ Produtos');
console.log('  ✓ Arquivos de produtos');
console.log('  ✓ Estoque');
console.log('  ✓ Mapa de estoque');
console.log('  ✓ Pedidos');
console.log('  ✓ Devoluções');
console.log('  ✓ Produção / PCP');
console.log('  ✓ Expedição');
console.log('  ✓ Bipagem');
console.log('  ✓ NF-e');
console.log('  ✓ NF-e Entrada');
console.log('  ✓ Financeiro');
console.log('  ✓ Shopee / Mercado Livre / Tray');
console.log('  ✓ Alertas');
console.log('  ✓ Auditoria');
console.log('  ✓ Ranking');
console.log('  ✓ Sugestões');
console.log('  ✓ Etiquetas');
console.log('  ✓ Planilhas');
console.log('  ✓ Configurações');
console.log('  ✓ IA Executiva');
console.log('');

db.close();
