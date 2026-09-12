// src/backend/services/nfe/NfeEntradaService.js
// =========================================================
// SERVIÇO DE ENTRADA DE NF-e (ESTOQUE TRANSACIONAL)
// ---------------------------------------------------------
// Responsabilidades:
//  - identificar/criar fornecedor por CNPJ (sem duplicar);
//  - identificar produto por EAN/código/SKU;
//  - confirmar entrada com validação completa;
//  - atualizar estoque no Supabase de forma transacional
//    (rollback manual em caso de erro parcial);
//  - registrar movimentação (bipagem_history);
//  - bloquear duplicidade por chave de acesso.
//
// O estoque vive no Supabase (products / bipagem_history).
// Como o Supabase JS client não expõe transações SQL
// diretamente, aplicamos o padrão "compensating actions":
//  1. lê estoque atual de todos os itens ANTES;
//  2. aplica updates;
//  3. se QUALQUER update falhar, reverte os já aplicados;
//  4. só então registra movimentações e marca a NF-e.
// =========================================================

import fs from 'fs-extra';
import path from 'path';
import db from '../../database/db.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const ENTRADAS_FILE = path.join(DATA_DIR, 'nfe-entradas.json');
const FORNECEDORES_FILE = path.join(DATA_DIR, 'fornecedores.json');
const AUDITORIA_FILE = path.join(DATA_DIR, 'auditoria-bipagens.json');

// =========================================================
// PERSISTÊNCIA SQLITE
// =========================================================

