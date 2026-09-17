import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import printer from 'pdf-to-printer';
import bwipjs from 'bwip-js';
import db from '../database/db.js';

const router = express.Router();
async function detectarImpressora(nomeConfigurado) {
    try {
        const lista = await printer.getPrinters();
        const nomes = (lista || [])
            .map(p => String(p?.name || p?.printerName || p || '').trim())
            .filter(Boolean);

        // 1) Se o nome configurado existe, usa ele
        if (nomeConfigurado && nomes.includes(nomeConfigurado)) {
            return nomeConfigurado;
        }

        // 2) Palavras-chave de impressoras térmicas (expandido)
        const palavras = [
            'LABEL', 'ZEBRA', 'ELGIN', 'ARGOX', 'TSC', 'GODEX', 'BEMATECH',
            'ETIQUETA', 'EPSON', 'STAR', 'DARUMA', 'TANCA', 'CUSTOM',
            'POS', 'THERMAL', 'RECEIPT', 'TÉRMICA', 'TERMICA',
            'TM-T', 'TM-U', 'QL-', 'LW-', 'ZD', 'GK420', 'GX430'
        ];
        const encontrada = nomes.find(n =>
            palavras.some(p => n.toUpperCase().includes(p.toUpperCase()))
        );

        if (encontrada) {
            console.log(`[ETIQUETA] "${nomeConfigurado}" nao encontrada. Usando "${encontrada}" automaticamente.`);
            try {
                db.prepare(`
                    UPDATE configuracoes
                    SET valor = ?, updated_at = ?
                    WHERE chave = 'impressora_etiquetas_padrao'
                `).run(encontrada, new Date().toISOString());
            } catch (e) { /* silencioso */ }
            return encontrada;
        }

        // 3) Fallback: primeira impressora disponivel
        if (nomes.length > 0) {
            console.log(`[ETIQUETA] Nenhuma impressora termica encontrada. Usando "${nomes[0]}".`);
            return nomes[0];
        }

        throw new Error('Nenhuma impressora disponivel no sistema.');
    } catch (err) {
        console.error('[ETIQUETA] Erro ao detectar impressora:', err.message);
        return nomeConfigurado;
    }
}
async function imprimirEtiquetaProducao(ordem, opcoes = {}) {
    try {
        const permitirReimpressao = opcoes?.permitirReimpressao === true;
        const impressoraOverride = String(opcoes?.impressora || '').trim();
        const configuracao = db.prepare(`

            SELECT valor
            FROM configuracoes
            WHERE chave = 'impressora_etiquetas_padrao'
            LIMIT 1
        `).get();

        const impressoraConfigurada = impressoraOverride || String(configuracao?.valor || '').trim();

        const impressora = await detectarImpressora(impressoraConfigurada);

        if (!impressora) {
            throw new Error('Nenhuma impressora de etiquetas foi configurada.');
        }

        const codigo = String(
            ordem.sku ||
            ordem.product_code ||
            ordem.codigo ||
            ordem.numero ||
            ''
        ).trim();

        const nome = String(
            ordem.product_name ||
            ordem.descricao ||
            'PRODUTO'
        ).trim();

        const quantidade = Math.max(
            1,
            Number.parseInt(ordem.quantidade, 10) || 1
        );

        const pedidoId = String(ordem.id || '').trim();
        const produtoId = ordem.product_id ? String(ordem.product_id) : null;
        const barcode = String(
            ordem.barcode ||
            ordem.ean ||
            ordem.gtin ||
            codigo
        ).trim();

        if (!pedidoId) {
            throw new Error('A ordem nÃƒÂ£o possui ID para vincular a etiqueta.');
        }

        // Procura primeiro uma etiqueta vinculada ao pedido.
        // Se nÃƒÂ£o existir, procura a etiqueta jÃƒÂ¡ cadastrada para o produto.
        const etiquetaExistente = db.prepare(`
            SELECT *
            FROM etiquetas
            WHERE pedido_id = ?
               OR TRIM(COALESCE(codigo, '')) = ?
               OR TRIM(COALESCE(product_code, '')) = ?
               OR TRIM(COALESCE(sku, '')) = ?
               OR TRIM(COALESCE(barcode, '')) = ?
               OR LOWER(TRIM(COALESCE(descricao, ''))) = LOWER(?)
               OR LOWER(TRIM(COALESCE(product_name, ''))) = LOWER(?)
            ORDER BY
                CASE
                    WHEN pedido_id = ? THEN 0
                    WHEN TRIM(COALESCE(codigo, '')) = ? THEN 1
                    WHEN TRIM(COALESCE(product_code, '')) = ? THEN 2
                    WHEN TRIM(COALESCE(sku, '')) = ? THEN 3
                    WHEN TRIM(COALESCE(barcode, '')) = ? THEN 4
                    ELSE 5
                END,
                id DESC
            LIMIT 1
        `).get(
            pedidoId,
            codigo,
            codigo,
            codigo,
            barcode,
            nome,
            nome,
            pedidoId,
            codigo,
            codigo,
            codigo,
            barcode
        );

        if (
            etiquetaExistente?.status === 'IMPRESSA' &&
            etiquetaExistente?.pedido_id === pedidoId &&
            !permitirReimpressao
        ) {
            console.log(
                `[ETIQUETA AUTOMÃƒÂTICA] Etiqueta jÃƒÂ¡ impressa para o pedido ${pedidoId}.`
            );

            return {
                success: true,
                jaImpressa: true,
                etiquetaId: etiquetaExistente.id,
                impressora: etiquetaExistente.impressora
            };
        }

        let etiquetaId = etiquetaExistente?.id || null;

        // Quando existe uma etiqueta cadastrada, preserva os dados dela.
        if (etiquetaExistente?.id) {
            etiquetaExistente._barcodeProducao = String(
                etiquetaExistente.barcode ||
                etiquetaExistente.codigo ||
                etiquetaExistente.product_code ||
                etiquetaExistente.sku ||
                barcode ||
                codigo ||
                ''
            ).trim();

            etiquetaExistente._nomeProducao = String(
                etiquetaExistente.descricao ||
                etiquetaExistente.product_name ||
                nome ||
                'PRODUTO'
            ).trim();

            etiquetaExistente._quantidadeProducao = Math.max(
                1,
                Number.parseInt(etiquetaExistente.quantidade, 10) || quantidade
            );

            console.log(
                '[ETIQUETA AUTOMÃƒÂTICA] Etiqueta encontrada:',
                etiquetaExistente.id,
                etiquetaExistente._barcodeProducao,
                etiquetaExistente._nomeProducao
            );
        }

        const pasta = path.join(
            process.cwd(),
            'storage',
            'production-labels'
        );

        fs.mkdirSync(pasta, { recursive: true });

        const nomeArquivo =
            `etiqueta-${pedidoId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.pdf`;

        const arquivoPdf = path.join(pasta, nomeArquivo);

        const LARGURA_MM = 50;
        const ALTURA_MM  = 30;
        const MM_PT      = 2.83465;

        const doc = new PDFDocument({
            size: [LARGURA_MM * MM_PT, ALTURA_MM * MM_PT],
            margin: 0,
            autoFirstPage: true
        });

        const stream = fs.createWriteStream(arquivoPdf);
        doc.pipe(stream);

        const W = LARGURA_MM * MM_PT;   // largura em pontos
        const H = ALTURA_MM  * MM_PT;   // altura em pontos

        // ROTACAO 180 (impressora LABEL 3 puxa ao contrario)
        doc.save();
        doc.translate(0, 0);
        doc.rotate(0);

        const nomeProduto = String(etiquetaExistente?._nomeProducao || nome || 'PRODUTO').trim();
        const codigoProduto = String(etiquetaExistente?._barcodeProducao || barcode || codigo || '').trim();
        const quantidadeProduto = String(etiquetaExistente?._quantidadeProducao || quantidade || 1);

        // ---- LINHA SUPERIOR ----
        doc.moveTo(2, 3).lineTo(W - 2, 3).lineWidth(0.8).strokeColor('#000000').stroke();

        // ---- NOME DO PRODUTO (bold, grande) ----
        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#000000')
            .text(nomeProduto, 3, 8, {
                width: W - 6,
                align: 'center',
                height: 12,
                ellipsis: true
            });

        // ---- CODIGO (ex: D-1586) ----
        doc.font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#333333')
            .text(codigoProduto || '-', 3, 20, {
                width: W - 6,
                align: 'center'
            });

        // ---- SKU ----
        const skuProduto = String(ordem.sku || etiquetaExistente?.sku || 'N/D').trim() || 'N/D';
        doc.font('Helvetica')
            .fontSize(6)
            .fillColor('#666666')
            .text('SKU: ' + skuProduto, 3, 30, {
                width: W - 6,
                align: 'center'
            });

        // ---- LOTE ----
        const loteProduto = String(etiquetaExistente?.lote || ordem.lote || 'N/D').trim() || 'N/D';
        doc.font('Helvetica')
            .fontSize(6)
            .fillColor('#666666')
            .text('Lote: ' + loteProduto, 3, 38, {
                width: W - 6,
                align: 'center'
            });

        // ---- CODIGO DE BARRAS ----
        let barcodeBuffer = null;
        try {
            barcodeBuffer = await bwipjs.toBuffer({
                bcid: 'code128',
                text: codigoProduto || 'SEM-CODIGO',
                scale: 3,
                height: 14,
                includetext: false,     // nao incluir texto no barcode
                paddingwidth: 0,
                paddingheight: 0
            });
        } catch (errBarcode) {
            console.error('[ETIQUETA] Erro barcode:', errBarcode.message);
        }

        if (barcodeBuffer) {
            doc.image(barcodeBuffer, 4, 48, {
                fit: [W - 8, 22],
                align: 'center',
                valign: 'center'
            });
        }

        // ---- CODIGO REPETIDO ABAIXO DO BARCODE ----
        doc.font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#333333')
            .text(codigoProduto || '-', 3, H - 10, {
                width: W - 6,
                align: 'center'
            });

        doc.restore();
        doc.end();

        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        await printer.print(arquivoPdf, {
            printer: impressora,
            silent: true,
            scale: 'noscale',              // NAO escalar — mantem 50x30mm
            orientation: 'landscape',       // horizontal
            monochrome: true,               // preto e branco
            paperSize: 'A6',                // A6 e o mais proximo de 50x30mm
            side: 'simplex'                 // so um lado
        });

        db.prepare(`
            UPDATE etiquetas
            SET
                status = 'IMPRESSA',
                impressora = ?
            WHERE id = ?
        `).run(
            impressora,
            etiquetaId
        );

        console.log(
            `[ETIQUETA AUTOMÃƒÂTICA] Impressa para "${impressora}" | Etiqueta ID: ${etiquetaId} | Pedido: ${pedidoId} | PDF: ${arquivoPdf}`
        );

        return {
            success: true,
            etiquetaId,
            impressora,
            arquivo: arquivoPdf
        };

    } catch (error) {
        console.error(
            '[ETIQUETA AUTOMÃƒÂTICA] Erro ao imprimir:',
            error
        );

        return {
            success: false,
            error: error.message || 'Erro ao imprimir etiqueta.'
        };
    }
}
const PRODUCTION_ORDERS_DIR = path.join(process.cwd(), 'storage', 'production-orders');

