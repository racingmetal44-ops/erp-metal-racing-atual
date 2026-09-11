import express from 'express';
import db from '../database/db.js';

const router = express.Router();

function garantirColuna(nome, definicao) {
    const colunas = db.prepare('PRAGMA table_info(devolucoes)').all();
    const existe = colunas.some((coluna) => coluna.name === nome);

    if (!existe) {
        db.exec(`ALTER TABLE devolucoes ADD COLUMN ${nome} ${definicao}`);
    }
}

garantirColuna('return_date', 'TEXT');
garantirColuna('order_number', 'TEXT');
garantirColuna('customer_name', 'TEXT');
garantirColuna('product_name', 'TEXT');
garantirColuna('affected', 'TEXT');
garantirColuna('product_value', 'REAL');
garantirColuna('cost', 'REAL');
garantirColuna('notes', 'TEXT');
garantirColuna('original_nfe_number', 'TEXT');

function normalizar(item) {
    return {
        id: item.id,
        return_date:
            item.return_date ||
            (item.created_at ? String(item.created_at).slice(0, 10) : ''),
        order_number: item.order_number || item.pedido_id || '',
        customer_name: item.customer_name || '',
        product_name: item.product_name || '',
        reason: item.motivo || '',
        affected: item.affected || '',
        product_value:
            item.product_value !== null &&
            item.product_value !== undefined
                ? Number(item.product_value)
                : Number(item.valor || 0),
        cost: Number(item.cost || 0),
        status: String(item.status || 'pendente').toLowerCase(),
        notes: item.notes || item.observacao || '',
        original_nfe_number:
            item.original_nfe_number ||
            item.nfe_original ||
            '',
        created_at: item.created_at,
        updated_at: item.updated_at,
    };
}

router.get('/', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT *
            FROM devolucoes
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            data: rows.map(normalizar)
        });
    } catch (error) {
        console.error('[DEVOLUCOES] GET:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/', (req, res) => {
    try {
        const {
            return_date,
            order_number,
            customer_name,
            product_name,
            reason,
            affected,
            product_value,
            cost,
            status,
            notes,
            original_nfe_number
        } = req.body || {};

        if (!return_date || !order_number || !customer_name || !product_name || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Preencha data, pedido, cliente, produto e motivo.'
            });
        }

        const agora = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO devolucoes (
                pedido_id,
                motivo,
                status,
                quantidade,
                valor,
                observacao,
                created_at,
                updated_at,
                numero_devolucao,
                nfe_original,
                return_date,
                order_number,
                customer_name,
                product_name,
                affected,
                product_value,
                cost,
                notes,
                original_nfe_number
            )
            VALUES (
                @pedido_id,
                @motivo,
                @status,
                1,
                @valor,
                @observacao,
                @created_at,
                @updated_at,
                @numero_devolucao,
                @nfe_original,
                @return_date,
                @order_number,
                @customer_name,
                @product_name,
                @affected,
                @product_value,
                @cost,
                @notes,
                @original_nfe_number
            )
        `).run({
            pedido_id: null,
            motivo: reason,
            status: String(status || 'pendente').toLowerCase(),
            valor: Number(product_value || 0),
            observacao: notes || '',
            created_at: agora,
            updated_at: agora,
            numero_devolucao: order_number,
            nfe_original: original_nfe_number || 'SEM_NFE',
            return_date,
            order_number,
            customer_name,
            product_name,
            affected: affected || '',
            product_value: Number(product_value || 0),
            cost: Number(cost || 0),
            notes: notes || '',
            original_nfe_number: original_nfe_number || 'SEM_NFE'
        });

        const row = db.prepare(`
            SELECT *
            FROM devolucoes
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            data: normalizar(row)
        });
    } catch (error) {
        console.error('[DEVOLUCOES] POST:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.put('/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const {
            return_date,
            order_number,
            customer_name,
            product_name,
            reason,
            affected,
            product_value,
            cost,
            status,
            notes,
            original_nfe_number
        } = req.body || {};

        const existente = db.prepare(`
            SELECT id
            FROM devolucoes
            WHERE id = ?
        `).get(id);

        if (!existente) {
            return res.status(404).json({
                success: false,
                error: 'Devolução não encontrada.'
            });
        }

        db.prepare(`
            UPDATE devolucoes
            SET
                pedido_id = @pedido_id,
                motivo = @motivo,
                status = @status,
                valor = @valor,
                observacao = @observacao,
                updated_at = @updated_at,
                numero_devolucao = @numero_devolucao,
                nfe_original = @nfe_original,
                return_date = @return_date,
                order_number = @order_number,
                customer_name = @customer_name,
                product_name = @product_name,
                affected = @affected,
                product_value = @product_value,
                cost = @cost,
                notes = @notes,
                original_nfe_number = @original_nfe_number
            WHERE id = @id
        `).run({
            id,
            pedido_id: order_number || '',
            motivo: reason || '',
            status: String(status || 'pendente').toLowerCase(),
            valor: Number(product_value || 0),
            observacao: notes || '',
            updated_at: new Date().toISOString(),
            numero_devolucao: order_number || '',
            nfe_original: original_nfe_number || 'SEM_NFE',
            return_date: return_date || '',
            order_number: order_number || '',
            customer_name: customer_name || '',
            product_name: product_name || '',
            affected: affected || '',
            product_value: Number(product_value || 0),
            cost: Number(cost || 0),
            notes: notes || '',
            original_nfe_number: original_nfe_number || 'SEM_NFE'
        });

        const row = db.prepare(`
            SELECT *
            FROM devolucoes
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            data: normalizar(row)
        });
    } catch (error) {
        console.error('[DEVOLUCOES] PUT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const id = Number(req.params.id);

        const result = db.prepare(`
            DELETE FROM devolucoes
            WHERE id = ?
        `).run(id);

        if (!result.changes) {
            return res.status(404).json({
                success: false,
                error: 'Devolução não encontrada.'
            });
        }

        res.json({
            success: true
        });
    } catch (error) {
        console.error('[DEVOLUCOES] DELETE:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

