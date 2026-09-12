?import express from 'express';
import db from '../database/db.js';

const router = express.Router();

function normalizarEtiqueta(row) {
    return {
        ...row,

        product_code:
            row.product_code ||
            row.codigo ||
            row.produto_codigo ||
            '',

        product_name:
            row.product_name ||
            row.descricao ||
            row.produto_nome ||
            '',

        sku:
            row.sku ||
            row.produto_sku ||
            '',

        barcode:
            row.barcode ||
            row.codigo ||
            row.produto_codigo ||
            row.sku ||
            '',

        batch: row.batch || '',
        image_url: row.image_url || '',

        automatic: false
    };
}

// GET /api/etiquetas
router.get('/', (req, res) => {
    try {
        const etiquetas = db.prepare(`
            SELECT
                e.*,
                p.nome AS produto_nome,
                p.sku AS produto_sku,
                p.codigo AS produto_codigo
            FROM etiquetas e
            LEFT JOIN produtos p
                ON p.id = e.produto_id
            ORDER BY e.id DESC
        `).all();

        res.json({
            success: true,
            data: etiquetas.map(normalizarEtiqueta),
            etiquetas: etiquetas.map(normalizarEtiqueta)
        });

    } catch (error) {
        console.error('[ETIQUETAS] Erro ao listar:', error);

        res.status(500).json({
            success: false,
            error: 'Erro ao listar etiquetas',
            message: error.message
        });
    }
});

// GET /api/etiquetas/:id
router.get('/:id', (req, res) => {
    try {
        const etiqueta = db.prepare(`
            SELECT
                e.*,
                p.nome AS produto_nome,
                p.sku AS produto_sku,
                p.codigo AS produto_codigo
            FROM etiquetas e
            LEFT JOIN produtos p
                ON p.id = e.produto_id
            WHERE e.id = ?
        `).get(req.params.id);

        if (!etiqueta) {
            return res.status(404).json({
                success: false,
                error: 'Etiqueta n�o encontrada'
            });
        }

        const resultado = normalizarEtiqueta(etiqueta);

        res.json({
            success: true,
            data: resultado,
            etiqueta: resultado
        });

    } catch (error) {
        console.error('[ETIQUETAS] Erro ao buscar:', error);

        res.status(500).json({
            success: false,
            error: 'Erro ao buscar etiqueta',
            message: error.message
        });
    }
});

