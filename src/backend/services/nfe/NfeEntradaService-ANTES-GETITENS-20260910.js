// src/backend/services/nfe/NfeEntradaService.js
// =========================================================
// SERVIÃ©O DE ENTRADA DE NF-e (ESTOQUE TRANSACIONAL)
// ---------------------------------------------------------
// Responsabilidades:
//  - identificar/criar fornecedor por CNPJ (sem duplicar);
//  - identificar produto por EAN/cÃ³digo/SKU;
//  - confirmar entrada com validaÃ§Ã£o completa;
//  - atualizar estoque no Supabase de forma transacional
//    (rollback manual em caso de erro parcial);
//  - registrar movimentaÃ©Ã©o (bipagem_history);
//  - bloquear duplicidade por chave de acesso.
//
// O estoque vive no Supabase (products / bipagem_history).
// Como o Supabase JS client nÃ£o expÃ©e transaÃ§Ã£oes SQL
// diretamente, aplicamos o padrÃ£o "compensating actions":
//  1. lÃ© estoque atual de todos os itens ANTES;
//  2. aplica updates;
//  3. se QUALQUER update falhar, reverte os jÃ¡ aplicados;
//  4. sÃ© entÃ©o registra movimentaÃ§Ãµes e marca a NF-e.
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

    const registros = db.prepare(`
        SELECT *
        FROM nfe_entradas
        ORDER BY created_at DESC, id DESC
    `).all();

    return registros.map(normalizarEntradaBanco);
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
// FORNECEDORES (normalizaÃ©Ã©o de CNPJ, sem duplicar)
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
 * Cria apenas se `criarSeNaoExistir` e os dados mÃ©nimos existirem.
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
// IDENTIFICAÃ‡ÃƒO DE PRODUTO
// =========================================================

/**
 * Tenta identificar o produto do ERP para um item da NF-e.
 * Ordem: EAN -> cÃ³digo interno -> SKU -> vÃ©nculo salvo.
 */
export async function identificarProduto(itemNfe, empresaId) {

    const ean = String(itemNfe.ean || '').replace(/\D/g, '');
    const codigo = String(itemNfe.codigo || '').trim();
    const descricao = String(itemNfe.descricao || '').trim();

    // 1. GTIN/EAN
    if (ean && ean !== 'SEM GTIN') {
        const { data } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,barcode')
            .eq('barcode', ean)
            .limit(1);
        if (data && data.length) {
            return { produto: data[0], metodo: 'EAN' };
        }
    }

    // 2. CÃ³digo interno (sku)
    if (codigo) {
        const { data } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,barcode')
            .eq('sku', codigo)
            .limit(1);
        if (data && data.length) {
            return { produto: data[0], metodo: 'CODIGO' };
        }
    }

    // 3. VÃ©nculo previamente salvo (data/nfe-vinculos-produtos.json)
    const vinculo = buscarVinculoSalvo({ empresaId, codigoFornecedor: codigo, ean });
    if (vinculo) {
        const { data } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,barcode')
            .eq('id', vinculo.produtoId)
            .limit(1);
        if (data && data.length) {
            return { produto: data[0], metodo: 'VINCULO' };
        }
    }

    return { produto: null, metodo: null };
}


/**
 * Cria automaticamente um produto do ERP a partir de um item da NF-e.
 * O produto somente Ã© criado quando nÃ£o foi encontrado por EAN, SKU ou vÃ©nculo.
 */
