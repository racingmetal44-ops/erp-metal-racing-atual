import fs from "fs";
import Database from "better-sqlite3";

const dumpPath = "./backup-supabase/metal-racing-2026-09-10.sql";
const dbPath = "./src/backend/database/metal-racing.db";

if (!fs.existsSync(dumpPath)) {
    throw new Error(`Backup não encontrado: ${dumpPath}`);
}

if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite não encontrado: ${dbPath}`);
}

console.log("\n========================================");
console.log("   MIGRAÇÃO SUPABASE -> SQLITE");
console.log("========================================\n");

const sql = fs.readFileSync(dumpPath, "utf8");
const db = new Database(dbPath);

db.pragma("foreign_keys = OFF");
db.pragma("journal_mode = DELETE");

function splitCopyRows(text) {
    const result = [];

    const lines = text.split(/\r?\n/);

    let current = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const match = line.match(
            /^COPY public\."?([^"\s(]+)"?\s*\((.*?)\) FROM stdin;$/
        );

        if (match) {
            current = {
                table: match[1],
                columns: match[2]
                    .split(",")
                    .map(x => x.trim().replace(/^"|"$/g, "")),
                rows: []
            };

            result.push(current);
            continue;
        }

        if (current && line === "\\.") {
            current = null;
            continue;
        }

        if (current && line.trim() !== "") {
            current.rows.push(line);
        }
    }

    return result;
}

function decodePgValue(value) {
    if (value === "\\N") return null;

    let result = "";
    let escaped = false;

    for (let i = 0; i < value.length; i++) {
        const c = value[i];

        if (escaped) {
            if (c === "n") result += "\n";
            else if (c === "r") result += "\r";
            else if (c === "t") result += "\t";
            else if (c === "\\") result += "\\";
            else result += c;

            escaped = false;
        } else if (c === "\\") {
            escaped = true;
        } else {
            result += c;
        }
    }

    return result;
}

function parseCopyLine(line) {
    const values = [];
    let current = "";
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (escaped) {
            current += "\\" + c;
            escaped = false;
        } else if (c === "\\") {
            escaped = true;
        } else if (c === "\t") {
            values.push(decodePgValue(current));
            current = "";
        } else {
            current += c;
        }
    }

    values.push(decodePgValue(current));

    return values;
}

function sqliteTables() {
    return db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
    `).all().map(x => x.name);
}

function sqliteColumns(table) {
    return db.prepare(`PRAGMA table_info("${table}")`).all();
}

