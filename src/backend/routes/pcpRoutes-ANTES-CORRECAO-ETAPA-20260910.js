import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';

const router = express.Router();

/*
 * ============================================
 * PCP - BANCO SQLITE
 * ============================================
 */

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
    `);
}

garantirTabelas();

/*
 * ============================================
 * HELPERS
 * ============================================
 */

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
            // usa fallback
        }
    }

    return [
        'Recebido',
        'Corte a Laser',
        'Dobra',
        'Solda',
        'Lixamento',
        'Químico',
        'Pintura',
        'Montagem',
        'Inspeção de Qualidade',
        'Embalagem',
        'Expedição',
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

    return {
        id: row.id,
        order_number: row.numero,
        numero: row.numero,

        product_id: row.produto_id || null,
        product_name:
            produto?.nome ||
            produto?.name ||
            '',

        sku:
            produto?.sku ||
            produto?.codigo ||
            '',

        client: '',
        quantity: Number(row.quantidade || 0),
        quantidade: Number(row.quantidade || 0),

        quantidade_produzida:
            Number(row.quantidade_produzida || 0),

        priority: row.prioridade || 'Media',
        prioridade: row.prioridade || 'Media',

        current_stage:
            row.status === 'Finalizado'
                ? 'Entregue'
                : (row.etapa || 'Recebido'),

        status: row.status || 'Aguardando Produção',

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
        apontamentos
    };
}

/*
 * ============================================
 * GET /api/pcp/orders
 * ============================================
 */

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
 * ============================================
 * GET /api/pcp/orders/:id
 * ============================================
 */

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
                error: 'Ordem de produção não encontrada'
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
 * ============================================
 * GET /api/pcp/stats
 * ============================================
 */

router.get('/stats', (req, res) => {
    try {
        const total = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
        `).get();

        const aguardando = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status = 'Aguardando Produção'
        `).get();

        const producao = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status = 'Em Produção'
        `).get();

        const finalizadas = db.prepare(`
            SELECT COUNT(*) AS total
            FROM ordens_producao
            WHERE status = 'Finalizado'
        `).get();

        const quantidade = db.prepare(`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM ordens_producao
        `).get();

        const produzida = db.prepare(`
            SELECT COALESCE(SUM(quantidade_produzida), 0) AS total
            FROM ordens_producao
        `).get();

        const stats = {
            total_orders: Number(total.total || 0),
            pending_orders: Number(aguardando.total || 0),
            in_production: Number(producao.total || 0),
            completed_orders: Number(finalizadas.total || 0),
            total_quantity: Number(quantidade.total || 0),
            produced_quantity: Number(produzida.total || 0)
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
 * ============================================
 * GET /api/pcp/stages
 * ============================================
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
 * ============================================
 * PUT /api/pcp/stages
 * ============================================
 */

router.put('/stages', (req, res) => {
    try {
        const stages = req.body?.stages;

        if (!Array.isArray(stages) || stages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de etapas inválida'
            });
        }

        const valor = JSON.stringify(stages);

        const existente = db.prepare(`
            SELECT id
            FROM configuracoes
            WHERE chave = 'production_stages'
            LIMIT 1
        `).get();

        if (existente) {
            db.prepare(`
                UPDATE configuracoes
                SET valor = ?, updated_at = ?
                WHERE id = ?
            `).run(valor, agora(), existente.id);
        } else {
            db.prepare(`
                INSERT INTO configuracoes
                (chave, valor, tipo, updated_at)
                VALUES (?, ?, 'string', ?)
            `).run('production_stages', valor, agora());
        }

        res.json({
            success: true,
            data: stages,
            stages
        });
    } catch (error) {
        console.error('[PCP] PUT /stages:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * ============================================
 * POST /api/pcp/orders
 * ============================================
 */

router.post('/orders', (req, res) => {
    try {
        const dados = req.body || {};

        const quantidade = Number(
            dados.quantity ??
            dados.quantidade ??
            0
        );

        if (quantidade <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Quantidade deve ser maior que zero'
            });
        }

        const produtoId =
            dados.product_id ??
            dados.produto_id ??
            null;

        const ultima = db.prepare(`
            SELECT numero
            FROM ordens_producao
            WHERE numero GLOB '[0-9]*'
            ORDER BY CAST(numero AS INTEGER) DESC
            LIMIT 1
        `).get();

        const proximoNumero =
            ultima?.numero
                ? Number(ultima.numero) + 1
                : 1001;

        const id =
            dados.id ||
            crypto.randomUUID();

        const numero =
            dados.order_number ||
            dados.numero ||
            String(proximoNumero);

        const etapa =
            dados.current_stage ||
            dados.setor_inicial ||
            'Recebido';

        const status =
            dados.status ||
            'Aguardando Produção';

        const prioridade =
            dados.priority ||
            dados.prioridade ||
            'Media';

        const observacao =
            dados.observations ??
            dados.observacao ??
            '';

        const agoraAtual = agora();

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
                updated_at
            )
            VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, NULL, ?, ?, ?, ?)
        `).run(
            id,
            String(numero),
            produtoId,
            quantidade,
            status,
            prioridade,
            dados.expected_delivery ??
                dados.data_prevista ??
                null,
            observacao,
            dados.usuario_id ?? null,
            agoraAtual,
            agoraAtual
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
            etapa,
            `Ordem criada em: ${etapa}`,
            dados.usuario_id ?? null,
            dados.user_name ?? 'Usuário',
            agoraAtual
        );

        const row = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        res.status(201).json({
            success: true,
            data: normalizarOrdem(row)
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
 * ============================================
 * PATCH /api/pcp/orders/:id
 * ============================================
 */

router.patch('/orders/:id', (req, res) => {
    try {
        const id = req.params.id;
        const dados = req.body || {};

        const atual = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        if (!atual) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produção não encontrada'
            });
        }

        const quantidade =
            dados.quantity ??
            dados.quantidade ??
            atual.quantidade;

        const prioridade =
            dados.priority ??
            dados.prioridade ??
            atual.prioridade;

        const status =
            dados.status ??
            atual.status;

        const observacao =
            dados.observations ??
            dados.observacao ??
            atual.observacao;

        const dataPrevista =
            dados.expected_delivery ??
            dados.data_prevista ??
            atual.data_prevista;

        db.prepare(`
            UPDATE ordens_producao
            SET
                quantidade = ?,
                prioridade = ?,
                status = ?,
                data_prevista = ?,
                observacao = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            Number(quantidade),
            prioridade,
            status,
            dataPrevista,
            observacao,
            agora(),
            id
        );

        const row = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            data: normalizarOrdem(row)
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
 * ============================================
 * PATCH /api/pcp/orders/:id/stage
 * ============================================
 */

router.patch('/orders/:id/stage', (req, res) => {
    try {
        const id = req.params.id;

        const stage =
            req.body?.stage ??
            req.body?.current_stage;

        if (!stage) {
            return res.status(400).json({
                success: false,
                error: 'Etapa é obrigatória'
            });
        }

        const ordem = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        if (!ordem) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produção não encontrada'
            });
        }

        const etapas = obterEtapas();
        const ultimaEtapa =
            etapas[etapas.length - 1];

        const status =
            stage === ultimaEtapa ||
            stage === 'Entregue'
                ? 'Finalizado'
                : 'Em Produção';

        const dataConclusao =
            status === 'Finalizado'
                ? agora()
                : null;

        const dataInicio =
            ordem.data_inicio ||
            agora();

        const agoraAtual = agora();

        db.prepare(`
            UPDATE ordens_producao
            SET
                status = ?,
                data_inicio = ?,
                data_conclusao = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            status,
            dataInicio,
            dataConclusao,
            agoraAtual,
            id
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
            stage,
            `Movido para: ${stage}`,
            req.body?.user_id ?? null,
            req.body?.user_name ?? 'Usuário',
            agoraAtual
        );

        const row = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            data: normalizarOrdem(row)
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
 * ============================================
 * GET /api/pcp/orders/:id/movements
 * ============================================
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
 * ============================================
 * GET /api/pcp/orders/:id/apontamentos
 * ============================================
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
 * ============================================
 * POST /api/pcp/orders/:id/apontamentos
 * ============================================
 */

router.post('/orders/:id/apontamentos', (req, res) => {
    try {
        const id = req.params.id;
        const dados = req.body || {};

        const ordem = db.prepare(`
            SELECT id
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        if (!ordem) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produção não encontrada'
            });
        }

        const agoraAtual = agora();

        const resultado = db.prepare(`
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
            id,
            dados.operador_id ?? null,
            dados.operador_nome ?? '',
            dados.etapa ?? dados.stage ?? '',
            dados.tipo ?? 'inicio',
            dados.inicio ?? agoraAtual,
            dados.fim ?? null,
            Number(dados.quantidade ?? 0),
            dados.observacao ?? '',
            agoraAtual,
            agoraAtual
        );

        const apontamento = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(resultado.lastInsertRowid);

        res.status(201).json({
            success: true,
            data: apontamento
        });
    } catch (error) {
        console.error('[PCP] POST apontamento:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * ============================================
 * PATCH /api/pcp/apontamentos/:id
 * ============================================
 */

router.patch('/apontamentos/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const dados = req.body || {};

        const atual = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(id);

        if (!atual) {
            return res.status(404).json({
                success: false,
                error: 'Apontamento não encontrado'
            });
        }

        db.prepare(`
            UPDATE production_apontamentos
            SET
                operador_id = ?,
                operador_nome = ?,
                etapa = ?,
                tipo = ?,
                inicio = ?,
                fim = ?,
                quantidade = ?,
                observacao = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            dados.operador_id ??
                atual.operador_id,

            dados.operador_nome ??
                atual.operador_nome,

            dados.etapa ??
                dados.stage ??
                atual.etapa,

            dados.tipo ??
                atual.tipo,

            dados.inicio ??
                atual.inicio,

            dados.fim ??
                atual.fim,

            Number(
                dados.quantidade ??
                atual.quantidade ??
                0
            ),

            dados.observacao ??
                atual.observacao ??
                '',

            agora(),

            id
        );

        const apontamento = db.prepare(`
            SELECT *
            FROM production_apontamentos
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            data: apontamento
        });
    } catch (error) {
        console.error('[PCP] PATCH apontamento:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/*
 * ============================================
 * DELETE /api/pcp/orders/:id
 * ============================================
 */

router.delete('/orders/:id', (req, res) => {
    try {
        const id = req.params.id;

        const ordem = db.prepare(`
            SELECT *
            FROM ordens_producao
            WHERE id = ?
        `).get(id);

        if (!ordem) {
            return res.status(404).json({
                success: false,
                error: 'Ordem de produção não encontrada'
            });
        }

        const transacao = db.transaction(() => {
            db.prepare(`
                DELETE FROM production_movements
                WHERE order_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM production_apontamentos
                WHERE order_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM ordem_producao_itens
                WHERE ordem_producao_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM ordens_producao
                WHERE id = ?
            `).run(id);
        });

        transacao();

        res.json({
            success: true,
            data: {
                id,
                deleted: true
            }
        });
    } catch (error) {
        console.error('[PCP] DELETE /orders/:id:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