if (!fs.existsSync(PRODUCTION_ORDERS_DIR)) {
    fs.mkdirSync(PRODUCTION_ORDERS_DIR, { recursive: true });
}

const productionPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const orderId = String(req.params.id || '').trim();

        if (!orderId) {
            return cb(new Error('ID da ordem nÃƒÂ£o informado.'));
        }

        const orderDir = path.join(PRODUCTION_ORDERS_DIR, orderId);
        fs.mkdirSync(orderDir, { recursive: true });

        cb(null, orderDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        cb(null, `foto${ext}`);
    }
});

const uploadProductionPhoto = multer({
    storage: productionPhotoStorage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (String(file.mimetype || '').startsWith('image/')) {
            return cb(null, true);
        }

        cb(new Error('Apenas arquivos de imagem sÃƒÂ£o permitidos.'));
    }
});

function garantirTabelas() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS production_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            stage TEXT,
            description TEXT,
            user_id INTEGER,
            user_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_production_movements_order_id
        ON production_movements(order_id);

        CREATE TABLE IF NOT EXISTS production_apontamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            operador_id INTEGER,
            operador_nome TEXT,
            etapa TEXT,
            tipo TEXT,
            inicio TEXT,
            fim TEXT,
            quantidade REAL DEFAULT 0,
            observacao TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_production_apontamentos_order_id
        ON production_apontamentos(order_id);

        CREATE INDEX IF NOT EXISTS idx_production_apontamentos_operador
        ON production_apontamentos(operador_id);

        CREATE TABLE IF NOT EXISTS production_stage_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            operador_id INTEGER,
            operador_nome TEXT,
            entrada TEXT NOT NULL,
            saida TEXT,
            duracao_segundos INTEGER,
            setor_anterior TEXT,
            setor_destino TEXT,
            observacao TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_production_stage_history_order
        ON production_stage_history(order_id);

        CREATE INDEX IF NOT EXISTS idx_production_stage_history_stage
        ON production_stage_history(stage);

        CREATE INDEX IF NOT EXISTS idx_production_stage_history_open
        ON production_stage_history(order_id, saida);
    `);

    const colunas = db.prepare(`
        PRAGMA table_info(ordens_producao)
    `).all();

    const nomes = colunas.map(c => c.name);

    if (!nomes.includes('current_stage')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN current_stage TEXT DEFAULT 'Recebido'
        `);
    }

    if (!nomes.includes('product_name')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN product_name TEXT DEFAULT ''
        `);
    }

    if (!nomes.includes('sku')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN sku TEXT DEFAULT ''
        `);
    }

    if (!nomes.includes('client')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN client TEXT DEFAULT ''
        `);
    }

    if (!nomes.includes('origem')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN origem TEXT DEFAULT 'shopee'
        `);
    }

    if (!nomes.includes('image_url')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN image_url TEXT DEFAULT ''
        `);
    }

    if (!nomes.includes('operador_id')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN operador_id INTEGER
        `);
    }

    if (!nomes.includes('operador_nome')) {
        db.exec(`
            ALTER TABLE ordens_producao
            ADD COLUMN operador_nome TEXT DEFAULT ''
        `);
    }

    db.prepare(`
        UPDATE ordens_producao
        SET current_stage = 'Recebido'
        WHERE current_stage IS NULL
           OR TRIM(current_stage) = ''
    `).run();
}

garantirTabelas();

function agora() {
    return new Date().toISOString();
}

function obterEtapas() {
    const config = db.prepare(`
        SELECT valor
        FROM configuracoes
        WHERE chave = 'production_stages'
        LIMIT 1
    `).get();

    if (config?.valor) {
        try {
            const etapas = JSON.parse(config.valor);

            if (Array.isArray(etapas) && etapas.length > 0) {
                return etapas;
            }
        } catch {
            // fallback
        }
    }

    return [
        'Recebido',
        'Corte a Laser',
        'Dobra',
        'Solda',
        'Lixamento',
        'QuÃƒÂ¯Ã‚Â¿Ã‚Â½mico',
        'Pintura',
        'Montagem',
        'InspeÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o de Qualidade',
        'Embalagem',
        'ExpediÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o',
        'Entregue'
    ];
}