function normalize(name) {
    return String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function findTable(sourceTable) {
    const tables = sqliteTables();

    const aliases = {
        alerts: "alertas",
        avisos: "alertas",
        audit_logs: "auditoria",
        bipagem_history: "bipagens",
        bipagens: "bipagens",
        companies: "empresas",
        contas_pagar: "contas_pagar",
        nfe_entradas: "nfe_entradas",
        orders: "pedidos",
        product_files: "product_files",
        production_orders: "ordens_producao",
        production_records: "ordem_producao_itens",
        suggestions: "sugestoes",
        system_config: "configuracoes",
        user_profiles: "usuarios",
        profiles: "usuarios",
        quadro_producao: "ordens_producao",
        return_notes: "devolucoes",
        spreadsheets: "planilhas",
        stock_movements: "movimentacoes_estoque",
        products: "produtos",
        product_labels: "etiquetas",
        production_apontamentos: "bipagens",
        production_movements: "movimentacoes_estoque"
    };

    if (aliases[sourceTable] && tables.includes(aliases[sourceTable])) {
        return aliases[sourceTable];
    }

    const exact = tables.find(t => normalize(t) === normalize(sourceTable));

    return exact || null;
}

function sourceToTargetColumn(sourceTable, sourceColumn) {
    const aliases = {

        products: {
            barcode: "codigo_barras",
            sku: "sku",
            name: "nome",
            brand: "marca",
            model: "modelo",
            vehicle: "veiculo",
            year: "ano",
            category: "categoria",
            current_stock: "current_stock",
            min_stock: "min_stock",
            unit: "unidade",
            unit_price: "preco_venda",
            cost_price: "custo",
            weight: "peso",
            dimensions: "dimensoes",
            location: "localizacao",
            supplier: "fornecedor",
            observations: "observacoes",
            product_type: "tipo_produto",
            status: "status",
            image_url: "imagem_url",
            max_stock: "max_stock",
            estoque_atual: "estoque_atual",
            estoque_minimo: "min_stock",
            estoque_maximo: "max_stock"
        },

        companies: {
            inscricao_estadual: "ie",
            estado: "uf",
            name: "nome_fantasia",
            document: "cnpj"
        },

        profiles: {
            nome_completo: "nome",
            cargo: "perfil",
            pin: "senha_hash"
        },

        user_profiles: {
            full_name: "nome",
            role_profile: "perfil",
            pin: "senha_hash",
            email: "email"
        },

        system_config: {
            key: "chave",
            value: "valor"
        },

        suggestions: {
            author_name: "usuario_nome",
            reviewer_name: "revisor_nome",
            review_notes: "resposta"
        },

        stock_movements: {
            operator_name: "usuario_id",
            observacao: "observacao"
        },

        nfe_entradas: {
            fornecedor: "fornecedor_razao_social",
            total: "valor_total",
            xml_original: "xml",
            xmotivo: "observacoes",
            manifestacao: "status_manifestacao"
        },

        product_files: {
            product_id: "product_id"
        },

        return_notes: {
            reason: "motivo",
            reason_notes: "observacao",
            total_value: "valor",
            product_name: "produto_nome"
        }
    };

    return aliases[sourceTable]?.[sourceColumn] || sourceColumn;
}

function ensureColumn(table, column) {

    const cols = sqliteColumns(table);

    if (cols.some(c => normalize(c.name) === normalize(column))) {
        return;
    }

    const safe = column.replace(/[^a-zA-Z0-9_]/g, "_");

    console.log(`      + criando coluna ${table}.${safe}`);

    db.exec(`
        ALTER TABLE "${table}"
        ADD COLUMN "${safe}" TEXT
    `);
}

function convertValue(table, column, value) {

    if (value === null) return null;

    const numericColumns = new Set([
        "current_stock",
        "estoque_atual",
        "min_stock",
        "max_stock",
        "preco",
        "preco_venda",
        "custo",
        "peso",
        "quantidade",
        "valor",
        "valor_total",
        "valor_produtos",
        "valor_frete",
        "valor_desconto",
        "valor_pago",
        "total_value",
        "unit_price",
        "cost_price",
        "product_value",
        "cost",
        "pieces_qty",
        "install_time_min",
        "x_pct",
        "y_pct"
    ]);

    if (numericColumns.has(column)) {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
    }

    return value;
}

function findPrimaryKey(table) {
    const cols = sqliteColumns(table);

    return cols.find(c => c.pk === 1)?.name || null;
}

const copies = splitCopyRows(sql);

console.log(`Blocos COPY encontrados: ${copies.length}\n`);

const stats = [];

const run = db.transaction(() => {

    for (const copy of copies) {

        if (!copy.rows.length) {
            continue;
        }

        const target = findTable(copy.table);

        if (!target) {
            console.log(`\n[IGNORADA] ${copy.table} -> sem tabela equivalente`);
            continue;
        }

        console.log(
            `\n[MIGRANDO] ${copy.table} (${copy.rows.length}) -> ${target}`
        );

        const mappedColumns = copy.columns.map(col =>
            sourceToTargetColumn(copy.table, col)
        );

        for (const col of mappedColumns) {
            ensureColumn(target, col);
        }

        const targetCols = sqliteColumns(target);
        const validColumns = [];

        for (let i = 0; i < mappedColumns.length; i++) {

            const sourceColumn = copy.columns[i];
            const targetColumn = mappedColumns[i];

            const exists = targetCols.some(
                c => normalize(c.name) === normalize(targetColumn)
            );

            if (exists) {
                validColumns.push({
                    sourceColumn,
                    targetColumn,
                    index: i
                });
            }
        }

        if (!validColumns.length) {
            console.log(`      nenhuma coluna compatível`);
            continue;
        }

        const columnsSql = validColumns
            .map(x => `"${x.targetColumn}"`)
            .join(", ");

        const placeholders = validColumns
            .map(() => "?")
            .join(", ");

        const insert = db.prepare(`
            INSERT OR REPLACE INTO "${target}"
            (${columnsSql})
            VALUES (${placeholders})
        `);

        let imported = 0;

        for (const row of copy.rows) {

            const values = parseCopyLine(row);

            const finalValues = validColumns.map(x =>
                convertValue(
                    target,
                    x.targetColumn,
                    values[x.index] ?? null
                )
            );

            try {
                insert.run(...finalValues);
                imported++;
            } catch (err) {

                console.log(
                    `      [ERRO] ${target}: ${err.message}`
                );
            }
        }

        stats.push({
            origem: copy.table,
            destino: target,
            origem_registros: copy.rows.length,
            importados: imported
        });

        console.log(`      importados: ${imported}`);
    }
});

try {

    run();

} catch (error) {

    console.error("\nERRO FATAL:");
    console.error(error);

    db.close();

    process.exit(1);
}

console.log("\n========================================");
console.log("         RESULTADO DA MIGRAÇÃO");
console.log("========================================\n");

console.table(stats);

console.log("\n========================================");

const totalOrigem = stats.reduce(
    (sum, x) => sum + x.origem_registros,
    0
);

const totalImportado = stats.reduce(
    (sum, x) => sum + x.importados,
    0
);

console.log("Registros considerados:", totalOrigem);
console.log("Registros importados:", totalImportado);

console.log("========================================\n");

db.close();