async function criarProdutoAutomaticamente(itemNfe, empresaId) {
    const codigo = String(itemNfe?.codigo || '').trim();
    const descricao = String(itemNfe?.descricao || '').trim() || 'Produto NF-e';
    const eanOriginal = String(itemNfe?.ean || '').trim();
    const ean = eanOriginal.replace(/\D/g, '');
    const unidade = String(itemNfe?.unidade || 'UN').trim() || 'UN';

    // -------------------------------------------------
    // 1. Tenta novamente localizar por EAN
    // -------------------------------------------------
    if (ean && ean !== '0' && ean.length >= 8) {
        const { data, error } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,barcode')
            .eq('barcode', ean)
            .limit(1);

        if (!error && data?.length) {
            return {
                produto: data[0],
                metodo: 'EAN',
                criado: false
            };
        }
    }

    // -------------------------------------------------
    // 2. Tenta novamente localizar por SKU/cÃ³digo
    // -------------------------------------------------
    if (codigo) {
        const { data, error } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,barcode')
            .eq('sku', codigo)
            .limit(1);

        if (!error && data?.length) {
            return {
                produto: data[0],
                metodo: 'CODIGO',
                criado: false
            };
        }
    }

    // -------------------------------------------------
    // 3. Gera SKU caso a NF-e nÃ£o tenha cÃ³digo
    // -------------------------------------------------
    let sku = codigo;

    if (!sku) {
        sku = `NFE-${String(Date.now())}-${Math.floor(Math.random() * 10000)}`;
    }

    // -------------------------------------------------
    // 4. Gera cÃ³digo de barras caso nÃ£o exista EAN
    // -------------------------------------------------
    let barcode = ean;

    if (!barcode || barcode === '0' || barcode.length < 8) {
        barcode = `200${Date.now()}${Math.floor(Math.random() * 1000)}`
            .slice(0, 13);
    }

    // -------------------------------------------------
    // 5. Garante SKU Ã©nico
    // -------------------------------------------------
    let skuBase = sku;
    let contadorSku = 1;

    while (true) {
        const { data: existente } = await supabase()
            .from('products')
            .select('id')
            .eq('sku', sku)
            .limit(1);

        if (!existente?.length) {
            break;
        }

        contadorSku++;
        sku = `${skuBase}-${contadorSku}`;
    }

    // -------------------------------------------------
    // 6. Garante barcode Ã©nico
    // -------------------------------------------------
    let barcodeBase = barcode;
    let contadorBarcode = 1;

    while (true) {
        const { data: existente } = await supabase()
            .from('products')
            .select('id')
            .eq('barcode', barcode)
            .limit(1);

        if (!existente?.length) {
            break;
        }

        contadorBarcode++;
        barcode = `${barcodeBase}${contadorBarcode}`.slice(0, 13);
    }

    // -------------------------------------------------
    // 7. Criar produto no cadastro do ERP
    // -------------------------------------------------
    const payload = {
        name: descricao,
        sku,
        barcode,
        current_stock: 0,
        min_stock: 0,
        max_stock: 99999,
        status: 'ativo',
        category: '',
        unit: unidade
    };

    const { data: produto, error } = await supabase()
        .from('products')
        .insert(payload)
        .select('id,name,sku,current_stock,barcode')
        .single();

    if (error || !produto) {
        throw new Error(
            `NÃ£o foi possÃ­vel criar automaticamente o produto "${descricao}": ` +
            `${error?.message || 'produto nÃ£o retornado pelo banco'}`
        );
    }

    // -------------------------------------------------
    // 8. Salvar vÃ©nculo com a NF-e/fornecedor
    // -------------------------------------------------
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
            '[ENTRADA] Produto criado, mas nÃ£o foi possÃ­vel salvar vÃ©nculo:',
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
// VALIDAÃ©Ã©O DO XML / NF-e
// =========================================================

export function validarChaveAcesso(chave) {
    if (!/^\d{44}$/.test(chave)) {
        throw new Error(
            `Chave de acesso invÃ¡lida (44 dÃ­gitos esperados). Recebida: ${chave}`
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
            `DÃ­gito verificador da chave invÃ¡lido. Informado: ${informado}; calculado: ${calculado}.`
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
            motivo: 'Esta NF-e jÃ¡ possui entrada de estoque.',
            entrada: existente
        };
    }

    return {
        duplicada: true,
        motivo: 'Esta NF-e jÃ¡ foi importada.',
        entrada: existente
    };
}

// =========================================================
// CONFIRMAÃ‡ÃƒO DA ENTRADA (TRANSAÃ‡ÃƒO COM ROLLBACK)
// =========================================================

/**
 * Confirma a entrada da NF-e:
 *  1. valida NF-e, itens, produtos e quantidades;
 *  2. lÃ© estoque atual (snapshot);
 *  3. aplica updates de estoque;
 *  4. em erro: REVERTE updates jÃ¡ aplicados (rollback);
 *  5. registra movimentaÃ§Ãµes;
 *  6. marca NF-e como CONFIRMADA.
 */
export async function confirmarEntrada({ entradaId, itens, usuario }) {

    const entradas = getEntradas();
    const index = entradas.findIndex(e => Number(e.id) === Number(entradaId));

    if (index === -1) {
        throw new Error('Entrada nÃ£o encontrada.');
    }

    const entrada = entradas[index];

    // ---------------------------------------------
    // 1. VALIDAÃ©Ã©ES
    // ---------------------------------------------
    if (entrada.status === 'CONFIRMADA' || entrada.status === 'PROCESSADA') {
        throw new Error('Esta NF-e jÃ¡ possui entrada de estoque.');
    }

    if (entrada.chave) {
        validarChaveAcesso(entrada.chave);
    }

    const itensVinculados = [];
    const produtosCriados = [];

    for (let idx = 0; idx < (itens || []).length; idx++) {

        const item = itens[idx] || {};
        const produtoNfe = (entrada.produtos || [])[idx] || {};

        const itemCompleto = {
            ...produtoNfe,
            ...item,

            codigo: item.codigo || produtoNfe.codigo || '',
            ean: item.ean || produtoNfe.ean || '',
            descricao: item.descricao || produtoNfe.descricao || '',
            unidade: item.unidade || produtoNfe.unidade || 'UN'
        };

        let produtoId = item.produtoId || null;
        let produtoEncontrado = null;
        let metodo = 'VINCULADO';
        let criadoAutomaticamente = false;

        // -------------------------------------------------
        // 1. Produto informado pelo frontend
        // -------------------------------------------------
        if (produtoId) {

            const { data, error } = await supabase()
                .from('products')
                .select('id,name,sku,current_stock,barcode')
                .eq('id', produtoId)
                .limit(1);

            if (!error && data?.length) {
                produtoEncontrado = data[0];
            } else {
                produtoId = null;
            }
        }

        // -------------------------------------------------
        // 2. Procura automÃ¡tica por EAN, SKU ou vÃ©nculo
        // -------------------------------------------------
        if (!produtoEncontrado) {

            const identificacao = await identificarProduto(
                itemCompleto,
                entrada.empresaId
            );

            if (identificacao?.produto) {
                produtoEncontrado = identificacao.produto;
                produtoId = identificacao.produto.id;
                metodo = identificacao.metodo || 'AUTOMATICO';
            }
        }

        // -------------------------------------------------
        // 3. CriaÃ§Ã£o automÃ¡tica do produto
        // -------------------------------------------------
        if (!produtoEncontrado) {

            const criado = await criarProdutoAutomaticamente(
                itemCompleto,
                entrada.empresaId
            );

            if (!criado?.produto?.id) {
                throw new Error(
                    `NÃ£o foi possÃ­vel criar o produto automaticamente: ` +
                    `${itemCompleto.descricao || itemCompleto.codigo || 'item sem descriÃ§Ã£o'}`
                );
            }

            produtoEncontrado = criado.produto;
            produtoId = criado.produto.id;
            metodo = criado.metodo;
            criadoAutomaticamente = true;

            produtosCriados.push({
                id: criado.produto.id,
                name: criado.produto.name,
                sku: criado.produto.sku
            });
        }

        // -------------------------------------------------
        // 4. Quantidade da NF-e
        // -------------------------------------------------
        const quantidade = Number(
            item.quantidade ??
            produtoNfe.quantidade ??
            0
        );

        const valorUnitario = Number(
            item.valorUnitario ??
            produtoNfe.valorUnitario ??
            0
        );

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
            throw new Error(
                `Quantidade invÃ¡lida para o produto "${itemCompleto.descricao || produtoEncontrado.name}".`
            );
        }

        // -------------------------------------------------
        // 5. Salva vÃ©nculo automÃ©tico
        // -------------------------------------------------
        try {
            salvarVinculoProduto({
                empresaId: entrada.empresaId,
                codigoFornecedor: String(itemCompleto.codigo || '').trim(),
                ean: String(itemCompleto.ean || '').replace(/\D/g, ''),
                produtoId,
                sku: produtoEncontrado.sku
            });
        } catch (erroVinculo) {
            console.warn(
                '[ENTRADA] NÃ£o foi possÃ­vel salvar vÃ©nculo automÃ©tico:',
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
        throw new Error('Nenhum item informado para entrada.');
    }

    // ---------------------------------------------
    // 2. SNAPSHOT DO ESTOQUE ATUAL
    // ---------------------------------------------
    const snapshot = new Map();

    for (const item of itensVinculados) {

        const { data, error } = await supabase()
            .from('products')
            .select('id,name,sku,current_stock,estoque_atual')
            .eq('id', item.produtoId)
            .single();

        if (error || !data) {
            throw new Error(
                `Produto ${item.produtoId} nÃ£o encontrado no ERP: ${error?.message || 'nÃ£o encontrado'}`
            );
        }

        snapshot.set(String(item.produtoId), {
            name: data.name,
            sku: data.sku,
            current_stock: Number(data.current_stock ?? 0),
            estoque_atual: Number(
                data.estoque_atual ??
                data.current_stock ??
                0
            )
        });
    }

    // ---------------------------------------------
    // 3. APLICAÃ©Ã©O DO ESTOQUE
    // ---------------------------------------------
    const aplicados = [];

    try {

        for (const item of itensVinculados) {

            const antes = snapshot.get(String(item.produtoId));

            if (!antes) {
                throw new Error(
                    `Snapshot nÃ£o encontrado para o produto ${item.produtoId}.`
                );
            }

            const novoCurrent =
                antes.current_stock + item.quantidade;

            const novoLegado =
                antes.estoque_atual + item.quantidade;

            const { error } = await supabase()
                .from('products')
                .update({
                    current_stock: novoCurrent,
                    estoque_atual: novoLegado
                })
                .eq('id', item.produtoId);

            if (error) {
                throw new Error(
                    `Falha ao atualizar estoque do produto ` +
                    `${antes.name || item.produtoId}: ${error.message}`
                );
            }

            aplicados.push({
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                anterior: antes.current_stock,
                anteriorEstoqueAtual: antes.estoque_atual,
                novo: novoCurrent,
                novoEstoqueAtual: novoLegado
            });

            console.log(
                `[ENTRADA] ESTOQUE ATUALIZADO | ` +
                `SKU ${antes.sku} | ` +
                `${antes.current_stock} + ${item.quantidade} = ${novoCurrent}`
            );
        }

        // ---------------------------------------------
        // 4. REGISTRAR HISTÃ©RICO
        // ---------------------------------------------
        const agora = new Date().toISOString();

        for (const item of itensVinculados) {

            const antes = snapshot.get(String(item.produtoId));

            const { error: erroHistorico } = await supabase()
                .from('bipagem_history')
                .insert({
                    product_id: item.produtoId,
                    product_name: antes.name,
                    product_sku: antes.sku,
                    tipo: 'entrada_nf',
                    quantidade: item.quantidade,
                    quantidade_anterior: antes.current_stock,
                    quantidade_nova:
                        antes.current_stock + item.quantidade,
                    usuario_id: usuario?.id || null,
                    usuario_nome: usuario?.nome || 'Entrada NF-e',
                    created_at: agora
                });

            if (erroHistorico) {
                registrarAuditoriaLocal({
                    tipo: 'entrada_nf',
                    product_id: item.produtoId,
                    product_name: antes.name,
                    product_sku: antes.sku,
                    quantidade: item.quantidade,
                    quantidade_anterior: antes.current_stock,
                    quantidade_nova: antes.current_stock + item.quantidade,
                    usuario_nome: usuario?.nome || 'Entrada NF-e',
                    created_at: agora,
                    origem: 'NF-e',
                    motivo_fallback: erroHistorico.message
                });
                console.warn('[ENTRADA] HistÃ³rico Supabase indisponÃ­vel; auditoria local registrada:', erroHistorico.message);
            }

            console.log(
                `[ENTRADA] HISTÃ©RICO REGISTRADO | SKU ${antes.sku} | ` +
                `quantidade ${item.quantidade}`
            );
        }

        // ---------------------------------------------
        // 5. MARCAR NF-e COMO CONFIRMADA
        // ---------------------------------------------
        entrada.status = 'CONFIRMADA';
        entrada.itensVinculados = itensVinculados;
        entrada.confirmadaEm = agora;
        entrada.confirmadaPor =
            usuario?.nome ||
            usuario?.id ||
            null;
        entrada.updatedAt = agora;

        entradas[index] = entrada;

        saveEntradas(entradas);

        console.log(
            `[ENTRADA] NF-e ${entrada.numero || entrada.chave} ` +
            `confirmada com sucesso.`
        );

        return {
            entrada,
            aplicados,
            resumo: {
                numero: entrada.numero,
                fornecedor:
                    entrada.fornecedor?.razaoSocial || '',
                quantidadeItens:
                    itensVinculados.length,
                quantidadeTotal:
                    itensVinculados.reduce(
                        (s, i) => s + i.quantidade,
                        0
                    ),
                dataHora: agora
            }
        };

    } catch (erro) {

        // ---------------------------------------------
        // 6. ROLLBACK COMPLETO
        // ---------------------------------------------
        console.error(
            '[ENTRADA] ERRO NA CONFIRMAÃ‡ÃƒO. ' +
            'Executando ROLLBACK:',
            erro.message
        );

        // Reverte os estoques jÃ¡ atualizados
        for (const aplicado of [...aplicados].reverse()) {

            try {

                const { error: erroRollback } =
                    await supabase()
                        .from('products')
                        .update({
                            current_stock:
                                aplicado.anterior,
                            estoque_atual:
                                aplicado.anteriorEstoqueAtual
                        })
                        .eq('id', aplicado.produtoId);

                if (erroRollback) {
                    console.error(
                        `[ENTRADA] FALHA NO ROLLBACK ` +
                        `DO ESTOQUE | produto ${aplicado.produtoId}:`,
                        erroRollback.message
                    );
                } else {
                    console.log(
                        `[ENTRADA] ROLLBACK OK | ` +
                        `produto ${aplicado.produtoId} | ` +
                        `estoque restaurado para ${aplicado.anterior}`
                    );
                }

            } catch (erroRollback) {

                console.error(
                    `[ENTRADA] EXCEÃ©Ã©O NO ROLLBACK ` +
                    `DO ESTOQUE | produto ${aplicado.produtoId}:`,
                    erroRollback.message
                );
            }
        }

        // Remove produtos criados automaticamente
        // somente se a operaÃ§Ã£o falhou antes da confirmaÃ§Ã£o.
        for (const produtoCriado of produtosCriados) {

            try {

                const { error: erroDelete } =
                    await supabase()
                        .from('products')
                        .delete()
                        .eq('id', produtoCriado.id);

                if (erroDelete) {
                    console.error(
                        `[ENTRADA] FALHA AO REMOVER PRODUTO ` +
                        `CRIADO NO ROLLBACK | ` +
                        `${produtoCriado.id}:`,
                        erroDelete.message
                    );
                } else {
                    console.log(
                        `[ENTRADA] PRODUTO CRIADO REMOVIDO NO ROLLBACK | ` +
                        `${produtoCriado.sku || produtoCriado.id}`
                    );
                }

            } catch (erroDelete) {

                console.error(
                    `[ENTRADA] EXCEÃ©Ã©O AO REMOVER PRODUTO ` +
                    `CRIADO NO ROLLBACK:`,
                    erroDelete.message
                );
            }
        }

        // A NF-e permanece no status anterior.
        throw new Error(
            `Entrada nÃ£o confirmada. ` +
            `Estoque revertido quando necessÃ©rio. ` +
            `Motivo: ${erro.message}`
        );
    }
}