function garantirTabelasNfeEntrada() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS nfe_entradas (
            id INTEGER PRIMARY KEY,
            chave TEXT,
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
            status TEXT,
            status_manifestacao TEXT,
            xml TEXT,
            xml_path TEXT,
            observacoes TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS nfe_entrada_itens (
            id INTEGER PRIMARY KEY,
            nfe_entrada_id INTEGER NOT NULL,
            produto_id TEXT,
            codigo TEXT,
            descricao TEXT,
            ncm TEXT,
            cfop TEXT,
            unidade TEXT,
            quantidade REAL,
            valor_unitario REAL,
            valor_total REAL,
            cst TEXT,
            csosn TEXT,
            ipi TEXT,
            pis TEXT,
            cofins TEXT
        );

        CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id TEXT NOT NULL,
            tipo TEXT NOT NULL,
            quantidade REAL DEFAULT 0,
            estoque_anterior REAL DEFAULT 0,
            estoque_posterior REAL DEFAULT 0,
            origem TEXT,
            documento TEXT,
            usuario_id TEXT,
            local_origem_id INTEGER,
            local_destino_id INTEGER,
            observacao TEXT,
            created_at TEXT
        );
    `);

    const colunasEntrada = db
        .prepare("PRAGMA table_info(nfe_entradas)")
        .all()
        .map(c => c.name);

    const adicionar = (nome, tipo) => {
        if (!colunasEntrada.includes(nome)) {
            db.exec(`ALTER TABLE nfe_entradas ADD COLUMN ${nome} ${tipo}`);
        }
    };

    adicionar('empresa_id', 'TEXT');
    adicionar('fornecedor', 'TEXT');
    adicionar('produtos', 'TEXT');
    adicionar('total', 'REAL DEFAULT 0');
    adicionar('xml_original', 'TEXT');
    adicionar('xml_assinado', 'TEXT');
    adicionar('xml_autorizado', 'TEXT');
    adicionar('protocolo', 'TEXT');
    adicionar('nprot', 'TEXT');
    adicionar('cstat', 'TEXT');
    adicionar('xmotivo', 'TEXT');
    adicionar('manifestacao', 'TEXT');
    adicionar('ambiente', 'TEXT');
    adicionar('dados', 'TEXT');
    adicionar('itens_vinculados', 'TEXT');
    adicionar('confirmada_em', 'TEXT');
    adicionar('confirmada_por', 'TEXT');
}

function parseJsonSeguro(valor, fallback) {
    if (valor === null || valor === undefined || valor === '') {
        return fallback;
    }

    if (typeof valor === 'object') {
        return valor;
    }

    try {
        return JSON.parse(valor);
    } catch {
        return fallback;
    }
}

function normalizarEntradaBanco(registro) {
    const original = parseJsonSeguro(registro?.dados, {});

    const produtosBanco = parseJsonSeguro(registro?.produtos, null);

    return {
        ...original,

        id: registro.id ?? original.id,

        empresaId:
            registro.empresa_id ??
            original.empresaId ??
            '1',

        chave:
            registro.chave ??
            original.chave,

        numero:
            registro.numero ??
            original.numero,

        serie:
            registro.serie ??
            original.serie,

        modelo:
            registro.modelo ??
            original.modelo ??
            '55',

        status:
            registro.status ??
            original.status,

        fornecedor:
            parseJsonSeguro(registro.fornecedor, null) ??
            original.fornecedor,

        produtos:
            Array.isArray(produtosBanco)
                ? produtosBanco
                : (
                    Array.isArray(original.produtos)
                        ? original.produtos
                        : []
                ),

        total:
            registro.total !== null &&
            registro.total !== undefined
                ? Number(registro.total)
                : Number(original.total || 0),

        xmlOriginal:
            registro.xml_original ??
            original.xmlOriginal,

        xmlAssinado:
            registro.xml_assinado ??
            original.xmlAssinado,

        xmlAutorizado:
            registro.xml_autorizado ??
            original.xmlAutorizado,

        protocolo:
            registro.protocolo ??
            original.protocolo,

        nProt:
            registro.nprot ??
            original.nProt,

        cStat:
            registro.cstat ??
            original.cStat,

        xMotivo:
            registro.xmotivo ??
            original.xMotivo,

        manifestacao:
            registro.manifestacao ??
            original.manifestacao,

        ambiente:
            registro.ambiente ??
            original.ambiente,

        dataEmissao:
            registro.data_emissao ??
            original.dataEmissao,

        dataEntrada:
            registro.data_entrada ??
            original.dataEntrada,

        itensVinculados:
            parseJsonSeguro(
                registro.itens_vinculados,
                original.itensVinculados || []
            ),

        confirmadaEm:
            registro.confirmada_em ??
            original.confirmadaEm,

        confirmadaPor:
            registro.confirmada_por ??
            original.confirmadaPor,

        updatedAt:
            registro.updated_at ??
            original.updatedAt
    };
}

function garantirIdEntrada(entrada) {
    const existente = entrada?.id;

    if (
        existente !== undefined &&
        existente !== null &&
        String(existente).trim() !== ''
    ) {
        return Number(existente);
    }

    const row = db.prepare(
        'SELECT COALESCE(MAX(id), 0) + 1 AS proximo FROM nfe_entradas'
    ).get();

    return Number(row.proximo);
}

export function getEntradas() {
    garantirTabelasNfeEntrada();

    const entradas = db.prepare(`
        SELECT *
        FROM nfe_entradas
        ORDER BY id DESC
    `).all();

    const stmtItens = db.prepare(`
        SELECT
            id,
            nfe_entrada_id,
            produto_id,
            codigo,
            descricao,
            ncm,
            cfop,
            unidade,
            quantidade,
            valor_unitario,
            valor_total,
            cst,
            csosn,
            ipi,
            pis,
            cofins
        FROM nfe_entrada_itens
        WHERE nfe_entrada_id = ?
        ORDER BY id
    `);

    return entradas.map((entradaBanco) => {
        const entrada = normalizarEntradaBanco(entradaBanco);

        const itens = stmtItens.all(entradaBanco.id);

        const produtos = itens.map((item) => ({
            id: item.id,
            produtoId: item.produto_id || null,
            produto_id: item.produto_id || null,

            codigo: item.codigo || "",
            sku: item.codigo || "",
            descricao: item.descricao || "",

            ncm: item.ncm || "",
            cfop: item.cfop || "",
            unidade: item.unidade || "UN",

            quantidade: Number(item.quantidade || 0),
            valorUnitario: Number(item.valor_unitario || 0),
            valorTotal: Number(item.valor_total || 0),

            valor_unitario: Number(item.valor_unitario || 0),
            valor_total: Number(item.valor_total || 0),

            cst: item.cst || "",
            csosn: item.csosn || "",
            ipi: item.ipi || "",
            pis: item.pis || "",
            cofins: item.cofins || ""
        }));

        return {
            ...entrada,

            produtos,

            total:
                Number(entrada.total || 0) ||
                produtos.reduce(
                    (soma, item) => soma + Number(item.valorTotal || 0),
                    0
                )
        };
    });
}
export function saveEntradas(lista) {
    garantirTabelasNfeEntrada();

    const entradas = Array.isArray(lista) ? lista : [];

    const inserir = db.prepare(`
        INSERT INTO nfe_entradas (
            id,
            empresa_id,
            chave,
            numero,
            serie,
            modelo,
            status,
            fornecedor,
            produtos,
            total,
            xml_original,
            xml_assinado,
            xml_autorizado,
            protocolo,
            nprot,
            cstat,
            xmotivo,
            manifestacao,
            ambiente,
            data_emissao,
            data_entrada,
            dados,
            itens_vinculados,
            confirmada_em,
            confirmada_por,
            created_at,
            updated_at
        )
        VALUES (
            @id,
            @empresa_id,
            @chave,
            @numero,
            @serie,
            @modelo,
            @status,
            @fornecedor,
            @produtos,
            @total,
            @xml_original,
            @xml_assinado,
            @xml_autorizado,
            @protocolo,
            @nprot,
            @cstat,
            @xmotivo,
            @manifestacao,
            @ambiente,
            @data_emissao,
            @data_entrada,
            @dados,
            @itens_vinculados,
            @confirmada_em,
            @confirmada_por,
            @created_at,
            @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            empresa_id = excluded.empresa_id,
            chave = excluded.chave,
            numero = excluded.numero,
            serie = excluded.serie,
            modelo = excluded.modelo,
            status = excluded.status,
            fornecedor = excluded.fornecedor,
            produtos = excluded.produtos,
            total = excluded.total,
            xml_original = excluded.xml_original,
            xml_assinado = excluded.xml_assinado,
            xml_autorizado = excluded.xml_autorizado,
            protocolo = excluded.protocolo,
            nprot = excluded.nprot,
            cstat = excluded.cstat,
            xmotivo = excluded.xmotivo,
            manifestacao = excluded.manifestacao,
            ambiente = excluded.ambiente,
            data_emissao = excluded.data_emissao,
            data_entrada = excluded.data_entrada,
            dados = excluded.dados,
            itens_vinculados = excluded.itens_vinculados,
            confirmada_em = excluded.confirmada_em,
            confirmada_por = excluded.confirmada_por,
            updated_at = excluded.updated_at
    `);

    const agora = new Date().toISOString();

    const transacao = db.transaction(() => {
        for (const entrada of entradas) {
            const id = garantirIdEntrada(entrada);
            const original = { ...entrada };

            inserir.run({
                id,

                empresa_id:
                    entrada.empresaId ??
                    entrada.empresa_id ??
                    '1',

                chave:
                    entrada.chave ??
                    null,

                numero:
                    entrada.numero !== undefined &&
                    entrada.numero !== null
                        ? String(entrada.numero)
                        : null,

                serie:
                    entrada.serie !== undefined &&
                    entrada.serie !== null
                        ? String(entrada.serie)
                        : null,

                modelo:
                    entrada.modelo
                        ? String(entrada.modelo)
                        : '55',

                status:
                    entrada.status ??
                    null,

                fornecedor:
                    JSON.stringify(
                        entrada.fornecedor ?? null
                    ),

                produtos:
                    JSON.stringify(
                        Array.isArray(entrada.produtos)
                            ? entrada.produtos
                            : []
                    ),

                total:
                    Number(
                        entrada.total ??
                        entrada.totais?.nota ??
                        0
                    ),

                xml_original:
                    entrada.xmlOriginal ??
                    entrada.xml_original ??
                    null,

                xml_assinado:
                    entrada.xmlAssinado ??
                    entrada.xml_assinado ??
                    null,

                xml_autorizado:
                    entrada.xmlAutorizado ??
                    entrada.xml_autorizado ??
                    null,

                protocolo:
                    entrada.protocolo ??
                    entrada.protocoloSefaz ??
                    null,

                nprot:
                    entrada.nProt ??
                    entrada.nprot ??
                    null,

                cstat:
                    entrada.cStat ??
                    entrada.cstat ??
                    null,

                xmotivo:
                    entrada.xMotivo ??
                    entrada.xmotivo ??
                    null,

                manifestacao:
                    entrada.manifestacao ??
                    null,

                ambiente:
                    entrada.ambiente != null
                        ? String(entrada.ambiente)
                        : null,

                data_emissao:
                    entrada.dataEmissao ??
                    entrada.data_emissao ??
                    null,

                data_entrada:
                    entrada.dataEntrada ??
                    entrada.data_entrada ??
                    null,

                dados:
                    JSON.stringify(original),

                itens_vinculados:
                    JSON.stringify(
                        entrada.itensVinculados ||
                        entrada.itens_vinculados ||
                        []
                    ),

                confirmada_em:
                    entrada.confirmadaEm ??
                    entrada.confirmada_em ??
                    null,

                confirmada_por:
                    entrada.confirmadaPor ??
                    entrada.confirmada_por ??
                    null,

                created_at:
                    entrada.createdAt ??
                    entrada.created_at ??
                    agora,

                updated_at:
                    entrada.updatedAt ??
                    entrada.updated_at ??
                    agora
            });
        }
    });

    transacao();
}

export async function getEntradasAsync() {
    return getEntradas();
}

export async function saveEntradasAsync(lista) {
    saveEntradas(lista);
}

// =========================================================
// FORNECEDORES
// =========================================================// =========================================================
// FORNECEDORES (normalização de CNPJ, sem duplicar)
// =========================================================

function normalizarCnpj(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function lerFornecedores() {
    try {
        if (fs.existsSync(FORNECEDORES_FILE)) {
            const dados = fs.readJsonSync(FORNECEDORES_FILE);
            return Array.isArray(dados) ? dados : [];
        }
    } catch { /* ausente */ }
    return [];
}

function salvarFornecedores(lista) {
    fs.ensureDirSync(DATA_DIR);
    fs.writeJsonSync(FORNECEDORES_FILE, lista, { spaces: 2 });
}

/**
 * Localiza fornecedor pelo CNPJ normalizado.
 * Cria apenas se `criarSeNaoExistir` e os dados mínimos existirem.
 */
export function vincularFornecedor(dadosFornecedor, { criarSeNaoExistir = true } = {}) {

    const cnpj = normalizarCnpj(dadosFornecedor?.cnpj);
    const fornecedores = lerFornecedores();

    if (cnpj) {
        const existente = fornecedores.find(
            f => normalizarCnpj(f.cnpj) === cnpj
        );
        if (existente) {
            // Atualiza dados cadastrais que vierem do XML (sem duplicar)
            existente.razaoSocial = existente.razaoSocial || dadosFornecedor?.razaoSocial || '';
            existente.ie = existente.ie || dadosFornecedor?.ie || '';
            existente.atualizadoEm = new Date().toISOString();
            salvarFornecedores(fornecedores);
            return existente;
        }
    }

    if (!criarSeNaoExistir) {
        return null;
    }

    if (!cnpj && !dadosFornecedor?.razaoSocial) {
        return null;
    }

    const novo = {
        id: Date.now(),
        cnpj,
        cpf: normalizarCnpj(dadosFornecedor?.cpf || ''),
        razaoSocial: dadosFornecedor?.razaoSocial || '',
        nomeFantasia: dadosFornecedor?.nomeFantasia || '',
        ie: dadosFornecedor?.ie || '',
        endereco: dadosFornecedor?.endereco || null,
        origem: dadosFornecedor?.origem || 'NFE_ENTRADA',
        createdAt: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    fornecedores.push(novo);
    salvarFornecedores(fornecedores);
    return novo;
}

export function listarFornecedores() {
    return lerFornecedores();
}

// =========================================================
// IDENTIFICAÇÃO DE PRODUTO
// =========================================================

/**
 * Tenta identificar o produto do ERP para um item da NF-e.
 * Ordem: EAN -> código interno -> SKU -> vínculo salvo.
 */
export async function identificarProduto(itemNfe, empresaId) {

    const ean = String(itemNfe.ean || '').replace(/\D/g, '');
    const codigo = String(itemNfe.codigo || '').trim();

    // =====================================================
    // 1. GTIN / EAN
    // =====================================================
    if (ean && ean !== 'SEM GTIN' && ean !== '0') {
        const produto = db.prepare(`
            SELECT
                id,
                nome AS name,
                sku,
                current_stock,
                estoque_atual,
                codigo_barras AS barcode
            FROM produtos
            WHERE codigo_barras = ?
               OR ean = ?
               OR gtin = ?
            LIMIT 1
        `).get(ean, ean, ean);

        if (produto) {
            return { produto, metodo: 'EAN' };
        }
    }

    // =====================================================
    // 2. CÓDIGO / SKU
    // =====================================================
    if (codigo) {
        const produto = db.prepare(`
            SELECT
                id,
                nome AS name,
                sku,
                current_stock,
                estoque_atual,
                codigo_barras AS barcode
            FROM produtos
            WHERE sku = ?
               OR codigo = ?
            LIMIT 1
        `).get(codigo, codigo);

        if (produto) {
            return { produto, metodo: 'CODIGO' };
        }
    }

    // =====================================================
    // 3. VÍNCULO PREVIAMENTE SALVO
    // =====================================================
    const vinculo = buscarVinculoSalvo({
        empresaId,
        codigoFornecedor: codigo,
        ean
    });

    if (vinculo?.produtoId) {
        const produto = db.prepare(`
            SELECT
                id,
                nome AS name,
                sku,
                current_stock,
                estoque_atual,
                codigo_barras AS barcode
            FROM produtos
            WHERE id = ?
            LIMIT 1
        `).get(String(vinculo.produtoId));

        if (produto) {
            return { produto, metodo: 'VINCULO' };
        }
    }

    return {
        produto: null,
        metodo: null
    };
}


/**
 * Cria automaticamente um produto do ERP a partir de um item da NF-e.
 * O produto somente é criado quando não foi encontrado por EAN, SKU ou vínculo.
 */
async function criarProdutoAutomaticamente(itemNfe, empresaId) {

    const codigo = String(itemNfe?.codigo || '').trim();
    const descricao =
        String(itemNfe?.descricao || '').trim() ||
        'Produto NF-e';

    const eanOriginal = String(itemNfe?.ean || '').trim();
    const ean = eanOriginal.replace(/\D/g, '');

    const unidade =
        String(itemNfe?.unidade || 'UN').trim() ||
        'UN';

    // =====================================================
    // 1. TENTA NOVAMENTE LOCALIZAR POR EAN
    // =====================================================
    if (ean && ean !== '0' && ean.length >= 8) {

        const produto = db.prepare(`
            SELECT
                id,
                nome AS name,
                sku,
                current_stock,
                estoque_atual,
                codigo_barras AS barcode
            FROM produtos
            WHERE codigo_barras = ?
               OR ean = ?
               OR gtin = ?
            LIMIT 1
        `).get(ean, ean, ean);

        if (produto) {
            return {
                produto,
                metodo: 'EAN',
                criado: false
            };
        }
    }

    // =====================================================
    // 2. TENTA NOVAMENTE LOCALIZAR POR SKU / CÓDIGO
    // =====================================================
    if (codigo) {

        const produto = db.prepare(`
            SELECT
                id,
                nome AS name,
                sku,
                current_stock,
                estoque_atual,
                codigo_barras AS barcode
            FROM produtos
            WHERE sku = ?
               OR codigo = ?
            LIMIT 1
        `).get(codigo, codigo);

        if (produto) {
            return {
                produto,
                metodo: 'CODIGO',
                criado: false
            };
        }
    }

    // =====================================================
    // 3. GERA SKU CASO A NF-e NÃO TENHA CÓDIGO
    // =====================================================
    let sku = codigo;

    if (!sku) {
        sku =
            `NFE-${String(Date.now())}-${Math.floor(Math.random() * 10000)}`;
    }

    // =====================================================
    // 4. GERA CÓDIGO DE BARRAS CASO NÃO EXISTA EAN
    // =====================================================
    let barcode = ean;

    if (!barcode || barcode === '0' || barcode.length < 8) {
        barcode =
            `200${Date.now()}${Math.floor(Math.random() * 1000)}`
                .slice(0, 13);
    }

    // =====================================================
    // 5. GARANTE SKU ÚNICO
    // =====================================================
    const skuBase = sku;
    let contadorSku = 1;

    while (
        db.prepare(`
            SELECT id
            FROM produtos
            WHERE sku = ?
            LIMIT 1
        `).get(sku)
    ) {
        contadorSku++;
        sku = `${skuBase}-${contadorSku}`;
    }

    // =====================================================
    // 6. GARANTE BARCODE ÚNICO
    // =====================================================
    const barcodeBase = barcode;
    let contadorBarcode = 1;

    while (
        db.prepare(`
            SELECT id
            FROM produtos
            WHERE codigo_barras = ?
               OR ean = ?
               OR gtin = ?
            LIMIT 1
        `).get(barcode, barcode, barcode)
    ) {
        contadorBarcode++;

        barcode =
            `${barcodeBase}${contadorBarcode}`
                .slice(0, 13);
    }

    // =====================================================
    // 7. CRIA PRODUTO NO SQLITE
    // =====================================================
    const produtoId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO produtos (
            id,
            sku,
            codigo,
            codigo_barras,
            ean,
            gtin,
            nome,
            descricao,
            unidade,
            ncm,
            current_stock,
            estoque_atual,
            min_stock,
            max_stock,
            ativo,
            created_at,
            updated_at
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            0, 0, 0, 99999, 1, ?, ?
        )
    `).run(
        produtoId,
        sku,
        codigo || sku,
        barcode,
        ean || barcode,
        barcode,
        descricao,
        descricao,
        unidade,
        String(itemNfe?.ncm || ''),
        new Date().toISOString(),
        new Date().toISOString()
    );

    const produto = db.prepare(`
        SELECT
            id,
            nome AS name,
            sku,
            current_stock,
            estoque_atual,
            codigo_barras AS barcode
        FROM produtos
        WHERE id = ?
    `).get(produtoId);

    if (!produto) {
        throw new Error(
            `Não foi possóvel criar automaticamente o produto "${descricao}".`
        );
    }

    // =====================================================
    // 8. SALVA VÍNCULO COM A NF-e / FORNECEDOR
    // =====================================================
    try {

        salvarVinculoProduto({
            empresaId,
            codigoFornecedor: codigo,
            ean,
            produtoId: produto.id,
            sku: produto.sku
        });

    } catch (erroVinculo) {

        console.warn(
            '[ENTRADA] Produto criado, mas não foi possóvel salvar vínculo:',
            erroVinculo.message
        );
    }

    console.log(
        `[ENTRADA] Produto criado automaticamente: ` +
        `${produto.id} | ${produto.name} | SKU ${produto.sku}`
    );

    return {
        produto,
        metodo: 'CRIADO_AUTOMATICAMENTE',
        criado: true
    };
}
const VINCULOS_FILE = path.join(DATA_DIR, 'nfe-vinculos-produtos.json');