// POST /api/etiquetas
router.post('/', (req, res) => {
    try {
        const {
            produto_id = null,
            pedido_id = null,
            product_code = '',
            product_name = '',
            sku = '',
            batch = '',
            barcode = '',
            image_url = '',
            codigo = '',
            descricao = '',
            quantidade = 1,
            modelo = null,
            impressora = null,
            status = 'ativo'
        } = req.body || {};

        const codigoFinal =
            String(product_code || codigo || barcode || '').trim();

        const descricaoFinal =
            String(product_name || descricao || '').trim();

        const barcodeFinal =
            String(barcode || codigoFinal || '').trim();

        if (!codigoFinal && !produto_id) {
            return res.status(400).json({
                success: false,
                error: 'Informe o c�digo ou produto_id'
            });
        }

        const quantidadeFinal = Math.max(
            1,
            Number.parseInt(quantidade, 10) || 1
        );

        let produtoIdFinal = produto_id || null;

        if (!produtoIdFinal && codigoFinal) {
            const produto = db.prepare(`
                SELECT id
                FROM produtos
                WHERE codigo = ?
                   OR sku = ?
                   OR codigo_barras = ?
                   OR ean = ?
                   OR gtin = ?
                LIMIT 1
            `).get(
                codigoFinal,
                sku || codigoFinal,
                barcodeFinal,
                barcodeFinal,
                barcodeFinal
            );

            if (produto) {
                produtoIdFinal = produto.id;
            }
        }

        const result = db.prepare(`
            INSERT INTO etiquetas (
                produto_id,
                pedido_id,
                codigo,
                descricao,
                quantidade,
                modelo,
                impressora,
                status,
                product_code,
                product_name,
                sku,
                batch,
                barcode,
                image_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            produtoIdFinal,
            pedido_id || null,
            codigoFinal || null,
            descricaoFinal,
            quantidadeFinal,
            modelo,
            impressora,
            status || 'ativo',
            codigoFinal,
            descricaoFinal,
            String(sku || ''),
            String(batch || ''),
            barcodeFinal,
            String(image_url || '')
        );

        const etiqueta = db.prepare(`
            SELECT
                e.*,
                p.nome AS produto_nome,
                p.sku AS produto_sku,
                p.codigo AS produto_codigo
            FROM etiquetas e
            LEFT JOIN produtos p
                ON p.id = e.produto_id
            WHERE e.id = ?
        `).get(result.lastInsertRowid);

        const resultado = normalizarEtiqueta(etiqueta);

        res.status(201).json({
            success: true,
            data: resultado,
            etiqueta: resultado
        });

    } catch (error) {
        console.error('[ETIQUETAS] Erro ao criar:', error);

        res.status(500).json({
            success: false,
            error: 'Erro ao criar etiqueta',
            message: error.message
        });
    }
});

// PUT /api/etiquetas/:id
router.put('/:id', (req, res) => {
    try {
        const existente = db.prepare(`
            SELECT *
            FROM etiquetas
            WHERE id = ?
        `).get(req.params.id);

        if (!existente) {
            return res.status(404).json({
                success: false,
                error: 'Etiqueta n�o encontrada'
            });
        }

        const {
            produto_id = existente.produto_id,
            pedido_id = existente.pedido_id,
            product_code = existente.product_code || existente.codigo || '',
            product_name = existente.product_name || existente.descricao || '',
            sku = existente.sku || '',
            batch = existente.batch || '',
            barcode = existente.barcode || existente.codigo || '',
            image_url = existente.image_url || '',
            quantidade = existente.quantidade || 1,
            modelo = existente.modelo,
            impressora = existente.impressora,
            status = existente.status || 'ativo'
        } = req.body || {};

        const codigoFinal =
            String(product_code || barcode || existente.codigo || '').trim();

        const descricaoFinal =
            String(product_name || existente.descricao || '').trim();

        const barcodeFinal =
            String(barcode || codigoFinal).trim();

        const quantidadeFinal = Math.max(
            1,
            Number.parseInt(quantidade, 10) || 1
        );

        db.prepare(`
            UPDATE etiquetas
            SET
                produto_id = ?,
                pedido_id = ?,
                codigo = ?,
                descricao = ?,
                quantidade = ?,
                modelo = ?,
                impressora = ?,
                status = ?,
                product_code = ?,
                product_name = ?,
                sku = ?,
                batch = ?,
                barcode = ?,
                image_url = ?
            WHERE id = ?
        `).run(
            produto_id || null,
            pedido_id || null,
            codigoFinal || null,
            descricaoFinal,
            quantidadeFinal,
            modelo || null,
            impressora || null,
            status || 'ativo',
            codigoFinal,
            descricaoFinal,
            String(sku || ''),
            String(batch || ''),
            barcodeFinal,
            String(image_url || ''),
            req.params.id
        );

        const etiqueta = db.prepare(`
            SELECT
                e.*,
                p.nome AS produto_nome,
                p.sku AS produto_sku,
                p.codigo AS produto_codigo
            FROM etiquetas e
            LEFT JOIN produtos p
                ON p.id = e.produto_id
            WHERE e.id = ?
        `).get(req.params.id);

        const resultado = normalizarEtiqueta(etiqueta);

        res.json({
            success: true,
            data: resultado,
            etiqueta: resultado
        });

    } catch (error) {
        console.error('[ETIQUETAS] Erro ao atualizar:', error);

        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar etiqueta',
            message: error.message
        });
    }
});

// DELETE /api/etiquetas/:id
router.delete('/:id', (req, res) => {
    try {
        const existente = db.prepare(`
            SELECT *
            FROM etiquetas
            WHERE id = ?
        `).get(req.params.id);

        if (!existente) {
            return res.status(404).json({
                success: false,
                error: 'Etiqueta n�o encontrada'
            });
        }

        db.prepare(`
            DELETE FROM etiquetas
            WHERE id = ?
        `).run(req.params.id);

        res.json({
            success: true,
            message: 'Etiqueta removida'
        });

    } catch (error) {
        console.error('[ETIQUETAS] Erro ao excluir:', error);

        res.status(500).json({
            success: false,
            error: 'Erro ao excluir etiqueta',
            message: error.message
        });
    }
});

export default router;
