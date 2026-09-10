import fs from "fs";
import Database from "better-sqlite3";

const DUMP = "./backup-supabase/metal-racing-2026-09-10.sql";
const DB = "./src/backend/database/metal-racing.db";

if (!fs.existsSync(DUMP)) throw new Error("Backup SQL não encontrado.");
if (!fs.existsSync(DB)) throw new Error("SQLite não encontrado.");

const db = new Database(DB);

db.pragma("foreign_keys = OFF");
db.pragma("journal_mode = DELETE");
db.pragma("synchronous = FULL");

function q(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
}

function norm(v) {
    return String(v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function tables() {
    return db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
    `).all().map(x => x.name);
}

function columns(table) {
    return db.prepare(`PRAGMA table_info(${q(table)})`).all();
}

function hasColumn(table, column) {
    return columns(table).some(c => norm(c.name) === norm(column));
}

function addColumn(table, column, type = "TEXT") {
    if (!hasColumn(table, column)) {
        db.exec(`ALTER TABLE ${q(table)} ADD COLUMN ${q(column)} ${type}`);
    }
}

function ensureLegacyTable(sourceTable) {
    const name = "legacy_" + sourceTable
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toLowerCase();

    db.exec(`
        CREATE TABLE IF NOT EXISTS ${q(name)} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT,
            data_json TEXT NOT NULL,
            imported_at TEXT NOT NULL
        )
    `);

    return name;
}

function parseCopyBlocks(text) {

    const lines = text.split(/\r?\n/);
    const blocks = [];

    let block = null;

    for (const line of lines) {

        const m = line.match(
            /^COPY public\."?([^"\s(]+)"?\s*\((.*?)\) FROM stdin;$/
        );

        if (m) {

            block = {
                table: m[1],
                columns: m[2]
                    .split(",")
                    .map(x => x.trim().replace(/^"|"$/g, "")),
                rows: []
            };

            blocks.push(block);
            continue;
        }

        if (block && line === "\\.") {
            block = null;
            continue;
        }

        if (block && line !== "") {
            block.rows.push(line);
        }
    }

    return blocks;
}

function parsePgRow(line) {

    const result = [];
    let current = "";
    let escaped = false;

    for (let i = 0; i < line.length; i++) {

        const c = line[i];

        if (escaped) {
            current += "\\" + c;
            escaped = false;
            continue;
        }

        if (c === "\\") {
            escaped = true;
            continue;
        }

        if (c === "\t") {
            result.push(pgValue(current));
            current = "";
            continue;
        }

        current += c;
    }

    result.push(pgValue(current));

    return result;
}

function pgValue(v) {

    if (v === "\\N") return null;

    return v
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\");
}

function toNumber(v, fallback = 0) {

    if (v === null || v === undefined || v === "") {
        return fallback;
    }

    const n = Number(String(v).replace(",", "."));

    return Number.isFinite(n) ? n : fallback;
}

function toBool(v, fallback = 0) {

    if (v === null || v === undefined || v === "") {
        return fallback;
    }

    if (
        v === true ||
        v === "true" ||
        v === "TRUE" ||
        v === "1" ||
        v === 1
    ) return 1;

    return 0;
}

function now() {
    return new Date().toISOString();
}

const dump = fs.readFileSync(DUMP, "utf8");
const blocks = parseCopyBlocks(dump);

console.log("\n========================================");
console.log(" MIGRAÇÃO DEFINITIVA METAL RACING");
console.log("========================================");
console.log(`Blocos encontrados: ${blocks.length}`);

const source = {};

for (const block of blocks) {

    source[block.table] = {
        columns: block.columns,
        rows: block.rows.map(parsePgRow)
    };
}

function getRows(name) {

    if (!source[name]) return [];

    return source[name].rows.map(values => {

        const obj = {};

        source[name].columns.forEach((column, i) => {
            obj[column] = values[i] ?? null;
        });

        return obj;
    });
}

const imported = [];
const errors = [];
const legacy = [];

function saveLegacy(sourceTable, row) {

    const table = ensureLegacyTable(sourceTable);

    const sourceId =
        row.id === undefined || row.id === null
            ? null
            : String(row.id);

    db.prepare(`
        INSERT INTO ${q(table)}
        (source_id, data_json, imported_at)
        VALUES (?, ?, ?)
    `).run(
        sourceId,
        JSON.stringify(row),
        now()
    );

    legacy.push({
        table: sourceTable,
        target: table
    });
}

function report(sourceTable, targetTable, total, count) {

    imported.push({
        origem: sourceTable,
        destino: targetTable,
        origem: total,
        importados: count
    });
}

/*
==========================================================
EMPRESAS
==========================================================
*/

function migrateCompanies() {

    const rows = getRows("companies");

    if (!rows.length) return;

    addColumn("empresas", "source_id");

    const used = db.prepare(`
        SELECT id FROM empresas
    `).all().map(x => Number(x.id));

    let nextId = used.length
        ? Math.max(...used) + 1
        : 1;

    const stmt = db.prepare(`
        INSERT INTO empresas (
            id,
            source_id,
            cnpj,
            razao_social,
            nome_fantasia,
            ie,
            uf,
            cidade,
            cep,
            endereco,
            numero,
            bairro,
            telefone,
            email,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;

    for (const r of rows) {

        const id = nextId++;

        stmt.run(
            id,
            r.id,
            r.cnpj || r.document || "",
            r.razao_social || "",
            r.nome_fantasia || r.name || "",
            r.inscricao_estadual || "",
            r.estado || "",
            r.cidade || "",
            r.cep || "",
            r.endereco || "",
            r.numero || "",
            "",
            r.telefone || "",
            r.email || "",
            r.created_date || now(),
            r.updated_date || now()
        );

        count++;
    }

    report("companies", "empresas", rows.length, count);
}

/*
==========================================================
PRODUTOS
==========================================================
*/

function migrateProducts() {

    const rows = getRows("products");

    if (!rows.length) return;

    const extra = [
        ["source_id", "TEXT"],
        ["veiculo", "TEXT"],
        ["ano", "TEXT"],
        ["dimensoes", "TEXT"],
        ["fornecedor", "TEXT"],
        ["observacoes", "TEXT"],
        ["tipo_produto", "TEXT"],
        ["imagem_url", "TEXT"],
        ["status_origem", "TEXT"]
    ];

    for (const [c, t] of extra) {
        addColumn("produtos", c, t);
    }

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO produtos (
            id,
            source_id,
            sku,
            codigo,
            codigo_barras,
            ean,
            gtin,
            nome,
            descricao,
            categoria,
            marca,
            modelo,
            unidade,
            current_stock,
            estoque_atual,
            min_stock,
            max_stock,
            preco_venda,
            preco,
            custo,
            peso,
            ativo,
            veiculo,
            ano,
            dimensoes,
            fornecedor,
            observacoes,
            tipo_produto,
            imagem_url,
            status_origem,
            created_at,
            updated_at
        )
        VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
    `);

    let count = 0;

    for (const r of rows) {

        stmt.run(
            String(r.id),
            r.id,
            r.sku || "",
            r.sku || r.barcode || "",
            r.barcode || "",
            r.ean || "",
            r.gtin || "",
            r.name || "",
            "",
            r.category || "",
            r.brand || "",
            r.model || "",
            r.unit || "UN",
            toNumber(r.current_stock),
            toNumber(r.estoque_atual, toNumber(r.current_stock)),
            toNumber(r.min_stock, toNumber(r.estoque_minimo)),
            toNumber(r.max_stock, toNumber(r.estoque_maximo)),
            toNumber(r.unit_price),
            toNumber(r.unit_price),
            toNumber(r.cost_price),
            toNumber(r.weight),
            r.status === "inactive" ? 0 : 1,
            r.vehicle || "",
            r.year || "",
            r.dimensions || "",
            r.supplier || "",
            r.observations || "",
            r.product_type || "",
            r.image_url || "",
            r.status || "",
            r.created_date || r.created_at || now(),
            r.updated_date || r.updated_at || now()
        );

        count++;
    }

    report("products", "produtos", rows.length, count);
}

/*
==========================================================
PRODUCT FILES
==========================================================
*/

function migrateProductFiles() {

    const rows = getRows("product_files");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO product_files (
            id,
            product_id,
            product_name,
            product_barcode,
            file_url,
            file_name,
            file_type,
            file_size,
            file_category,
            photo_angle,
            sort_order,
            is_ai_training,
            added_by_name,
            is_primary,
            created_date,
            updated_date
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        stmt.run(
            String(r.id),
            String(r.product_id || ""),
            r.product_name || "",
            r.product_barcode || "",
            r.file_url || "",
            r.file_name || "",
            r.file_type || "",
            toNumber(r.file_size),
            r.file_category || "",
            r.photo_angle || "",
            toNumber(r.sort_order),
            toBool(r.is_ai_training),
            r.added_by_name || "",
            toBool(r.is_primary),
            r.created_date || now(),
            r.updated_date || now()
        );

        count++;
    }

    report("product_files", "product_files", rows.length, count);
}

/*
==========================================================
ETIQUETAS
==========================================================
*/

function migrateLabels() {

    const rows = getRows("product_labels");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO etiquetas (
            id,
            produto_id,
            codigo,
            descricao,
            quantidade,
            modelo,
            impressora,
            status,
            created_at
        )
        VALUES (?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                r.product_id || "",
                r.product_code || r.sku || r.barcode || "",
                r.product_name || "",
                1,
                r.category || "",
                "",
                r.status || "",
                r.created_date || now()
            );

            count++;

        } catch (e) {

            saveLegacy("product_labels", r);
        }
    }

    report("product_labels", "etiquetas", rows.length, count);
}

/*
==========================================================
BIPAGENS
==========================================================
*/

function migrateBipagens() {

    const rows = getRows("bipagens");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO bipagens (
            id,
            pedido_id,
            produto_id,
            codigo_bipado,
            quantidade,
            resultado,
            usuario_id,
            created_at
        )
        VALUES (?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                r.destino || "",
                r.produto_id || "",
                r.codigo || "",
                toNumber(r.quantidade, 1),
                r.tipo || r.observacao || "",
                Number(r.usuario_id) || null,
                r.data_hora || now()
            );

            count++;

        } catch (e) {

            saveLegacy("bipagens", r);
        }
    }

    report("bipagens", "bipagens", rows.length, count);
}

/*
==========================================================
CONTAS A PAGAR
==========================================================
*/

function migrateContasPagar() {

    const rows = getRows("contas_pagar");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO contas_pagar (
            id,
            fornecedor,
            documento,
            descricao,
            vencimento,
            valor,
            valor_pago,
            status,
            categoria,
            created_at,
            updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                r.fornecedor_nome || "",
                r.fornecedor_cnpj || r.documento || "",
                r.descricao || "",
                r.data_vencimento || "",
                toNumber(r.valor),
                toNumber(r.valor_pago),
                r.status || "",
                r.categoria || "",
                r.created_at || now(),
                r.updated_at || now()
            );

            count++;

        } catch (e) {

            saveLegacy("contas_pagar", r);
        }
    }

    report("contas_pagar", "contas_pagar", rows.length, count);
}

/*
==========================================================
NF-e ENTRADAS
==========================================================
*/

function migrateNfeEntradas() {
    addColumn("nfe_entradas", "protocolo", "TEXT");
    addColumn("nfe_entradas", "cstat", "TEXT");
    addColumn("nfe_entradas", "motivo", "TEXT");


    const rows = getRows("nfe_entradas");

    if (!rows.length) return;

    addColumn("nfe_entradas", "source_id");
    addColumn("nfe_entradas", "dados_origem");

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO nfe_entradas (
            id,
            source_id,
            chave,
            numero,
            serie,
            modelo,
            fornecedor_razao_social,
            valor_total,
            xml,
            protocolo,
            cstat,
            observacoes,
            status,
            status_manifestacao,
            data_emissao,
            data_entrada,
            created_at,
            updated_at,
            dados_origem
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        let id = Number(r.id);

        if (!Number.isFinite(id)) {
            id = undefined;
        }

        stmt.run(
            id || null,
            r.id,
            r.chave || "",
            r.numero || "",
            r.serie || "",
            r.modelo || "55",
            r.fornecedor || "",
            toNumber(r.total),
            r.xml_autorizado || r.xml_original || "",
            r.protocolo || r.nprot || "",
            r.cstat || "",
            r.xmotivo || "",
            r.status || "",
            r.manifestacao || "",
            r.data_emissao || "",
            r.data_entrada || "",
            r.created_at || now(),
            r.updated_at || now(),
            r.dados || ""
        );

        count++;

        /*
         * Os produtos da NF-e antiga ficam dentro do campo
         * "produtos". Vamos tentar transformar em itens.
         */

        if (r.produtos) {

            try {

                let produtos = JSON.parse(r.produtos);

                if (!Array.isArray(produtos)) {
                    produtos = produtos?.items || produtos?.produtos || [];
                }

                if (Array.isArray(produtos)) {

                    const nfeId = id || db.prepare(`
                        SELECT id
                        FROM nfe_entradas
                        WHERE source_id = ?
                        ORDER BY id DESC
                        LIMIT 1
                    `).get(r.id)?.id;

                    if (nfeId) {

                        const itemStmt = db.prepare(`
                            INSERT INTO nfe_entrada_itens (
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
                            )
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        `);

                        for (const p of produtos) {

                            itemStmt.run(
                                nfeId,
                                p.produtoId || p.product_id || p.id || null,
                                p.codigo || p.code || p.cProd || "",
                                p.descricao || p.nome || p.name || p.xProd || "",
                                p.ncm || p.NCM || "",
                                p.cfop || p.CFOP || "",
                                p.unidade || p.un || p.uCom || "UN",
                                toNumber(p.quantidade ?? p.qtd ?? p.qCom),
                                toNumber(p.valor_unitario ?? p.vUnCom),
                                toNumber(p.valor_total ?? p.vProd),
                                p.cst || p.CST || "",
                                p.csosn || p.CSOSN || "",
                                p.ipi || "",
                                p.pis || "",
                                p.cofins || ""
                            );
                        }
                    }
                }

            } catch (e) {

                console.log(
                    `      Aviso: produtos da NF-e ${r.id} não puderam ser extraídos: ${e.message}`
                );
            }
        }
    }

    report("nfe_entradas", "nfe_entradas", rows.length, count);
}

/*
==========================================================
PRODUÇÃO
==========================================================
*/

function migrateProductionOrders() {

    const rows = getRows("production_orders");

    if (!rows.length) return;

    addColumn("ordens_producao", "source_id");

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO ordens_producao (
            id,
            source_id,
            numero,
            produto_id,
            quantidade,
            status,
            prioridade,
            observacao,
            usuario_id,
            created_at,
            updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        stmt.run(
            String(r.id),
            r.id,
            r.order_number || "",
            r.product_id || "",
            toNumber(r.quantity),
            r.status || "",
            r.priority || "",
            r.observations || "",
            Number(r.created_by) || null,
            r.created_at || now(),
            r.updated_at || now()
        );

        count++;
    }

    report("production_orders", "ordens_producao", rows.length, count);
}

/*
==========================================================
QUADRO DE PRODUÇÃO
==========================================================
*/

function migrateQuadro() {

    const rows = getRows("quadro_producao");

    if (!rows.length) return;

    /*
     * NÃO misturamos esses registros com ordens_producao.
     * Criamos uma tabela auxiliar para preservar integralmente.
     */

    const table = ensureLegacyTable("quadro_producao");

    for (const r of rows) {

        db.prepare(`
            INSERT INTO ${q(table)}
            (source_id, data_json, imported_at)
            VALUES (?, ?, ?)
        `).run(
            r.id || null,
            JSON.stringify(r),
            now()
        );
    }

    report("quadro_producao", table, rows.length, rows.length);
}

/*
==========================================================
DEVOLUÇÕES
==========================================================
*/

function migrateReturns() {

    const rows = getRows("return_notes");

    if (!rows.length) return;

    addColumn("devolucoes", "source_id");
    addColumn("devolucoes", "numero_devolucao");
    addColumn("devolucoes", "nfe_original", "TEXT");

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO devolucoes (
            id,
            source_id,
            pedido_id,
            produto_id,
            motivo,
            status,
            quantidade,
            valor,
            observacao,
            created_at,
            updated_at,
            numero_devolucao,
            nfe_original
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                r.id,
                r.order_id || "",
                "",
                r.reason || "",
                r.status || "",
                1,
                toNumber(r.total_value),
                r.reason_notes || r.notes || "",
                r.created_date || now(),
                r.updated_date || now(),
                r.return_number || "",
                r.original_nfe_number || ""
            );

            count++;

        } catch (e) {

            saveLegacy("return_notes", r);
        }
    }

    report("return_notes", "devolucoes", rows.length, count);
}

/*
==========================================================
ALERTAS / AVISOS
==========================================================
*/

function migrateAvisos() {

    const rows = getRows("avisos");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO alertas (
            id,
            tipo,
            titulo,
            mensagem,
            prioridade,
            lido,
            created_at
        )
        VALUES (?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                "aviso",
                r.titulo || "",
                r.descricao || "",
                r.nivel || "normal",
                toBool(r.reconhecido),
                r.created_at || now()
            );

            count++;

        } catch (e) {

            saveLegacy("avisos", r);
        }
    }

    report("avisos", "alertas", rows.length, count);
}

/*
==========================================================
CONFIGURAÇÕES
==========================================================
*/

function migrateConfig() {

    const rows = getRows("system_config");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO configuracoes (
            chave,
            valor,
            tipo,
            updated_at
        )
        VALUES (?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                r.key || "",
                r.value || "",
                "string",
                r.updated_at || now()
            );

            count++;

        } catch (e) {

            saveLegacy("system_config", r);
        }
    }

    report("system_config", "configuracoes", rows.length, count);
}

/*
==========================================================
USUÁRIOS
==========================================================
*/

function migrateUsers() {

    const rows = getRows("profiles");
    const profiles = getRows("user_profiles");

    const all = [...rows];

    for (const r of profiles) {
        saveLegacy("user_profiles", r);
    }

    if (!all.length) return;

    addColumn("usuarios", "source_id");

    const stmt = db.prepare(`
        INSERT INTO usuarios (
            id,
            source_id,
            nome,
            email,
            senha_hash,
            perfil,
            ativo,
            created_at,
            updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?)
    `);

    let nextId = 1;
    let count = 0;

    const emailsUsados = new Set(
        db.prepare(`
            SELECT email
            FROM usuarios
            WHERE email IS NOT NULL
              AND email <> ''
        `)
        .all()
        .map(r => String(r.email).toLowerCase())
    );

    for (const r of all) {

        let email = String(r.email || "").trim();

        if (!email) {
            email = `usuario-${r.id || nextId}@local.metalracing`;
        }

        const emailBase = email;
        let contador = 1;

        while (emailsUsados.has(email.toLowerCase())) {

            const partes = emailBase.split("@");

            if (partes.length === 2) {
                email = `${partes[0]}+${contador}@${partes[1]}`;
            } else {
                email = `${emailBase}-${contador}`;
            }

            contador++;
        }

        emailsUsados.add(email.toLowerCase());

        stmt.run(
            nextId++,
            r.id,
            r.nome_completo || r.full_name || "",
            email,
            r.pin || "",
            r.cargo || r.role_profile || "usuario",
            1,
            r.created_at || r.created_date || now(),
            r.updated_at || r.updated_date || now()
        );

        count++;
    }

    report("profiles", "usuarios", all.length, count);
}

/*
==========================================================
MOVIMENTAÇÕES DE ESTOQUE
==========================================================
*/

function migrateStockMovements() {

    const rows = getRows("stock_movements");

    if (!rows.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO movimentacoes_estoque (
            id,
            produto_id,
            tipo,
            quantidade,
            origem,
            documento,
            usuario_id,
            observacao,
            created_at
        )
        VALUES (?,?,?,?,?,?,?,?,?)
    `);

    let count = 0;

    for (const r of rows) {

        try {

            stmt.run(
                Number(r.id) || null,
                r.production_order_id || "",
                "movimentacao",
                0,
                "stock_movements",
                "",
                Number(r.usuario_id) || null,
                r.observacao || "",
                r.created_at || r.created_date || now()
            );

            count++;

        } catch (e) {

            saveLegacy("stock_movements", r);
        }
    }

    report("stock_movements", "movimentacoes_estoque", rows.length, count);
}

/*
==========================================================
OUTRAS TABELAS SEM CORRESPONDÊNCIA DIRETA
==========================================================
*/

const coreSources = new Set([
    "companies",
    "products",
    "product_files",
    "product_labels",
    "bipagens",
    "contas_pagar",
    "nfe_entradas",
    "production_orders",
    "quadro_producao",
    "return_notes",
    "avisos",
    "system_config",
    "profiles",
    "user_profiles",
    "stock_movements"
]);

/*
==========================================================
EXECUÇÃO
==========================================================
*/

const transaction = db.transaction(() => {

    migrateCompanies();
    migrateProducts();
    migrateProductFiles();
    migrateLabels();
    migrateBipagens();
    migrateContasPagar();
    migrateNfeEntradas();
    migrateProductionOrders();
    migrateQuadro();
    migrateReturns();
    migrateAvisos();
    migrateConfig();
    migrateUsers();
    migrateStockMovements();

    /*
     * Qualquer tabela com registros que ainda não tenha
     * tratamento específico será preservada integralmente
     * em legacy_<tabela>.
     */

    for (const block of blocks) {

        if (coreSources.has(block.table)) continue;

        if (!block.rows.length) continue;

        const rows = getRows(block.table);

        for (const row of rows) {
            saveLegacy(block.table, row);
        }

        report(
            block.table,
            "legacy_" + block.table,
            rows.length,
            rows.length
        );
    }
});

try {

    transaction();

} catch (error) {

    console.error("\n========================================");
    console.error("ERRO — MIGRAÇÃO CANCELADA");
    console.error("========================================\n");
    console.error(error);

    db.close();
    process.exit(1);
}

console.log("\n========================================");
console.log(" MIGRAÇÃO CONCLUÍDA");
console.log("========================================\n");

console.table(imported);

console.log("\n========================================");
console.log("REGISTROS");
console.log("========================================");

const totalOrigem = imported.reduce(
    (a, x) => a + Number(x.origem || 0),
    0
);

const totalImportado = imported.reduce(
    (a, x) => a + Number(x.importados || 0),
    0
);

console.log("Considerados:", totalOrigem);
console.log("Importados:", totalImportado);

console.log("\n========================================");
console.log("TABELAS LEGACY CRIADAS");
console.log("========================================");

console.log(
    [...new Set(legacy.map(x => x.target))]
);

console.log("\n========================================");
console.log("CONFERÊNCIA FINAL");
console.log("========================================\n");

const targetTables = [
    "empresas",
    "produtos",
    "product_files",
    "etiquetas",
    "bipagens",
    "contas_pagar",
    "nfe_entradas",
    "nfe_entrada_itens",
    "ordens_producao",
    "devolucoes",
    "alertas",
    "configuracoes",
    "usuarios",
    "movimentacoes_estoque"
];

for (const table of targetTables) {

    try {

        const r = db.prepare(
            `SELECT COUNT(*) AS total FROM ${q(table)}`
        ).get();

        console.log(`${table.padEnd(28)} ${r.total}`);

    } catch (e) {

        console.log(`${table.padEnd(28)} ERRO`);
    }
}

db.close();

console.log("\nBanco salvo em:");
console.log(DB);
console.log("");