function normalizarOrdem(row) {
    if (!row) {
        return null;
    }

    const produto = row.produto_id
        ? db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
            LIMIT 1
        `).get(row.produto_id)
        : null;

    const movements = db.prepare(`
        SELECT *
        FROM production_movements
        WHERE order_id = ?
        ORDER BY id ASC
    `).all(row.id);

    const apontamentos = db.prepare(`
        SELECT *
        FROM production_apontamentos
        WHERE order_id = ?
        ORDER BY id ASC
    `).all(row.id);

    const stageHistory = db.prepare(`
        SELECT *
        FROM production_stage_history
        WHERE order_id = ?
        ORDER BY id ASC
    `).all(row.id);

    return {
        id: row.id,

        order_number: row.numero,
        numero: row.numero,

        product_id: row.produto_id || null,

        product_name:
            row.product_name ||
            produto?.nome ||
            produto?.name ||
            '',

        sku:
            row.sku ||
            produto?.sku ||
            produto?.codigo ||
            '',

        client: row.client || '',

        origem:
            row.origem ||
            'shopee',

        image_url:
            row.image_url ||
            '',

        operador_id:
            row.operador_id || null,

        operador_nome:
            row.operador_nome || '',

        responsavel_cadastro_id:
            row.responsavel_cadastro_id || null,

        responsavel_cadastro_nome:
            row.responsavel_cadastro_nome || '',

        quantity: Number(row.quantidade || 0),
        quantidade: Number(row.quantidade || 0),

        quantidade_produzida:
            Number(row.quantidade_produzida || 0),

        priority: row.prioridade || 'Media',
        prioridade: row.prioridade || 'Media',

        current_stage:
            row.status === 'Finalizado'
                ? 'Entregue'
                : (row.current_stage || 'Recebido'),

        status:
            row.status || 'Aguardando ProduÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o',

        expected_delivery:
            row.data_prevista || null,

        data_prevista:
            row.data_prevista || null,

        observations:
            row.observacao || '',

        observacao:
            row.observacao || '',

        created_at: row.created_at,
        updated_at: row.updated_at,

        completed_at:
            row.data_conclusao || null,

        movements,
        apontamentos,
        stage_history: stageHistory
    };
}

/*
 * GET /api/pcp/orders
 */
router.get('/printers', async (req, res) => {
    try {
        const impressoras = await printer.getPrinters();

        const configuracao = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'impressora_etiquetas_padrao' LIMIT 1").get();

        const padraoConfigurada = String(configuracao?.valor || '').trim();

        const lista = (impressoras || [])
            .map((item) => ({
                name: String(item?.name || item?.printerName || item || '').trim()
            }))
            .filter((item) => item.name);

        const padrao =
            lista.find((item) => item.name === padraoConfigurada)?.name ||
            padraoConfigurada ||
            lista[0]?.name ||
            '';

        res.json({
            success: true,
            printers: lista,
            data: lista,
            defaultPrinter: padrao
        });
    } catch (error) {
        console.error('[PCP] GET /printers:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/orders', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT *
            FROM ordens_producao
            ORDER BY created_at DESC, numero DESC
        `).all();

        const orders = rows.map(normalizarOrdem);

        res.json({
            success: true,
            data: orders,
            orders,
            count: orders.length
        });
    } catch (error) {
        console.error('[PCP] GET /orders:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/orders/:id
 */
router.get('/orders/:id/label-preview', async (req, res) => {
    try {
        const ordem = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
            LIMIT 1
        `).get(req.params.id);

        if (!ordem) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produção não encontrada.'
            });
        }

        if (String(ordem.current_stage || '').trim() !== 'Embalagem') {
            return res.status(400).json({
                success: false,
                error: 'A etiqueta só pode ser impressa quando a ordem estiver em Embalagem.'
            });
        }

        const etiqueta = db.prepare(`
            SELECT *
            FROM etiquetas
            WHERE pedido_id = ?
               OR produto_id = ?
               OR sku = ?
               OR product_code = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(
            ordem.id,
            ordem.produto_id,
            ordem.sku,
            ordem.sku
        );

        const nome = String(
            etiqueta?.product_name ||
            etiqueta?.descricao ||
            ordem.product_name ||
            'Produto'
        ).trim();

        const codigo = String(
            etiqueta?.barcode ||
            etiqueta?.product_code ||
            etiqueta?.codigo ||
            etiqueta?.sku ||
            ordem.sku ||
            ordem.produto_id ||
            ordem.id
        ).trim();

        const sku = String(
            etiqueta?.sku ||
            ordem.sku ||
            ''
        ).trim();

        const quantidade = Number(
            etiqueta?.quantidade ||
            ordem.quantidade ||
            1
        );

        let barcode = '';

        try {
            const png = await bwipjs.toBuffer({
                bcid: 'code128',
                text: codigo,
                scale: 3,
                height: 12,
                includetext: true,
                textxalign: 'center'
            });

            barcode = `data:image/png;base64,${png.toString('base64')}`;
        } catch (barcodeError) {
            console.error('[PCP] Erro ao gerar código de barras:', barcodeError);
        }

        res.json({
            success: true,
            preview: {
                orderId: ordem.id,
                numero: ordem.numero,
                nome,
                codigo,
                sku,
                quantidade,
                imagem: etiqueta?.image_url || ordem.image_url || '',
                barcode,
                statusEtiqueta: etiqueta?.status || 'PENDENTE'
            }
        });
    } catch (error) {
        console.error('[PCP] GET /orders/:id/label-preview:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/orders/:id', (req, res) => {
    try {
        const row = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(req.params.id);

        if (!row) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o nÃƒÂ¯Ã‚Â¿Ã‚Â½o encontrada'
            });
        }

        res.json({
            success: true,
            data: normalizarOrdem(row)
        });
    } catch (error) {
        console.error('[PCP] GET /orders/:id:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/stats
 */
router.get('/stats', (req, res) => {
    try {
        const total = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
        `).get().total;

        const pending = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status NOT IN ('Finalizado', 'Entregue')
        `).get().total;

        const inProduction = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status = 'Em ProduÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o'
        `).get().total;

        const completed = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status IN ('Finalizado', 'Entregue')
        `).get().total;

        const quantities = db.prepare(`
            SELECT
                COALESCE(SUM(quantidade), 0) AS total_quantity,
                COALESCE(SUM(quantidade_produzida), 0) AS produced_quantity
            FROM ordens_producao
        `).get();

        const stats = {
            total_orders: Number(total || 0),
            pending_orders: Number(pending || 0),
            in_production: Number(inProduction || 0),
            completed_orders: Number(completed || 0),
            total_quantity: Number(quantities.total_quantity || 0),
            produced_quantity: Number(quantities.produced_quantity || 0)
        };

        res.json({
            success: true,
            data: stats,
            stats
        });
    } catch (error) {
        console.error('[PCP] GET /stats:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/stages
 */
router.get('/stages', (req, res) => {
    try {
        const stages = obterEtapas();

        res.json({
            success: true,
            data: stages,
            stages
        });
    } catch (error) {
        console.error('[PCP] GET /stages:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * PATCH /api/pcp/orders/:id/stage
 */
router.patch('/orders/:id/stage', async (req, res) => {
    try {
        const body = req.body || {};

        const stage = body.stage;

        const operadorId =
            body.operador_id ??
            body.operadorId ??
            null;

        const operadorNome =
            body.operador_nome ??
            body.operadorNome ??
            '';

        const observacao =
            body.observacao ??
            body.observations ??
            body.observacoes ??
            '';

        if (!stage) {
            return res.status(400).json({
                success: false,
                error: 'Etapa nÃƒÂ£o informada'
            });
        }

        const orderId = req.params.id;

        const order = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada'
            });
        }

        const stages = obterEtapas();

        if (!stages.includes(stage)) {
            return res.status(400).json({
                success: false,
                error: `Etapa invÃƒÂ¡lida: ${stage}`,
                stages
            });
        }

        const stageAnterior =
            order.status === 'Finalizado'
                ? stages[stages.length - 1]
                : (order.current_stage || stages[0]);

        if (stageAnterior !== stage && !operadorId) {
            return res.status(400).json({
                success: false,
                error: `Selecione um funcionÃƒÂ¡rio para concluir o setor "${stageAnterior}".`
            });
        }

        const stageFinal = stages[stages.length - 1];

        const statusFinal = stage === stageFinal
            ? 'Finalizado'
            : (stage === stages[0] ? 'Aguardando ProduÃƒÂ§ÃƒÂ£o' : 'Em ProduÃƒÂ§ÃƒÂ£o');

        const dataAtual = agora();

        const transaction = db.transaction(() => {

            /*
             * ============================================================
             * 1. FECHA O HISTÃƒâ€œRICO DO SETOR ANTERIOR
             * ============================================================
             */
            if (stageAnterior !== stage) {
                const historicoAberto = db.prepare(`
                    SELECT *
                    FROM production_stage_history
                    WHERE order_id = ?
                      AND saida IS NULL
                    ORDER BY id DESC
                    LIMIT 1
                `).get(orderId);

                if (historicoAberto) {
                    const entradaDate = new Date(historicoAberto.entrada);
                    const saidaDate = new Date(dataAtual);

                    const duracaoSegundos = Number.isNaN(entradaDate.getTime())
                        ? 0
                        : Math.max(
                            0,
                            Math.floor(
                                (saidaDate.getTime() - entradaDate.getTime()) / 1000
                            )
                        );

                    db.prepare(`
                        UPDATE production_stage_history
                        SET
                            operador_id = ?,
                            operador_nome = ?,
                            saida = ?,
                            duracao_segundos = ?,
                            setor_destino = ?,
                            observacao = CASE
                                WHEN ? <> ''
                                THEN ?
                                ELSE observacao
                            END,
                            updated_at = ?
                        WHERE id = ?
                    `).run(
                        operadorId,
                        operadorNome || historicoAberto.operador_nome || 'Usuario',
                        dataAtual,
                        duracaoSegundos,
                        stage,
                        observacao,
                        observacao,
                        dataAtual,
                        historicoAberto.id
                    );

                    /*
                     * Auditoria da saÃƒÂ­da do setor
                     */
                    db.prepare(`
                        INSERT INTO production_movements (
                            order_id,
                            stage,
                            description,
                            user_id,
                            user_name,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        orderId,
                        historicoAberto.stage,
                        `SaÃƒÂ­da do setor: ${historicoAberto.stage} Ã¢â€ â€™ ${stage} | Tempo: ${duracaoSegundos}s`,
                        operadorId,
                        operadorNome || historicoAberto.operador_nome || 'Usuario',
                        dataAtual
                    );
                }

                /*
                 * ========================================================
                 * 2. ABRE O HISTÃƒâ€œRICO DO NOVO SETOR
                 * ========================================================
                 */
                db.prepare(`
                    INSERT INTO production_stage_history (
                        order_id,
                        stage,
                        operador_id,
                        operador_nome,
                        entrada,
                        saida,
                        duracao_segundos,
                        setor_anterior,
                        setor_destino,
                        observacao,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, NULL, '', ?, NULL, NULL, ?, NULL, ?, ?, ?)
                `).run(
                    orderId,
                    stage,
                    dataAtual,
                    stageAnterior || null,
                    observacao,
                    dataAtual,
                    dataAtual
                );

                /*
                 * Auditoria da entrada no novo setor
                 */
                db.prepare(`
                    INSERT INTO production_movements (
                        order_id,
                        stage,
                        description,
                        user_id,
                        user_name,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    orderId,
                    stage,
                    `Entrada no setor: ${stageAnterior} Ã¢â€ â€™ ${stage}`,
                    operadorId,
                    operadorNome || 'Usuario',
                    dataAtual
                );
            } else {
                /*
                 * Mesmo setor:
                 * nÃƒÂ£o cria outro intervalo.
                 * Apenas registra a aÃƒÂ§ÃƒÂ£o/operador.
                 */
                db.prepare(`
                    UPDATE production_stage_history
                    SET
                        operador_id = ?,
                        operador_nome = ?,
                        observacao = CASE
                            WHEN ? <> ''
                            THEN ?
                            ELSE observacao
                        END,
                        updated_at = ?
                    WHERE order_id = ?
                      AND saida IS NULL
                    ORDER BY id DESC
                    LIMIT 1
                `).run(
                    operadorId,
                    operadorNome || '',
                    observacao,
                    observacao,
                    dataAtual,
                    orderId
                );

                db.prepare(`
                    INSERT INTO production_movements (
                        order_id,
                        stage,
                        description,
                        user_id,
                        user_name,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    orderId,
                    stage,
                    `AtualizaÃƒÂ§ÃƒÂ£o no setor: ${stage}`,
                    operadorId,
                    operadorNome || 'Usuario',
                    dataAtual
                );
            }

            /*
             * ============================================================
             * 3. ATUALIZA A ORDEM
             * ============================================================
             */
            db.prepare(`
                UPDATE ordens_producao
                SET
                    current_stage = ?,
                    status = ?,
                    operador_id = NULL,
                    operador_nome = '',
                    data_inicio = CASE
                        WHEN ? <> 'Recebido' AND data_inicio IS NULL
                        THEN ?
                        ELSE data_inicio
                    END,
                    data_conclusao = CASE
                        WHEN ? = ?
                        THEN ?
                        ELSE NULL
                    END,
                    updated_at = ?
                WHERE id = ?
            `).run(
                stage,
                statusFinal,
                stage,
                dataAtual,
                stage,
                stageFinal,
                dataAtual,
                dataAtual,
                orderId
            );
        });

        transaction();

        const updated = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        // ETIQUETA-AUTOMATICA-EMBALAGEM
        let impressaoAutomatica = null;
        if (String(stage).toLowerCase() === 'embalagem') {
            try {
                const resultado = await imprimirEtiquetaProducao(updated);
                impressaoAutomatica = { sucesso: true, ...resultado };
                console.log('[PCP] Etiqueta impressa automaticamente:', resultado);
            } catch (err) {
                console.error('[PCP] Falha ao imprimir etiqueta:', err.message);
                impressaoAutomatica = { sucesso: false, erro: err.message };
            }
        }

        res.json({
            success: true,
            data: normalizarOrdem(updated),
            order: normalizarOrdem(updated),
            impressao: impressaoAutomatica
        });

    } catch (error) {
        console.error('[PCP] PATCH /orders/:id/stage:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/*
 * PATCH /api/pcp/orders/:id
 */
router.post('/orders/:id/photo', uploadProductionPhoto.single('photo'), (req, res) => {
    try {
        const orderId = String(req.params.id || '').trim();

        const ordem = db.prepare(`
            SELECT id, image_url
            FROM ordens_producao
            WHERE id = ?
            LIMIT 1
        `).get(orderId);

        if (!ordem) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(404).json({
                error: 'Ordem de produÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'Nenhuma foto foi enviada.'
            });
        }

        const imageUrl = `/storage/production-orders/${encodeURIComponent(orderId)}/${encodeURIComponent(req.file.filename)}`;

        db.prepare(`
            UPDATE ordens_producao
            SET image_url = ?, updated_at = ?
            WHERE id = ?
        `).run(imageUrl, new Date().toISOString(), orderId);

        res.json({
            success: true,
            image_url: imageUrl,
            order_id: orderId
        });
    } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {}
        }

        console.error('Erro ao salvar foto da ordem:', error);

        res.status(500).json({
            error: error.message || 'Erro ao salvar foto da ordem.'
        });
    }
});
router.patch('/orders/:id', (req, res) => {
    try {
        const orderId = req.params.id;
        const body = req.body || {};

        const order = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o nÃƒÂ¯Ã‚Â¿Ã‚Â½o encontrada'
            });
        }

        const fields = [];
        const values = [];

        const mapa = {
            product_name: 'product_name',
            sku: 'sku',
            client: 'client',
            quantity: 'quantidade',
            quantidade: 'quantidade',
            priority: 'prioridade',
            prioridade: 'prioridade',
            expected_delivery: 'data_prevista',
            data_prevista: 'data_prevista',
            observations: 'observacao',
            observacao: 'observacao',
            product_id: 'produto_id',
            produto_id: 'produto_id',
            quantidade_produzida: 'quantidade_produzida',
            origem: 'origem',
            origin: 'origem',
            image_url: 'image_url',
            imageUrl: 'image_url',
            operador_id: 'operador_id',
            operadorId: 'operador_id',
            operador_nome: 'operador_nome',
            operadorNome: 'operador_nome'
        };

        for (const [entrada, coluna] of Object.entries(mapa)) {
            if (
                Object.prototype.hasOwnProperty.call(body, entrada) &&
                !fields.some(f => f.column === coluna)
            ) {
                fields.push({
                    column: coluna,
                    value: body[entrada]
                });
            }
        }

        for (const item of fields) {
            values.push(item.value);
        }

        if (fields.length > 0) {
            const setSql = fields
                .map(item => `${item.column} = ?`)
                .join(', ');

            values.push(agora());
            values.push(orderId);

            db.prepare(`
                UPDATE ordens_producao
                SET ${setSql}, updated_at = ?
                WHERE id = ?
            `).run(...values);
        }

        const updated = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        res.json({
            success: true,
            data: normalizarOrdem(updated),
            order: normalizarOrdem(updated)
        });
    } catch (error) {
        console.error('[PCP] PATCH /orders/:id:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * POST /api/pcp/orders
 */
router.post('/orders', (req, res) => {
    try {
        const body = req.body || {};

        const numeroInformado =
            body.order_number ||
            body.numero ||
            body.orderNumber;

        let numero = numeroInformado
            ? String(numeroInformado)
            : null;

        if (!numero) {
            const ultimo = db.prepare(`
                SELECT numero
                FROM ordens_producao
                WHERE numero GLOB '[0-9]*'
                ORDER BY CAST(numero AS INTEGER) DESC
                LIMIT 1
            `).get();

            numero = String(
                (Number(ultimo?.numero) || 999) + 1
            );
        }

        const id = body.id || crypto.randomUUID();
        const dataAtual = agora();

        const productName =
            body.product_name ||
            body.productName ||
            '';

        const sku =
            body.sku ||
            '';

        const client =
            body.client ||
            '';

        const quantity = Number(
            body.quantity ??
            body.quantidade ??
            0
        );

        const priority =
            body.priority ||
            body.prioridade ||
            'Media';

        const currentStage =
            body.current_stage ||
            body.currentStage ||
            body.setor_inicial ||
            'Recebido';

        const expectedDelivery =
            body.expected_delivery ||
            body.expectedDelivery ||
            body.data_prevista ||
            null;

        const observations =
            body.observations ??
            body.observacao ??
            body.observacoes ??
            '';

        const productId =
            body.product_id ||
            body.productId ||
            body.produto_id ||
            null;

        const origem =
            body.origem ||
            body.origin ||
            body.source ||
            'shopee';

        const imageUrl =
            body.image_url ||
            body.imageUrl ||
            '';

        const responsavelCadastroId =
            body.responsavel_cadastro_id ??
            body.responsavelCadastroId ??
            null;

        const responsavelCadastroNome =
            body.responsavel_cadastro_nome ||
            body.responsavelCadastroNome ||
            '';

        const stages = obterEtapas();

        if (!stages.includes(currentStage)) {
            return res.status(400).json({
                success: false,
                error: `Etapa invÃƒÂ¯Ã‚Â¿Ã‚Â½lida: ${currentStage}`,
                stages
            });
        }

        db.prepare(`
            INSERT INTO ordens_producao (
                id,
                numero,
                produto_id,
                quantidade,
                quantidade_produzida,
                status,
                prioridade,
                data_inicio,
                data_prevista,
                data_conclusao,
                observacao,
                usuario_id,
                created_at,
                updated_at,
                current_stage,
                product_name,
                sku,
                client,
                origem,
                image_url,
                operador_id,
                operador_nome,
                responsavel_cadastro_id,
                responsavel_cadastro_nome
            )
            VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            numero,
            productId,
            quantity,
            currentStage === stages[stages.length - 1]
                ? 'Finalizado'
                : (currentStage === stages[0]
                    ? 'Aguardando ProduÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o'
                    : 'Em ProduÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o'),
            priority,
            expectedDelivery,
            observations,
            dataAtual,
            dataAtual,
            currentStage,
            productName,
            sku,
            client,
            origem,
            imageUrl,
            null,
            '',
            responsavelCadastroId,
            responsavelCadastroNome
        );

        db.prepare(`
            INSERT INTO production_movements (
                order_id,
                stage,
                description,
                user_id,
                user_name,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            currentStage,
            `Ordem criada em: ${currentStage}`,
            null,
            'UsuÃƒÂ¯Ã‚Â¿Ã‚Â½rio',
            dataAtual
        );

        db.prepare(`
            INSERT INTO production_stage_history (
                order_id,
                stage,
                operador_id,
                operador_nome,
                entrada,
                saida,
                duracao_segundos,
                setor_anterior,
                setor_destino,
                observacao,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
        `).run(
            id,
            currentStage,
            null,
            '',
            dataAtual,
            observations,
            dataAtual,
            dataAtual
        );

        const created = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        res.status(201).json({
            success: true,
            data: normalizarOrdem(created),
            order: normalizarOrdem(created)
        });
    } catch (error) {
        console.error('[PCP] POST /orders:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * DELETE /api/pcp/orders/:id
 */
router.delete('/orders/:id', (req, res) => {
    try {
        const orderId = req.params.id;

        const order = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o nÃƒÂ¯Ã‚Â¿Ã‚Â½o encontrada'
            });
        }

        const transaction = db.transaction(() => {
            db.prepare(`
                DELETE FROM production_movements
                WHERE order_id = ?
            `).run(orderId);

            db.prepare(`
                DELETE FROM production_apontamentos
                WHERE order_id = ?
            `).run(orderId);

            db.prepare(`
                DELETE FROM ordem_producao_itens
                WHERE ordem_producao_id = ?
            `).run(orderId);

            db.prepare(`
                DELETE FROM ordens_producao
                WHERE id = ?
            `).run(orderId);
        });

        transaction();

        res.json({
            success: true,
            message: 'Ordem de produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o excluÃƒÂ¯Ã‚Â¿Ã‚Â½da com sucesso'
        });
    } catch (error) {
        console.error('[PCP] DELETE /orders/:id:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/orders/:id/movements
 */
router.get('/orders/:id/movements', (req, res) => {
    try {
        const movements = db.prepare(`
            SELECT *
            FROM production_movements
            WHERE order_id = ?
            ORDER BY id ASC
        `).all(req.params.id);

        res.json({
            success: true,
            data: movements,
            movements
        });
    } catch (error) {
        console.error('[PCP] GET movements:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/orders/:id/apontamentos
 */
router.get('/orders/:id/apontamentos', (req, res) => {
    try {
        const apontamentos = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE order_id = ?
            ORDER BY id ASC
        `).all(req.params.id);

        res.json({
            success: true,
            data: apontamentos,
            apontamentos
        });
    } catch (error) {
        console.error('[PCP] GET apontamentos:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * GET /api/pcp/operadores
 */
router.get('/operadores', (req, res) => {
    try {
        const operadores = db.prepare(`
            SELECT
                id,
                nome,
                email,
                ativo
            FROM usuarios
            WHERE ativo = 1
              AND perfil = 'Operador'
            ORDER BY nome ASC
        `).all();

        const data = operadores.map(item => ({
            id: item.id,
            name: item.nome,
            nome: item.nome,
            email: item.email || '',
            ativo: item.ativo
        }));

        res.json({
            success: true,
            data,
            operadores: data
        });
    } catch (error) {
        console.error('[PCP] GET /operadores:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * POST /api/pcp/apontamentos
 */
router.post('/apontamentos', (req, res) => {
    try {
        const body = req.body || {};

        const orderId =
            body.order_id ||
            body.orderId;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'order_id nÃƒÂ¯Ã‚Â¿Ã‚Â½o informado'
            });
        }

        const order = db.prepare(`
            SELECT id
            FROM ordens_producao
            WHERE id = ?
        `).get(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½o nÃƒÂ¯Ã‚Â¿Ã‚Â½o encontrada'
            });
        }

        const operadorId =
            body.operador_id ??
            body.operator_id ??
            body.operadorId ??
            null;

        let operadorNome =
            body.operador_nome ||
            body.operator_name ||
            body.operadorNome ||
            '';

        if (!operadorNome && operadorId) {
            const operador = db.prepare(`
                SELECT nome
                FROM usuarios
                WHERE id = ?
                LIMIT 1
            `).get(operadorId);

            operadorNome = operador?.nome || '';
        }

        const etapa =
            body.etapa ||
            body.stage ||
            body.current_stage ||
            'Recebido';

        const tipo =
            body.tipo ||
            body.type ||
            'inicio';

        const inicio =
            body.inicio ||
            body.start_time ||
            body.startTime ||
            null;

        const fim =
            body.fim ||
            body.end_time ||
            body.endTime ||
            null;

        const quantidade = Number(
            body.quantidade ??
            body.quantity ??
            0
        );

        const observacao =
            body.observacao ??
            body.observations ??
            body.observation ??
            '';

        const dataAtual = agora();

        const result = db.prepare(`
            INSERT INTO production_apontamentos (
                order_id,
                operador_id,
                operador_nome,
                etapa,
                tipo,
                inicio,
                fim,
                quantidade,
                observacao,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            orderId,
            operadorId,
            operadorNome,
            etapa,
            tipo,
            inicio,
            fim,
            quantidade,
            observacao,
            dataAtual,
            dataAtual
        );

        const apontamento = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            data: apontamento,
            apontamento
        });
    } catch (error) {
        console.error('[PCP] POST /apontamentos:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * PATCH /api/pcp/apontamentos/:id
 */
/*
 * POST /api/pcp/bipar
 */
router.post('/bipar', async (req, res) => {
    try {
        const body = req.body || {};

        const codigo = String(
            body.code ||
            body.codigo ||
            body.codigo_bipado ||
            ''
        ).trim();

        const operadorId =
            body.operador_id ??
            body.operadorId ??
            null;

        if (!codigo) {
            return res.status(400).json({
                success: false,
                error: 'Informe o SKU ou cÃƒÂ³digo da peÃƒÂ§a.'
            });
        }

        if (operadorId === null || operadorId === undefined || operadorId === '') {
            return res.status(400).json({
                success: false,
                error: 'Selecione o funcionÃƒÂ¡rio antes de bipar.'
            });
        }

        const operador = db.prepare(`
            SELECT id, nome
            FROM usuarios
            WHERE id = ?
              AND ativo = 1
            LIMIT 1
        `).get(operadorId);

        if (!operador) {
            return res.status(400).json({
                success: false,
                error: 'FuncionÃƒÂ¡rio nÃƒÂ£o encontrado ou inativo.'
            });
        }

        const operadorNome = String(operador.nome || '').trim();

        const ordem = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE numero = ?
               OR sku = ?
               OR product_name = ?
            ORDER BY created_at DESC
            LIMIT 1
        `).get(codigo, codigo, codigo);

        if (!ordem) {
            return res.status(404).json({
                success: false,
                encontrado: false,
                codigo,
                error: `PeÃƒÂ§a/SKU "${codigo}" nÃƒÂ£o encontrado.`
            });
        }

        const stages = obterEtapas();

        if (!Array.isArray(stages) || stages.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Ãƒâ€° necessÃƒÂ¡rio ter pelo menos Recebido e um setor de produÃƒÂ§ÃƒÂ£o.'
            });
        }

        const etapaAtual = ordem.current_stage || stages[0];
        let indiceAtual = stages.indexOf(etapaAtual);

        if (indiceAtual < 0) {
            indiceAtual = 0;
        }

        const dataAtual = agora();

        let etapaRegistrada = etapaAtual;
        let proximaEtapa = etapaAtual;
        let finalizada = false;
        let apontamentoId = null;

        const executarBipagem = db.transaction(() => {
            /*
             * RECEBIDO:
             * ÃƒÂ© apenas a entrada administrativa.
             * O primeiro funcionÃƒÂ¡rio da produÃƒÂ§ÃƒÂ£o serÃƒÂ¡ registrado
             * diretamente no primeiro setor produtivo.
             */
            if (indiceAtual === 0) {
                etapaRegistrada = stages[1];
                proximaEtapa = stages[1];

                db.prepare(`
                    INSERT INTO production_stage_history (
                        order_id,
                        stage,
                        operador_id,
                        operador_nome,
                        entrada,
                        saida,
                        duracao_segundos,
                        setor_anterior,
                        setor_destino,
                        observacao,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?)
                `).run(
                    ordem.id,
                    etapaRegistrada,
                    operador.id,
                    operadorNome,
                    dataAtual,
                    etapaAtual,
                    `BIPAGEM: entrada no setor ${etapaRegistrada}`,
                    dataAtual,
                    dataAtual
                );

                const apontamento = db.prepare(`
                    INSERT INTO production_apontamentos (
                        order_id,
                        operador_id,
                        operador_nome,
                        etapa,
                        tipo,
                        inicio,
                        fim,
                        quantidade,
                        observacao,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    ordem.id,
                    operador.id,
                    operadorNome,
                    etapaRegistrada,
                    'BIPAGEM_ENTRADA',
                    dataAtual,
                    dataAtual,
                    1,
                    `SKU/CÃƒÂ³digo bipado: ${codigo}`,
                    dataAtual,
                    dataAtual
                );

                apontamentoId = apontamento.lastInsertRowid;

                db.prepare(`
                    INSERT INTO production_movements (
                        order_id,
                        stage,
                        description,
                        user_id,
                        user_name,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    ordem.id,
                    etapaRegistrada,
                    `BIPAGEM: entrada automÃƒÂ¡tica em ${etapaRegistrada} - Operador: ${operadorNome}`,
                    operador.id,
                    operadorNome,
                    dataAtual
                );
            } else {
                /*
                 * O funcionÃƒÂ¡rio que estÃƒÂ¡ bipando ÃƒÂ© o responsÃƒÂ¡vel
                 * pelo SETOR ATUAL.
                 *
                 * Exemplo:
                 * peÃƒÂ§a em CORTE + Braian bipou
                 * => CORTE = Braian
                 * => peÃƒÂ§a vai para DOBRA
                 *
                 * O funcionÃƒÂ¡rio de Dobra serÃƒÂ¡ registrado somente
                 * quando ele prÃƒÂ³prio bipar a peÃƒÂ§a.
                 */
                etapaRegistrada = etapaAtual;

                const historicoAberto = db.prepare(`
                    SELECT *
                    FROM production_stage_history
                    WHERE order_id = ?
                      AND stage = ?
                      AND saida IS NULL
                    ORDER BY id DESC
                    LIMIT 1
                `).get(ordem.id, etapaAtual);

                let duracaoSegundos = null;

                if (historicoAberto?.entrada) {
                    const inicioMs = new Date(historicoAberto.entrada).getTime();
                    const fimMs = new Date(dataAtual).getTime();

                    if (Number.isFinite(inicioMs) && Number.isFinite(fimMs)) {
                        duracaoSegundos = Math.max(
                            0,
                            Math.floor((fimMs - inicioMs) / 1000)
                        );
                    }
                }

                if (historicoAberto) {
                    db.prepare(`
                        UPDATE production_stage_history
                        SET
                            operador_id = ?,
                            operador_nome = ?,
                            saida = ?,
                            duracao_segundos = ?,
                            setor_destino = ?,
                            observacao = ?,
                            updated_at = ?
                        WHERE id = ?
                    `).run(
                        operador.id,
                        operadorNome,
                        dataAtual,
                        duracaoSegundos,
                        indiceAtual < stages.length - 1
                            ? stages[indiceAtual + 1]
                            : 'Entregue',
                        `BIPAGEM de saÃƒÂ­da: ${codigo}`,
                        dataAtual,
                        historicoAberto.id
                    );
                } else {
                    db.prepare(`
                        INSERT INTO production_stage_history (
                            order_id,
                            stage,
                            operador_id,
                            operador_nome,
                            entrada,
                            saida,
                            duracao_segundos,
                            setor_anterior,
                            setor_destino,
                            observacao,
                            created_at,
                            updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        ordem.id,
                        etapaAtual,
                        operador.id,
                        operadorNome,
                        dataAtual,
                        dataAtual,
                        0,
                        ordem.setor_anterior || null,
                        indiceAtual < stages.length - 1
                            ? stages[indiceAtual + 1]
                            : 'Entregue',
                        `BIPAGEM de saÃƒÂ­da: ${codigo}`,
                        dataAtual,
                        dataAtual
                    );
                }

                const apontamento = db.prepare(`
                    INSERT INTO production_apontamentos (
                        order_id,
                        operador_id,
                        operador_nome,
                        etapa,
                        tipo,
                        inicio,
                        fim,
                        quantidade,
                        observacao,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    ordem.id,
                    operador.id,
                    operadorNome,
                    etapaAtual,
                    'BIPAGEM',
                    historicoAberto?.entrada || dataAtual,
                    dataAtual,
                    1,
                    `SKU/CÃƒÂ³digo bipado: ${codigo}`,
                    dataAtual,
                    dataAtual
                );

                apontamentoId = apontamento.lastInsertRowid;

                db.prepare(`
                    INSERT INTO production_movements (
                        order_id,
                        stage,
                        description,
                        user_id,
                        user_name,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    ordem.id,
                    etapaAtual,
                    `BIPAGEM: saÃƒÂ­da de ${etapaAtual} - Operador: ${operadorNome}`,
                    operador.id,
                    operadorNome,
                    dataAtual
                );

                if (indiceAtual < stages.length - 1) {
                    proximaEtapa = stages[indiceAtual + 1];

                    db.prepare(`
                        INSERT INTO production_stage_history (
                            order_id,
                            stage,
                            operador_id,
                            operador_nome,
                            entrada,
                            saida,
                            duracao_segundos,
                            setor_anterior,
                            setor_destino,
                            observacao,
                            created_at,
                            updated_at
                        )
                        VALUES (?, ?, NULL, '', ?, NULL, NULL, ?, NULL, ?, ?, ?)
                    `).run(
                        ordem.id,
                        proximaEtapa,
                        dataAtual,
                        etapaAtual,
                        `Aguardando funcionÃƒÂ¡rio de ${proximaEtapa}`,
                        dataAtual,
                        dataAtual
                    );
                } else {
                    proximaEtapa = stages[stages.length - 1];
                    finalizada = true;
                }
            }

            db.prepare(`
                UPDATE ordens_producao
                SET
                    current_stage = ?,
                    status = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(
                proximaEtapa,
                proximaEtapa === stages[stages.length - 1]
                    ? 'Finalizado'
                    : 'Em Producao',
                dataAtual,
                ordem.id
            );
        });

        executarBipagem();

        const atualizada = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(ordem.id);

        const resultado = normalizarOrdem(atualizada);

        return res.json({
            success: true,
            encontrado: true,
            tipo: 'peca',
            codigo,
            etapa_anterior: etapaAtual,
            etapa_registrada: etapaRegistrada,
            proxima_etapa: proximaEtapa,
            finalizada,
            operador: {
                id: operador.id,
                nome: operadorNome
            },
            responsavel_cadastro: {
                id: resultado.responsavel_cadastro_id || null,
                nome: resultado.responsavel_cadastro_nome || ''
            },
            data: resultado,
            order: resultado,
            ordem: resultado,
            apontamento_id: apontamentoId
        });

    } catch (error) {
        console.error('Erro na bipagem automÃƒÂ¡tica:', error);

        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno ao processar bipagem.'
        });
    }
});

router.patch('/apontamentos/:id', (req, res) => {
    try {
        const id = req.params.id;
        const body = req.body || {};

        const atual = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(id);

        if (!atual) {
            return res.status(404).json({
                success: false,
                error: 'Apontamento nÃƒÂ¯Ã‚Â¿Ã‚Â½o encontrado'
            });
        }

        const campos = [];
        const valores = [];

        const mapa = {
            operador_id: 'operador_id',
            operador_nome: 'operador_nome',
            etapa: 'etapa',
            tipo: 'tipo',
            inicio: 'inicio',
            fim: 'fim',
            quantidade: 'quantidade',
            observacao: 'observacao'
        };

        for (const [entrada, coluna] of Object.entries(mapa)) {
            if (Object.prototype.hasOwnProperty.call(body, entrada)) {
                campos.push(`${coluna} = ?`);
                valores.push(body[entrada]);
            }
        }

        if (
            Object.prototype.hasOwnProperty.call(body, 'start_time') &&
            !Object.prototype.hasOwnProperty.call(body, 'inicio')
        ) {
            campos.push('inicio = ?');
            valores.push(body.start_time);
        }

        if (
            Object.prototype.hasOwnProperty.call(body, 'end_time') &&
            !Object.prototype.hasOwnProperty.call(body, 'fim')
        ) {
            campos.push('fim = ?');
            valores.push(body.end_time);
        }

        if (campos.length > 0) {
            valores.push(agora());
            valores.push(id);

            db.prepare(`
                UPDATE production_apontamentos
                SET ${campos.join(', ')}, updated_at = ?
                WHERE id = ?
            `).run(...valores);
        }

        const atualizado = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            data: atualizado,
            apontamento: atualizado
        });
    } catch (error) {
        console.error('[PCP] PATCH /apontamentos/:id:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * PATCH /api/pcp/stages/config
 */
router.patch('/stages/config', (req, res) => {
    try {
        const stages =
            req.body?.stages ||
            req.body?.etapas;

        if (!Array.isArray(stages) || stages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de etapas invÃƒÂ¯Ã‚Â¿Ã‚Â½lida'
            });
        }

        const valor = JSON.stringify(stages);
        const dataAtual = agora();

        const existe = db.prepare(`
            SELECT id
            FROM configuracoes
            WHERE chave = 'production_stages'
            LIMIT 1
        `).get();

        if (existe) {
            db.prepare(`
                UPDATE configuracoes
                SET valor = ?, updated_at = ?
                WHERE chave = 'production_stages'
            `).run(valor, dataAtual);
        } else {
            db.prepare(`
                INSERT INTO configuracoes (
                    chave,
                    valor,
                    tipo,
                    descricao,
                    updated_at
                )
                VALUES (?, ?, 'json', 'Etapas do PCP', ?)
            `).run(
                'production_stages',
                valor,
                dataAtual
            );
        }

        res.json({
            success: true,
            data: stages,
            stages
        });
    } catch (error) {
        console.error('[PCP] PATCH /stages/config:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ============================================================
// SISTEMA DE AUDITORIA E RANKING - METAL RACING
// Adicionado em 2026-09-16 via PowerShell
// ============================================================

function registrarAuditoria({ usuarioId, modulo, acao, entidade, entidadeId, dadosAnteriores, dadosNovos }) {
    try {
        db.prepare(`
            INSERT INTO auditoria (
                usuario_id, modulo, acao, entidade, entidade_id,
                dados_anteriores, dados_novos, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            usuarioId || null,
            modulo || 'PCP',
            acao || 'MOVIMENTACAO',
            entidade || 'ordem_producao',
            entidadeId || null,
            dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
            dadosNovos ? JSON.stringify(dadosNovos) : null,
            new Date().toISOString()
        );
    } catch (err) {
        console.error('[AUDITORIA] Erro ao registrar:', err.message);
    }
}

router.post('/mover-ordem', (req, res) => {
    try {
        const { OrdemId, EtapaAnterior, NovaEtapa, UsuarioId, ResponsavelId, QuantidadePecas = 1 } = req.body;

        if (!OrdemId || !NovaEtapa) {
            return res.status(400).json({ sucesso: false, erro: 'OrdemId e NovaEtapa são obrigatórios' });
        }

        const agora = new Date().toISOString();
        const operadorNome = ResponsavelId || UsuarioId || 'Desconhecido';

        const ordemAntes = db.prepare(`SELECT id, current_stage, operador_id, operador_nome, status FROM ordens_producao WHERE id = ?`).get(OrdemId);
        if (!ordemAntes) {
            return res.status(404).json({ sucesso: false, erro: `Ordem ${OrdemId} não encontrada` });
        }

        const etapaReal = EtapaAnterior || ordemAntes.current_stage;

        db.prepare(`UPDATE ordens_producao SET current_stage = ?, operador_nome = ?, updated_at = ? WHERE id = ?`).run(NovaEtapa, operadorNome, agora, OrdemId);

        db.prepare(`
            UPDATE production_stage_history
            SET saida = ?, duracao_segundos = CAST((julianday(?) - julianday(entrada)) * 86400 AS INTEGER), updated_at = ?
            WHERE order_id = ? AND stage = ? AND saida IS NULL
        `).run(agora, agora, agora, OrdemId, etapaReal);

        db.prepare(`
            INSERT INTO production_stage_history (order_id, stage, operador_id, operador_nome, entrada, setor_anterior, setor_destino, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(OrdemId, NovaEtapa, null, operadorNome, agora, etapaReal, NovaEtapa, agora, agora);

        registrarAuditoria({
            usuarioId: ordemAntes.operador_id,
            modulo: 'PCP',
            acao: 'MOVIMENTACAO_ETAPA',
            entidade: 'ordem_producao',
            entidadeId: OrdemId,
            dadosAnteriores: { current_stage: ordemAntes.current_stage, operador_nome: ordemAntes.operador_nome, status: ordemAntes.status },
            dadosNovos: { current_stage: NovaEtapa, operador_nome: operadorNome, de: etapaReal, para: NovaEtapa, usuario_que_moveu: UsuarioId, quantidade_pecas: QuantidadePecas }
        });

        try {
            db.prepare(`
                INSERT INTO production_apontamentos (order_id, operador_id, operador_nome, etapa, tipo, inicio, fim, quantidade, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(OrdemId, ordemAntes.operador_id || null, operadorNome, NovaEtapa, 'movimentacao', agora, agora, QuantidadePecas, agora, agora);
        } catch (e) {
            console.warn('[APONTAMENTO] Erro (não crítico):', e.message);
        }

        res.json({ sucesso: true, mensagem: 'Card movido, auditoria e ranking atualizados', ordem: OrdemId, de: etapaReal, para: NovaEtapa, operador: operadorNome, pecas_contadas: QuantidadePecas });
    } catch (error) {
        console.error('[MOVER-ORDEM] Erro:', error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

router.get('/ranking', (req, res) => {
    try {
        const periodo = req.query.periodo || 'dia';
        let filtroData = '';
        if (periodo === 'dia') filtroData = `AND date(fim) = date('now', 'localtime')`;
        else if (periodo === 'semana') filtroData = `AND date(fim) >= date('now', '-7 days', 'localtime')`;
        else if (periodo === 'mes') filtroData = `AND strftime('%Y-%m', fim) = strftime('%Y-%m', 'now', 'localtime')`;

        const linhas = db.prepare(`
            SELECT operador_nome AS nome, SUM(quantidade) AS pecas, COUNT(DISTINCT order_id) AS ordens, COUNT(*) AS movimentacoes
            FROM production_apontamentos
            WHERE operador_nome IS NOT NULL AND operador_nome != '' ${filtroData}
            GROUP BY operador_nome ORDER BY pecas DESC LIMIT 50
        `).all();

        const ranking = linhas.map((l, i) => ({ posicao: i + 1, nome: l.nome, pecas: l.pecas || 0, ordens: l.ordens || 0, movimentacoes: l.movimentacoes || 0 }));
        res.json({ sucesso: true, periodo, total: ranking.length, ranking });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

router.get('/auditoria', (req, res) => {
    try {
        const ordem = req.query.ordem;
        const limite = Math.min(parseInt(req.query.limite) || 100, 500);
        let query = `SELECT id, order_id AS ordem, stage AS etapa, operador_nome AS operador, entrada, saida, duracao_segundos, setor_anterior, setor_destino FROM production_stage_history`;
        const params = [];
        if (ordem) { query += ` WHERE order_id = ? `; params.push(ordem); }
        query += ` ORDER BY id DESC LIMIT ? `; params.push(limite);
        const registros = db.prepare(query).all(...params);
        res.json({ sucesso: true, total: registros.length, registros });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// ============================================================
// FIM - SISTEMA DE AUDITORIA E RANKING
// ============================================================
// ============================================================
// ALIASES GENERICOS PARA O FRONTEND (Ranking + Auditoria)
// Adicionado em 2026-09-16
// ============================================================

// Alias: /api/pcp/ranking -> formata exatamente o que o RankingPage.jsx espera
router.get('/ranking-frontend', (req, res) => {
    try {
        const periodo = req.query.periodo || 'todos';
        let filtroData = '';
        if (periodo === 'hoje') {
            filtroData = `AND date(fim) = date('now', 'localtime')`;
        } else if (periodo === 'semana') {
            filtroData = `AND date(fim) >= date('now', '-7 days', 'localtime')`;
        } else if (periodo === 'mes') {
            filtroData = `AND strftime('%Y-%m', fim) = strftime('%Y-%m', 'now', 'localtime')`;
        }

        const linhas = db.prepare(`
            SELECT 
                operador_nome AS nome,
                SUM(quantidade) AS total,
                COUNT(DISTINCT order_id) AS ordens
            FROM production_apontamentos
            WHERE operador_nome IS NOT NULL AND operador_nome != '' ${filtroData}
            GROUP BY operador_nome
            ORDER BY total DESC
        `).all();

        const ranking = linhas.map((l, i) => ({
            posicao: i + 1,
            nome: l.nome || 'Sem nome',
            total: l.total || 0,
            ordens: l.ordens || 0
        }));

        const totalGeral = ranking.reduce((acc, r) => acc + r.total, 0);

        res.json({
            sucesso: true,
            periodo,
            stats: {
                total_usuarios: ranking.length,
                total_bipagens: totalGeral
            },
            ranking
        });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// Alias: /api/pcp/auditoria-frontend -> formata exatamente o que AuditPage.jsx espera
router.get('/auditoria-frontend', (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite) || 100, 500);

        const registros = db.prepare(`
            SELECT 
                id,
                usuario_id,
                modulo,
                acao,
                entidade,
                entidade_id,
                dados_anteriores,
                dados_novos,
                created_at
            FROM auditoria
            ORDER BY id DESC
            LIMIT ?
        `).all(limite);

        // Formata no padrão que o AuditPage.jsx espera: { action, created_at, details }
        const logs = registros.map(r => {
            let detalhes = '';
            try {
                const novos = r.dados_novos ? JSON.parse(r.dados_novos) : {};
                const antigos = r.dados_anteriores ? JSON.parse(r.dados_anteriores) : {};
                
                if (r.modulo === 'PCP' && r.acao === 'MOVIMENTACAO_ETAPA') {
                    detalhes = `Ordem ${novos.de || '?'} → ${novos.para || '?'} | Operador: ${novos.operador_nome || '?'} | Qtd: ${novos.quantidade_pecas || 1}`;
                } else if (r.modulo === 'NF-E') {
                    detalhes = `NF-e #${novos.nfe_numero || '-'} | Produto: ${r.entidade_id || '-'} | Qtd: ${novos.quantidade || '-'}`;
                } else {
                    detalhes = `Entidade: ${r.entidade || '-'} | ID: ${r.entidade_id || '-'}`;
                }
            } catch (e) {
                detalhes = `Entidade: ${r.entidade || '-'} | ID: ${r.entidade_id || '-'}`;
            }

            return {
                id: `auditoria-${r.id}`,
                action: `${r.modulo} - ${r.acao}`,
                created_at: r.created_at,
                details: detalhes
            };
        });

        res.json({ sucesso: true, total: logs.length, registros: logs });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// ============================================================
// FIM - ALIASES GENERICOS PARA O FRONTEND
// ============================================================
// ============================================================
// CRUD DE SETORES - METAL RACING
// ============================================================

// GET /api/pcp/stages/full -> lista com id, nome, ordem, cor
router.get('/stages/full', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT id, nome, ordem, cor, icone, ativo
            FROM production_stages
            ORDER BY ordem ASC, id ASC
        `).all();

        res.json({ success: true, stages: rows, data: rows });
    } catch (error) {
        console.error('[PCP] GET /stages/full:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/pcp/stages -> criar novo setor
router.post('/stages', (req, res) => {
    try {
        const { nome, cor, ordem, icone } = req.body || {};

        if (!nome || !String(nome).trim()) {
            return res.status(400).json({ success: false, error: 'Nome obrigatório' });
        }

        const nomeLimpo = String(nome).trim();
        const corFinal = cor || '#3b82f6';
        const iconeFinal = icone || '';

        // Verifica duplicado
        const existe = db.prepare("SELECT id FROM production_stages WHERE nome = ?").get(nomeLimpo);
        if (existe) {
            return res.status(400).json({ success: false, error: 'Já existe um setor com este nome' });
        }

        // Calcula ordem se não informada OU se já existir
        let ordemFinal = Number(ordem);
        if (!ordemFinal || ordemFinal <= 0) {
            const max = db.prepare("SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM production_stages WHERE ativo = 1").get();
            ordemFinal = max.prox;
        } else {
            // Se a ordem informada já existe, empurra para o final
            const jaExiste = db.prepare("SELECT id FROM production_stages WHERE ordem = ? AND ativo = 1").get(ordemFinal);
            if (jaExiste) {
                const max = db.prepare("SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM production_stages WHERE ativo = 1").get();
                ordemFinal = max.prox;
            }
        }

        const agora = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO production_stages (nome, ordem, cor, icone, ativo, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        `).run(nomeLimpo, ordemFinal, corFinal, iconeFinal, agora, agora);

        const novo = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(result.lastInsertRowid);

        res.json({ success: true, stage: novo, data: novo });
    } catch (error) {
        console.error('[PCP] POST /stages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/pcp/stages/:id -> editar setor
router.put('/stages/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome, cor, ordem, icone, ativo } = req.body || {};

        const atual = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(id);
        if (!atual) {
            return res.status(404).json({ success: false, error: 'Setor não encontrado' });
        }

        const nomeFinal = nome ? String(nome).trim() : atual.nome;
        const corFinal = cor || atual.cor;
        const ordemFinal = ordem !== undefined ? Number(ordem) : atual.ordem;
        const iconeFinal = icone !== undefined ? icone : atual.icone;
        const ativoFinal = ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo;
        const agora = new Date().toISOString();

        db.prepare(`
            UPDATE production_stages
            SET nome = ?, cor = ?, ordem = ?, icone = ?, ativo = ?, updated_at = ?
            WHERE id = ?
        `).run(nomeFinal, corFinal, ordemFinal, iconeFinal, ativoFinal, agora, id);

        const atualizado = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(id);
        res.json({ success: true, stage: atualizado, data: atualizado });
    } catch (error) {
        console.error('[PCP] PUT /stages/:id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/pcp/stages/:id -> remover (ou inativar)
router.delete('/stages/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const atual = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(id);
        if (!atual) {
            return res.status(404).json({ success: false, error: 'Setor não encontrado' });
        }

        // Soft delete (inativa)
        db.prepare("UPDATE production_stages SET ativo = 0, updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), id);

        res.json({ success: true, message: 'Setor desativado' });
    } catch (error) {
        console.error('[PCP] DELETE /stages/:id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// FIM CRUD DE SETORES
// ============================================================

// PATCH /api/pcp/stages/:id/mover -> move setor para cima/baixo
router.patch('/stages/:id/mover', (req, res) => {
    try {
        const id = Number(req.params.id);
        const direcao = String(req.body?.direcao || '').toLowerCase(); // 'up' ou 'down'

        if (!['up', 'down'].includes(direcao)) {
            return res.status(400).json({ success: false, error: 'Direcao invalida. Use "up" ou "down".' });
        }

        const atual = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(id);
        if (!atual) {
            return res.status(404).json({ success: false, error: 'Setor nao encontrado' });
        }

        // Pega o vizinho (proximo maior ou menor em ordem)
        let vizinho;
        if (direcao === 'up') {
            vizinho = db.prepare(`
                SELECT * FROM production_stages
                WHERE ativo = 1 AND ordem < ?
                ORDER BY ordem DESC LIMIT 1
            `).get(atual.ordem);
        } else {
            vizinho = db.prepare(`
                SELECT * FROM production_stages
                WHERE ativo = 1 AND ordem > ?
                ORDER BY ordem ASC LIMIT 1
            `).get(atual.ordem);
        }

        if (!vizinho) {
            return res.json({ success: true, message: 'Setor ja esta na extremidade.', stage: atual });
        }

        // Troca as ordens
        const agora = new Date().toISOString();
        db.prepare("UPDATE production_stages SET ordem = ?, updated_at = ? WHERE id = ?")
          .run(vizinho.ordem, agora, atual.id);
        db.prepare("UPDATE production_stages SET ordem = ?, updated_at = ? WHERE id = ?")
          .run(atual.ordem, agora, vizinho.id);

        const atualizado = db.prepare("SELECT * FROM production_stages WHERE id = ?").get(id);
        res.json({ success: true, stage: atualizado, data: atualizado });
    } catch (error) {
        console.error('[PCP] PATCH /stages/:id/mover:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});





export default router;










































