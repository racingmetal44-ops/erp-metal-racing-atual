?import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';

const router = express.Router();

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
        'Qu�mico',
        'Pintura',
        'Montagem',
        'Inspe��o de Qualidade',
        'Embalagem',
        'Expedi��o',
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
            row.status || 'Aguardando Produ��o',

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
 * GET /api/pcp/orders
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
 * GET /api/pcp/orders/:id
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
                error: 'Ordem de produ��o n�o encontrada'
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
            WHERE status = 'Em Produ��o'
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
router.patch('/orders/:id/stage', (req, res) => {
    try {
        const { stage } = req.body || {};

        if (!stage) {
            return res.status(400).json({
                success: false,
                error: 'Etapa n�o informada'
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
                error: 'Ordem de produ��o n�o encontrada'
            });
        }

        const stages = obterEtapas();

        if (!stages.includes(stage)) {
            return res.status(400).json({
                success: false,
                error: `Etapa inv�lida: ${stage}`,
                stages
            });
        }

        const stageFinal = stages[stages.length - 1];
        const statusFinal = stage === stageFinal
            ? 'Finalizado'
            : (stage === stages[0] ? 'Aguardando Produ��o' : 'Em Produ��o');

        const dataAtual = agora();

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE ordens_producao
                SET
                    current_stage = ?,
                    status = ?,
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
                `Movido para: ${stage}`,
                null,
                'Usu�rio',
                dataAtual
            );
        });

        transaction();

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
                error: 'Ordem de produ��o n�o encontrada'
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
            quantidade_produzida: 'quantidade_produzida'
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

        const stages = obterEtapas();

        if (!stages.includes(currentStage)) {
            return res.status(400).json({
                success: false,
                error: `Etapa inv�lida: ${currentStage}`,
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
                client
            )
            VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            numero,
            productId,
            quantity,
            currentStage === stages[stages.length - 1]
                ? 'Finalizado'
                : (currentStage === stages[0]
                    ? 'Aguardando Produ��o'
                    : 'Em Produ��o'),
            priority,
            expectedDelivery,
            observations,
            dataAtual,
            dataAtual,
            currentStage,
            productName,
            sku,
            client
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
            'Usu�rio',
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
                error: 'Ordem de produ��o n�o encontrada'
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
            message: 'Ordem de produ��o exclu�da com sucesso'
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
                error: 'order_id n�o informado'
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
                error: 'Ordem de produ��o n�o encontrada'
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
                error: 'Apontamento n�o encontrado'
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
                error: 'Lista de etapas inv�lida'
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

export default router;
