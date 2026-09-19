import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const dbPath = path.join(__dirname, '..', 'database', 'metal-racing.db');

// GET - Lista todos os avisos
router.get('/', (req, res) => {
    try {
        const db = new Database(dbPath, { readonly: true });
        const avisos = db.prepare(`
            SELECT id, tipo, titulo, mensagem AS descricao, prioridade AS nivel, lido, created_at
            FROM alertas
            ORDER BY lido ASC, created_at DESC
            LIMIT 100
        `).all();
        db.close();
        res.json(avisos);
    } catch (e) {
        console.error('Erro GET /api/alertas:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST - Cria novo aviso
router.post('/', (req, res) => {
    try {
        const { titulo, descricao, nivel } = req.body;
        if (!titulo) return res.status(400).json({ error: 'Titulo obrigatorio' });
        
        const db = new Database(dbPath);
        const stmt = db.prepare(`
            INSERT INTO alertas (tipo, titulo, mensagem, prioridade, lido, created_at)
            VALUES ('manual', ?, ?, ?, 0, datetime('now'))
        `);
        const info = stmt.run(titulo, descricao || '', nivel || 'medio');
        db.close();
        
        res.json({ id: info.lastInsertRowid, titulo, descricao, nivel, ok: true });
    } catch (e) {
        console.error('Erro POST /api/alertas:', e);
        res.status(500).json({ error: e.message });
    }
});

// PATCH - Atualiza (ativar/desativar)
router.patch('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { lido } = req.body;
        
        console.log(`PATCH /api/alertas/${id} - lido: ${lido}`);
        
        const db = new Database(dbPath);
        const stmt = db.prepare(`UPDATE alertas SET lido = ? WHERE id = ?`);
        const info = stmt.run(lido ? 1 : 0, id);
        db.close();
        
        res.json({ ok: true, id, lido, changes: info.changes });
    } catch (e) {
        console.error('Erro PATCH /api/alertas/:id:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE - Remove aviso
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        console.log(`DELETE /api/alertas/${id}`);
        
        const db = new Database(dbPath);
        const info = db.prepare(`DELETE FROM alertas WHERE id = ?`).run(id);
        db.close();
        
        res.json({ ok: true, id, deleted: info.changes });
    } catch (e) {
        console.error('Erro DELETE /api/alertas/:id:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