function lerVinculos() {
    try {
        if (fs.existsSync(VINCULOS_FILE)) {
            const dados = fs.readJsonSync(VINCULOS_FILE);
            return Array.isArray(dados) ? dados : [];
        }
    } catch { /* ausente */ }
    return [];
}

export function buscarVinculoSalvo({ empresaId, codigoFornecedor, ean }) {
    const vinculos = lerVinculos();
    return vinculos.find(v =>
        String(v.empresaId) === String(empresaId) &&
        (
            (codigoFornecedor && v.codigoFornecedor === codigoFornecedor) ||
            (ean && v.ean === ean)
        )
    ) || null;
}

export function salvarVinculoProduto({ empresaId, codigoFornecedor, ean, produtoId, sku }) {
    const vinculos = lerVinculos();
    const existente = vinculos.findIndex(v =>
        String(v.empresaId) === String(empresaId) &&
        v.codigoFornecedor === codigoFornecedor
    );

    const registro = {
        empresaId: String(empresaId),
        codigoFornecedor,
        ean,
        produtoId,
        sku,
        atualizadoEm: new Date().toISOString()
    };

    if (existente >= 0) {
        vinculos[existente] = registro;
    } else {
        vinculos.push(registro);
    }

    fs.ensureDirSync(DATA_DIR);
    fs.writeJsonSync(VINCULOS_FILE, vinculos, { spaces: 2 });
    return registro;
}

