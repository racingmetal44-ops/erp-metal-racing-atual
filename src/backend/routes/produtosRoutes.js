import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCT_FILES_DIR = process.env.VERCEL
    ? path.join('/tmp', 'storage', 'product-files')
    : path.join(__dirname, '../../../storage/product-files');

fs.mkdirSync(PRODUCT_FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const productId = String(req.params.id);
        const productDir = path.join(PRODUCT_FILES_DIR, productId);

        fs.mkdirSync(productDir, { recursive: true });
        cb(null, productDir);
    },

    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname || '').toLowerCase();

        const base = path
            .basename(file.originalname || 'imagem', extensao)
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const nomeFinal =
            Date.now() +
            '-' +
            crypto.randomBytes(4).toString('hex') +
            '-' +
            (base || 'imagem') +
            extensao;

        cb(null, nomeFinal);
    }
});

const uploadProductFile = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const permitidos = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif'
        ];

        if (!permitidos.includes(file.mimetype)) {
            return cb(
                new Error(
                    'Formato de imagem não permitido. Use JPG, PNG, WEBP ou GIF.'
                )
            );
        }

        cb(null, true);
    }
});

const router = express.Router();

function garantirTabelas() {
    const colunas = [
        ['sku', 'TEXT'],
        ['codigo', 'TEXT'],
        ['codigo_barras', 'TEXT'],
        ['ean', 'TEXT'],
        ['gtin', 'TEXT'],
        ['descricao', 'TEXT'],
        ['categoria', 'TEXT'],
        ['marca', 'TEXT'],
        ['modelo', 'TEXT'],
        ['unidade', 'TEXT'],
        ['ncm', 'TEXT'],
        ['cest', 'TEXT'],
        ['cfop', 'TEXT'],
        ['cst', 'TEXT'],
        ['csosn', 'TEXT'],
        ['origem', 'TEXT'],
        ['preco', 'REAL'],
        ['preco_venda', 'REAL'],
        ['custo', 'REAL'],
        ['current_stock', 'REAL'],
        ['estoque_atual', 'REAL'],
        ['min_stock', 'REAL'],
        ['max_stock', 'REAL'],
        ['estoque_reservado', 'REAL'],
        ['estoque_disponivel', 'REAL'],
        ['peso', 'REAL'],
        ['altura', 'REAL'],
        ['largura', 'REAL'],
        ['comprimento', 'REAL'],
        ['ativo', 'INTEGER'],
        ['created_at', 'TEXT'],
        ['updated_at', 'TEXT']
    ];

    const existentes = db.prepare(`PRAGMA table_info(produtos)`).all();
    const nomes = new Set(existentes.map(c => c.name));

    for (const [nome, tipo] of colunas) {
        if (!nomes.has(nome)) {
            db.exec(`ALTER TABLE produtos ADD COLUMN ${nome} ${tipo}`);
        }
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS product_files (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT,
            product_barcode TEXT,
            file_url TEXT,
            file_name TEXT,
            file_type TEXT,
            file_size INTEGER,
            file_category TEXT,
            photo_angle TEXT,
            sort_order INTEGER DEFAULT 0,
            is_ai_training INTEGER DEFAULT 0,
            added_by_name TEXT,
            is_primary INTEGER DEFAULT 0,
            created_date TEXT,
            updated_date TEXT
        )
    `);
}

garantirTabelas();
// ============================================================
// ARQUIVOS / IMAGENS DOS PRODUTOS - SQLITE + STORAGE LOCAL
// ============================================================

// POST /api/produtos/:id/arquivos
router.post('/:id/arquivos', uploadProductFile.single('file'), (req, res) => {
    try {
        const produto = db.prepare(`
            SELECT id, nome, sku, codigo_barras, ean, gtin
            FROM produtos
            WHERE id = ?
        `).get(req.params.id);

        if (!produto) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma imagem foi enviada'
            });
        }

        const agora = new Date().toISOString();

        const projetoRoot = path.resolve(__dirname, '../../..');

        const arquivoRelativo = path
            .relative(projetoRoot, req.file.path)
            .replace(/\\/g, '/');

        const fileUrl = `/${arquivoRelativo}`;

        const id = crypto.randomUUID();

        const ultimo = db.prepare(`
            SELECT COALESCE(MAX(sort_order), 0) AS maior
            FROM product_files
            WHERE product_id = ?
        `).get(req.params.id);

        const sortOrder = Number(ultimo?.maior || 0) + 1;

        db.prepare(`
            INSERT INTO product_files (
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
            VALUES (
                @id,
                @product_id,
                @product_name,
                @product_barcode,
                @file_url,
                @file_name,
                @file_type,
                @file_size,
                @file_category,
                @photo_angle,
                @sort_order,
                @is_ai_training,
                @added_by_name,
                @is_primary,
                @created_date,
                @updated_date
            )
        `).run({
            id,
            product_id: produto.id,
            product_name: produto.nome || '',
            product_barcode:
                produto.codigo_barras ||
                produto.ean ||
                produto.gtin ||
                '',
            file_url: fileUrl,
            file_name: req.file.originalname,
            file_type: req.file.mimetype,
            file_size: req.file.size,
            file_category: 'foto',
            photo_angle: 'front',
            sort_order: sortOrder,
            is_ai_training: 0,
            added_by_name: 'sistema',
            is_primary: sortOrder === 1 ? 1 : 0,
            created_date: agora,
            updated_date: agora
        });

        const arquivoSalvo = db.prepare(`
            SELECT *
            FROM product_files
            WHERE id = ?
        `).get(id);

        res.status(201).json({
            success: true,
            data: arquivoSalvo
        });

    } catch (error) {
        console.error('[PRODUTOS] POST /:id/arquivos:', error);

        if (req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {}
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/produtos/:id/arquivos/:arquivoId
router.delete('/:id/arquivos/:arquivoId', (req, res) => {
    try {
        const arquivo = db.prepare(`
            SELECT *
            FROM product_files
            WHERE id = ?
              AND product_id = ?
        `).get(req.params.arquivoId, req.params.id);

        if (!arquivo) {
            return res.status(404).json({
                success: false,
                error: 'Arquivo não encontrado'
            });
        }

        if (arquivo.file_url) {
            const projetoRoot = path.resolve(__dirname, '../../..');

            const caminho = path.resolve(
                projetoRoot,
                arquivo.file_url.replace(/^\/+/, '')
            );

            if (
                caminho.startsWith(projetoRoot) &&
                fs.existsSync(caminho)
            ) {
                fs.unlinkSync(caminho);
            }
        }

        db.prepare(`
            DELETE FROM product_files
            WHERE id = ?
              AND product_id = ?
        `).run(req.params.arquivoId, req.params.id);

        res.json({
            success: true,
            message: 'Arquivo excluído com sucesso'
        });

    } catch (error) {
        console.error('[PRODUTOS] DELETE /:id/arquivos/:arquivoId:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

function normalizarProduto(row) {
    if (!row) return null;

    return {
        ...row,
        name: row.nome ?? '',
        current_stock: Number(row.current_stock ?? row.estoque_atual ?? 0),
        estoque_atual: Number(row.estoque_atual ?? row.current_stock ?? 0),
        min_stock: Number(row.min_stock ?? 0),
        max_stock: Number(row.max_stock ?? 0),
        ativo: row.ativo === 1 || row.ativo === true
    };
}

// GET /api/produtos
router.get('/', (req, res) => {
    try {
        const produtos = db.prepare(`
            SELECT *
            FROM produtos
            ORDER BY nome COLLATE NOCASE ASC
        `).all();

        const arquivos = db.prepare(`
            SELECT *
            FROM product_files
            ORDER BY sort_order ASC, created_date ASC
        `).all();

        const arquivosPorProduto = new Map();

        for (const arquivo of arquivos) {
            if (!arquivosPorProduto.has(arquivo.product_id)) {
                arquivosPorProduto.set(arquivo.product_id, []);
            }

            arquivosPorProduto.get(arquivo.product_id).push(arquivo);
        }

        const resultado = produtos.map(produto => ({
            ...normalizarProduto(produto),
            files: arquivosPorProduto.get(produto.id) || []
        }));

        res.json({
            success: true,
            data: resultado,
            count: resultado.length
        });
    } catch (error) {
        console.error('[PRODUTOS] GET /:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/produtos/:id
router.get('/:id', (req, res) => {
    try {
        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(req.params.id);

        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }

        const arquivos = db.prepare(`
            SELECT *
            FROM product_files
            WHERE product_id = ?
            ORDER BY sort_order ASC, created_date ASC
        `).all(req.params.id);

        res.json({
            success: true,
            data: {
                ...normalizarProduto(produto),
                files: arquivos
            }
        });
    } catch (error) {
        console.error('[PRODUTOS] GET /:id:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/produtos
router.post('/', (req, res) => {
    try {
        const dados = req.body || {};

        const nome = String(dados.name ?? dados.nome ?? '').trim();

        if (!nome) {
            return res.status(400).json({
                success: false,
                error: 'Nome do produto é obrigatório'
            });
        }

        const id = dados.id || crypto.randomUUID();
        const agora = new Date().toISOString();

        const produto = {
            id,
            sku: dados.sku ?? null,
            codigo: dados.codigo ?? dados.sku ?? null,
            codigo_barras: dados.codigo_barras ?? dados.barcode ?? null,
            ean: dados.ean ?? dados.barcode ?? null,
            gtin: dados.gtin ?? dados.barcode ?? null,
            nome,
            descricao: dados.descricao ?? null,
            categoria: dados.categoria ?? null,
            marca: dados.marca ?? null,
            modelo: dados.modelo ?? null,
            unidade: dados.unidade ?? 'UN',
            ncm: dados.ncm ?? null,
            cest: dados.cest ?? null,
            cfop: dados.cfop ?? null,
            cst: dados.cst ?? null,
            csosn: dados.csosn ?? null,
            origem: dados.origem ?? null,
            preco: Number(dados.preco ?? 0),
            preco_venda: Number(dados.preco_venda ?? dados.preco ?? 0),
            custo: Number(dados.custo ?? 0),
            current_stock: Number(dados.current_stock ?? dados.estoque_atual ?? 0),
            estoque_atual: Number(dados.estoque_atual ?? dados.current_stock ?? 0),
            min_stock: Number(dados.min_stock ?? 0),
            max_stock: Number(dados.max_stock ?? 0),
            estoque_reservado: Number(dados.estoque_reservado ?? 0),
            estoque_disponivel: Number(dados.estoque_disponivel ?? 0),
            peso: Number(dados.peso ?? 0),
            altura: Number(dados.altura ?? 0),
            largura: Number(dados.largura ?? 0),
            comprimento: Number(dados.comprimento ?? 0),
            ativo: dados.ativo === false ? 0 : 1,
            created_at: agora,
            updated_at: agora
        };

        db.prepare(`
            INSERT INTO produtos (
                id, sku, codigo, codigo_barras, ean, gtin,
                nome, descricao, categoria, marca, modelo, unidade,
                ncm, cest, cfop, cst, csosn, origem,
                preco, preco_venda, custo,
                current_stock, estoque_atual,
                min_stock, max_stock,
                estoque_reservado, estoque_disponivel,
                peso, altura, largura, comprimento,
                ativo, created_at, updated_at
            )
            VALUES (
                @id, @sku, @codigo, @codigo_barras, @ean, @gtin,
                @nome, @descricao, @categoria, @marca, @modelo, @unidade,
                @ncm, @cest, @cfop, @cst, @csosn, @origem,
                @preco, @preco_venda, @custo,
                @current_stock, @estoque_atual,
                @min_stock, @max_stock,
                @estoque_reservado, @estoque_disponivel,
                @peso, @altura, @largura, @comprimento,
                @ativo, @created_at, @updated_at
            )
        `).run(produto);

        const criado = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(id);

        res.status(201).json({
            success: true,
            data: normalizarProduto(criado)
        });
    } catch (error) {
        console.error('[PRODUTOS] POST /:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PUT /api/produtos/:id
router.put('/:id', (req, res) => {
    try {
        const dados = req.body || {};
        const existente = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(req.params.id);

        if (!existente) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }

        const agora = new Date().toISOString();

        const produto = {
            ...existente,
            ...dados,
            id: req.params.id,
            nome: dados.nome ?? dados.name ?? existente.nome,
            codigo_barras: dados.codigo_barras ?? dados.barcode ?? existente.codigo_barras,
            current_stock: Number(
                dados.current_stock ??
                dados.estoque_atual ??
                existente.current_stock ??
                existente.estoque_atual ??
                0
            ),
            estoque_atual: Number(
                dados.estoque_atual ??
                dados.current_stock ??
                existente.estoque_atual ??
                existente.current_stock ??
                0
            ),
            min_stock: Number(dados.min_stock ?? existente.min_stock ?? 0),
            max_stock: Number(dados.max_stock ?? existente.max_stock ?? 0),
            updated_at: agora
        };

        delete produto.name;
        delete produto.files;

        const campos = [
            'sku', 'codigo', 'codigo_barras', 'ean', 'gtin',
            'nome', 'descricao', 'categoria', 'marca', 'modelo',
            'unidade', 'ncm', 'cest', 'cfop', 'cst', 'csosn',
            'origem', 'preco', 'preco_venda', 'custo',
            'current_stock', 'estoque_atual', 'min_stock', 'max_stock',
            'estoque_reservado', 'estoque_disponivel',
            'peso', 'altura', 'largura', 'comprimento',
            'ativo', 'updated_at'
        ];

        const setSql = campos.map(c => `${c} = @${c}`).join(', ');

        db.prepare(`
            UPDATE produtos
            SET ${setSql}
            WHERE id = @id
        `).run(produto);

        const atualizado = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(req.params.id);

        res.json({
            success: true,
            data: normalizarProduto(atualizado)
        });
    } catch (error) {
        console.error('[PRODUTOS] PUT /:id:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/produtos/:id
router.delete('/:id', (req, res) => {
    try {
        const existe = db.prepare(`
            SELECT id
            FROM produtos
            WHERE id = ?
        `).get(req.params.id);

        if (!existe) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }

        const excluir = db.transaction(() => {
            db.prepare(`
                DELETE FROM product_files
                WHERE product_id = ?
            `).run(req.params.id);

            db.prepare(`
                DELETE FROM produtos
                WHERE id = ?
            `).run(req.params.id);
        });

        excluir();

        res.json({
            success: true,
            message: 'Produto excluído com sucesso'
        });
    } catch (error) {
        console.error('[PRODUTOS] DELETE /:id:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Busca rápida para bipagem
router.get('/buscar/:codigo', (req, res) => {
    try {
        const codigo = String(req.params.codigo || '').trim();

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE sku = ?
               OR codigo = ?
               OR codigo_barras = ?
               OR ean = ?
               OR gtin = ?
            LIMIT 1
        `).get(codigo, codigo, codigo, codigo, codigo);

        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }

        res.json({
            success: true,
            data: normalizarProduto(produto)
        });
    } catch (error) {
        console.error('[PRODUTOS] buscar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