// =========================================================
// VALIDAÇÃO DO XML / NF-e
// =========================================================

export function validarChaveAcesso(chave) {
    if (!/^\d{44}$/.test(chave)) {
        throw new Error(
            `Chave de acesso inválida (44 dígitos esperados). Recebida: ${chave}`
        );
    }

    const base = chave.substring(0, 43);
    const informado = Number(chave.substring(43));

    let soma = 0;
    let peso = 2;
    for (let i = base.length - 1; i >= 0; i--) {
        soma += Number(base[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }

    const resto = soma % 11;
    const calculado = resto < 2 ? 0 : 11 - resto;

    if (calculado !== informado) {
        throw new Error(
            `Dígito verificador da chave inválido. Informado: ${informado}; calculado: ${calculado}.`
        );
    }

    return true;
}

/**
 * Verifica duplicidade por chave de acesso dentro da empresa.
 */
export function verificarDuplicidade(empresaId, chave) {
    const entradas = getEntradas();
    const existente = entradas.find(
        e =>
            String(e.empresaId) === String(empresaId) &&
            e.chave === chave
    );

    if (!existente) return null;

    if (existente.status === 'CONFIRMADA' || existente.status === 'PROCESSADA') {
        return {
            duplicada: true,
            motivo: 'Esta NF-e já possui entrada de estoque.',
            entrada: existente
        };
    }

    return {
        duplicada: true,
        motivo: 'Esta NF-e já foi importada.',
        entrada: existente
    };
}

// =========================================================
// CONFIRMAÇÃO DA ENTRADA (TRANSAÇÃO COM ROLLBACK)
// =========================================================

/**
 * Confirma a entrada da NF-e:
 *  1. valida NF-e, itens, produtos e quantidades;
 *  2. lê estoque atual (snapshot);
 *  3. aplica updates de estoque;
 *  4. em erro: REVERTE updates já aplicados (rollback);
 *  5. registra movimentações;
 *  6. marca NF-e como CONFIRMADA.
 */
export async function reverterEstoqueEntrada(aplicados = []) {
    garantirTabelasNfeEntrada();

    const reverter = db.transaction((lista) => {
        for (const aplicado of [...lista].reverse()) {
            if (!aplicado?.produtoId) {
                continue;
            }

            const estoqueAnterior =
                Number(aplicado.anterior ?? aplicado.estoqueAnterior ?? 0);

            const resultado = db.prepare(`
                UPDATE produtos
                SET
                    current_stock = ?,
                    estoque_atual = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(
                estoqueAnterior,
                Number(
                    aplicado.anteriorEstoqueAtual ??
                    aplicado.estoqueAnterior ??
                    estoqueAnterior
                ),
                new Date().toISOString(),
                aplicado.produtoId
            );

            if (resultado.changes === 0) {
                throw new Error(
                    `Produto ${aplicado.produtoId} não encontrado ao reverter estoque.`
                );
            }
        }
    });

    reverter(aplicados);

    return {
        success: true,
        revertidos: aplicados.length
    };
}

export async function confirmarEntrada({ entradaId, itens, usuario }) {

    garantirTabelasNfeEntrada();

    const entradas = getEntradas();

    const index = entradas.findIndex(
        e => Number(e.id) === Number(entradaId)
    );

    if (index === -1) {
        throw new Error('Entrada não encontrada.');
    }

    const entrada = entradas[index];

    // ---------------------------------------------
    // 1. VALIDAÇÕES
    // ---------------------------------------------
    if (
        entrada.status === 'CONFIRMADA' ||
        entrada.status === 'PROCESSADA'
    ) {
        throw new Error(
            'Esta NF-e já possui entrada de estoque.'
        );
    }

    if (entrada.chave) {
        validarChaveAcesso(entrada.chave);
    }

    const itensVinculados = [];
    const produtosCriados = [];

    for (let idx = 0; idx < (itens || []).length; idx++) {

        const item = itens[idx] || {};
        const produtoNfe =
            (entrada.produtos || [])[idx] || {};

        const itemCompleto = {
            ...produtoNfe,
            ...item,

            codigo:
                item.codigo ||
                produtoNfe.codigo ||
                '',

            ean:
                item.ean ||
                produtoNfe.ean ||
                '',

            descricao:
                item.descricao ||
                produtoNfe.descricao ||
                '',

            unidade:
                item.unidade ||
                produtoNfe.unidade ||
                'UN'
        };

        let produtoId =
            item.produtoId ||
            item.produto_id ||
            null;

        let produtoEncontrado = null;
        let metodo = 'VINCULADO';
        let criadoAutomaticamente = false;

        // -------------------------------------------------
        // 1. PRODUTO INFORMADO PELO FRONTEND
        // -------------------------------------------------
        if (produtoId) {

            produtoEncontrado = db.prepare(`
                SELECT
                    id,
                    nome AS name,
                    sku,
                    codigo_barras AS barcode,
                    current_stock,
                    estoque_atual
                FROM produtos
                WHERE id = ?
                LIMIT 1
            `).get(String(produtoId));

            if (!produtoEncontrado) {
                produtoId = null;
            }
        }

        // -------------------------------------------------
        // 2. PROCURA AUTOMÁTICA
        // -------------------------------------------------
        if (!produtoEncontrado) {

            const identificacao =
                await identificarProduto(
                    itemCompleto,
                    entrada.empresaId
                );

            if (identificacao?.produto) {

                produtoEncontrado =
                    identificacao.produto;

                produtoId =
                    identificacao.produto.id;

                metodo =
                    identificacao.metodo ||
                    'AUTOMATICO';
            }
        }

        // -------------------------------------------------
        // 3. CRIAÇÃO AUTOMÁTICA
        // -------------------------------------------------
        if (!produtoEncontrado) {

            const criado =
                await criarProdutoAutomaticamente(
                    itemCompleto,
                    entrada.empresaId
                );

            if (!criado?.produto?.id) {
                throw new Error(
                    `Não foi possóvel criar o produto automaticamente: ` +
                    `${itemCompleto.descricao || itemCompleto.codigo || 'item sem descrição'}`
                );
            }

            produtoEncontrado =
                criado.produto;

            produtoId =
                criado.produto.id;

            metodo =
                criado.metodo;

            criadoAutomaticamente = true;

            produtosCriados.push({
                id: criado.produto.id,
                name: criado.produto.name,
                sku: criado.produto.sku
            });
        }

        // -------------------------------------------------
        // 4. QUANTIDADE
        // -------------------------------------------------
        const quantidade = Number(
            item.quantidade ??
            produtoNfe.quantidade ??
            0
        );

        const valorUnitario = Number(
            item.valorUnitario ??
            item.valor_unitario ??
            produtoNfe.valorUnitario ??
            produtoNfe.valor_unitario ??
            0
        );

        if (
            !Number.isFinite(quantidade) ||
            quantidade <= 0
        ) {
            throw new Error(
                `Quantidade inválida para o produto ` +
                `"${itemCompleto.descricao || produtoEncontrado.name}".`
            );
        }

        // -------------------------------------------------
        // 5. SALVA VÍNCULO
        // -------------------------------------------------
        try {

            salvarVinculoProduto({
                empresaId: entrada.empresaId,

                codigoFornecedor:
                    String(
                        itemCompleto.codigo || ''
                    ).trim(),

                ean:
                    String(
                        itemCompleto.ean || ''
                    ).replace(/\D/g, ''),

                produtoId,

                sku:
                    produtoEncontrado.sku
            });

        } catch (erroVinculo) {

            console.warn(
                '[ENTRADA] Não foi possível salvar vínculo automático:',
                erroVinculo.message
            );
        }

        itensVinculados.push({

            itemNfe: Number(
                item.itemNfe ||
                produtoNfe.item ||
                idx + 1
            ),

            produtoId,

            sku: String(
                item.sku ||
                produtoEncontrado.sku ||
                ''
            ),

            quantidade,

            valorUnitario,

            metodo,

            criadoAutomaticamente
        });
    }

    if (!itensVinculados.length) {
        throw new Error(
            'Nenhum item informado para entrada.'
        );
    }

    // =====================================================
    // TRANSAÇÃO SQLITE
    // =====================================================
    const confirmarTransacao = db.transaction(() => {

        const agora = new Date().toISOString();

        const snapshot = new Map();

        // ---------------------------------------------
        // 6. SNAPSHOT
        // ---------------------------------------------
        for (const item of itensVinculados) {

            const produto = db.prepare(`
                SELECT
                    id,
                    nome,
                    sku,
                    current_stock,
                    estoque_atual
                FROM produtos
                WHERE id = ?
                LIMIT 1
            `).get(String(item.produtoId));

            if (!produto) {
                throw new Error(
                    `Produto ${item.produtoId} não encontrado no ERP.`
                );
            }

            snapshot.set(
                String(item.produtoId),
                {
                    name: produto.nome,
                    sku: produto.sku,
                    current_stock:
                        Number(
                            produto.current_stock ?? 0
                        ),
                    estoque_atual:
                        Number(
                            produto.estoque_atual ??
                            produto.current_stock ??
                            0
                        )
                }
            );
        }

        const aplicados = [];

        // ---------------------------------------------
        // 7. ATUALIZA ESTOQUE
        // ---------------------------------------------
        const atualizarProduto =
            db.prepare(`
                UPDATE produtos
                SET
                    current_stock = ?,
                    estoque_atual = ?,
                    updated_at = ?
                WHERE id = ?
            `);

        const inserirMovimentacao =
            db.prepare(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    origem,
                    documento,
                    usuario_id,
                    observacao,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

        for (const item of itensVinculados) {

            const antes =
                snapshot.get(
                    String(item.produtoId)
                );

            if (!antes) {
                throw new Error(
                    `Snapshot não encontrado para o produto ${item.produtoId}.`
                );
            }

            const novoCurrent =
                antes.current_stock +
                item.quantidade;

            const novoLegado =
                antes.estoque_atual +
                item.quantidade;

            atualizarProduto.run(
                novoCurrent,
                novoLegado,
                agora,
                String(item.produtoId)
            );

            inserirMovimentacao.run(
                String(item.produtoId),
                'ENTRADA_NF',
                item.quantidade,
                antes.current_stock,
                novoCurrent,
                'NF-E',
                String(
                    entrada.numero ||
                    entrada.chave ||
                    entrada.id
                ),
                usuario?.id || null,
                `Entrada NF-e ${entrada.numero || entrada.chave || entrada.id}`,
                agora
            );

            aplicados.push({
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                anterior: antes.current_stock,
                anteriorEstoqueAtual:
                    antes.estoque_atual,
                novo: novoCurrent,
                novoEstoqueAtual: novoLegado
            });

            console.log(
                `[ENTRADA] ESTOQUE ATUALIZADO | ` +
                `SKU ${antes.sku} | ` +
                `${antes.current_stock} + ` +
                `${item.quantidade} = ${novoCurrent}`
            );
        }

        // ---------------------------------------------
        // 8. HISTÓRICO / AUDITORIA
        // ---------------------------------------------
        const inserirAuditoria =
            db.prepare(`
                INSERT INTO auditoria (
                    usuario_id,
                    modulo,
                    acao,
                    entidade,
                    entidade_id,
                    dados_anteriores,
                    dados_novos,
                    ip,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

        for (const item of itensVinculados) {

            const antes =
                snapshot.get(
                    String(item.produtoId)
                );

            inserirAuditoria.run(
                usuario?.id || null,
                'NF-E',
                'ENTRADA_NF',
                'produto',
                String(item.produtoId),
                JSON.stringify({
                    current_stock:
                        antes.current_stock,
                    estoque_atual:
                        antes.estoque_atual
                }),
                JSON.stringify({
                    current_stock:
                        antes.current_stock +
                        item.quantidade,
                    estoque_atual:
                        antes.estoque_atual +
                        item.quantidade,
                    quantidade:
                        item.quantidade,
                    nfe_id:
                        entrada.id,
                    nfe_numero:
                        entrada.numero,
                    nfe_chave:
                        entrada.chave,
                    usuario_nome:
                        usuario?.nome ||
                        'Entrada NF-e',
                    origem:
                        'NF-e'
                }),
                null,
                agora
            );

            console.log(
                `[ENTRADA] HISTÓRICO REGISTRADO | ` +
                `SKU ${antes.sku} | ` +
                `quantidade ${item.quantidade}`
            );
        }

        // ---------------------------------------------
        // 9. ATUALIZA ITENS DA NF-e COM OS VÍNCULOS
        // ---------------------------------------------
        const atualizarItemNfe =
            db.prepare(`
                UPDATE nfe_entrada_itens
                SET produto_id = ?
                WHERE nfe_entrada_id = ?
                  AND id = ?
            `);

        for (
            let idx = 0;
            idx < itensVinculados.length;
            idx++
        ) {

            const itemVinculado =
                itensVinculados[idx];

            const produtoNfe =
                (entrada.produtos || [])[idx];

            if (
                produtoNfe?.id &&
                Number(produtoNfe.id) > 0
            ) {
                atualizarItemNfe.run(
                    String(
                        itemVinculado.produtoId
                    ),
                    Number(entrada.id),
                    Number(produtoNfe.id)
                );
            } else {

                const itemBanco =
                    db.prepare(`
                        SELECT id
                        FROM nfe_entrada_itens
                        WHERE nfe_entrada_id = ?
                        ORDER BY id
                        LIMIT 1 OFFSET ?
                    `).get(
                        Number(entrada.id),
                        idx
                    );

                if (itemBanco) {
                    atualizarItemNfe.run(
                        String(
                            itemVinculado.produtoId
                        ),
                        Number(entrada.id),
                        Number(itemBanco.id)
                    );
                }
            }
        }

        // ---------------------------------------------
        // 10. MARCA NF-e COMO CONFIRMADA
        // ---------------------------------------------
        entrada.status = 'CONFIRMADA';

        entrada.itensVinculados =
            itensVinculados;

        entrada.confirmadaEm = agora;

        entrada.confirmadaPor =
            usuario?.nome ||
            usuario?.id ||
            null;

        entrada.updatedAt = agora;

        entradas[index] = entrada;

        saveEntradas(entradas);

        console.log(
            `[ENTRADA] NF-e ` +
            `${entrada.numero || entrada.chave} ` +
            `confirmada com sucesso.`
        );

        return {
            entrada,
            aplicados
        };
    });

    try {

        const resultado =
            confirmarTransacao();

        return {
            entrada: resultado.entrada,

            aplicados:
                resultado.aplicados,

            resumo: {
                numero: resultado.entrada.numero,

                fornecedor:
                    resultado.entrada.fornecedor
                        ?.razaoSocial ||
                    resultado.entrada.fornecedor_razao_social ||
                    '',

                quantidadeItens:
                    itensVinculados.length,

                quantidadeTotal:
                    itensVinculados.reduce(
                        (s, i) =>
                            s + i.quantidade,
                        0
                    ),

                dataHora:
                    resultado.entrada.confirmadaEm
            }
        };

    } catch (erro) {

        console.error(
            '[ENTRADA] ERRO NA CONFIRMAÇÃO SQLITE. ' +
            'TRANSAÇÃO DESFEITA:',
            erro.message
        );

        // A transação SQLite desfaz automaticamente:
        // - alterações de estoque
        // - movimentações
        // - auditoria
        // - vínculo dos itens da NF-e
        // - alteração da NF-e
        //
        // Produtos criados automaticamente precisam
        // ser removidos separadamente, pois foram
        // criados antes da transação de estoque.

        for (
            const produtoCriado of produtosCriados
        ) {

            try {

                db.prepare(`
                    DELETE FROM produtos
                    WHERE id = ?
                `).run(
                    String(produtoCriado.id)
                );

                console.log(
                    `[ENTRADA] PRODUTO CRIADO REMOVIDO NO ROLLBACK | ` +
                    `${produtoCriado.sku || produtoCriado.id}`
                );

            } catch (erroDelete) {

                console.error(
                    `[ENTRADA] FALHA AO REMOVER PRODUTO ` +
                    `CRIADO NO ROLLBACK | ` +
                    `${produtoCriado.id}:`,
                    erroDelete.message
                );
            }
        }

        throw new Error(
            `Entrada não confirmada. ` +
            `Estoque revertido pela transação SQLite. ` +
            `Motivo: ${erro.message}`
        );
    }
}




