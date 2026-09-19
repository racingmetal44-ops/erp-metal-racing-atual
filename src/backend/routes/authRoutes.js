import express from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';

const router = express.Router();


router.post('/register', async (req, res) => {
    try {
        const nome = String(req.body?.nome || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        if (!nome || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Nome, e-mail e senha sï¿½o obrigatï¿½rios.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'A senha deve ter pelo menos 6 caracteres.'
            });
        }

        const usuarioExistente = db.prepare(`
            SELECT id
            FROM usuarios
            WHERE LOWER(email) = ?
            LIMIT 1
        `).get(email);

        if (usuarioExistente) {
            return res.status(409).json({
                success: false,
                error: 'Este e-mail jï¿½ estï¿½ cadastrado.'
            });
        }

        const senhaHash = await bcrypt.hash(password, 12);
        const agora = new Date().toISOString();

        const resultado = db.prepare(`
            INSERT INTO usuarios (
                nome,
                email,
                senha_hash,
                perfil,
                ativo,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            nome,
            email,
            senhaHash,
            'USUARIO',
            1,
            agora,
            agora
        );

        return res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso.',
            user: {
                id: resultado.lastInsertRowid,
                nome,
                email,
                perfil: 'USUARIO',
                ativo: 1,
                avatar_url: null
            }
        });
    } catch (error) {
        console.error('[AUTH] Erro no cadastro:', error);

        return res.status(500).json({
            success: false,
            error: 'Erro interno ao criar conta.'
        });
    }
});
router.post('/login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'E-mail e senha sï¿½o obrigatï¿½rios.'
            });
        }

        const usuario = db.prepare(`
            SELECT
                id,
                nome,
                email,
                senha_hash,
                perfil,
                ativo,
                avatar_url
            FROM usuarios
            WHERE LOWER(email) = ?
            LIMIT 1
        `).get(email);

        if (!usuario || !Number(usuario.ativo)) {
            return res.status(401).json({
                success: false,
                error: 'E-mail ou senha invï¿½lidos.'
            });
        }

        if (!usuario.senha_hash) {
            return res.status(401).json({
                success: false,
                error: 'Este usuï¿½rio ainda nï¿½o possui uma senha local cadastrada.'
            });
        }

        const senhaValida = await bcrypt.compare(password, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({
                success: false,
                error: 'E-mail ou senha invï¿½lidos.'
            });
        }

        const agora = new Date().toISOString();

        db.prepare(`
            UPDATE usuarios
            SET ultimo_login = ?,
                updated_at = ?
            WHERE id = ?
        `).run(agora, agora, usuario.id);

        return res.json({
            success: true,
            user: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
                ativo: usuario.ativo,
                avatar_url: usuario.avatar_url || null
            }
        });
    } catch (error) {
        console.error('[AUTH] Erro no login:', error);

        return res.status(500).json({
            success: false,
            error: 'Erro interno ao realizar login.'
        });
    }
});

// ============================================
// CRUD DE USUÁRIOS (nome obrigatório, email/senha opcionais)
// ============================================

// LISTAR
router.get('/usuarios', (req, res) => {
    try {
        const lista = db.prepare(`
            SELECT id, nome, email, perfil, ativo, avatar_url, created_at
            FROM usuarios
            ORDER BY nome ASC
        `).all();

        return res.json({ success: true, data: lista, usuarios: lista });
    } catch (error) {
        console.error('[AUTH] GET /usuarios:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// CRIAR
router.post('/usuarios', async (req, res) => {
    try {
        const nome = String(req.body?.nome || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase() || null;
        const password = String(req.body?.password || '');
        const perfil = String(req.body?.perfil || 'USUARIO').trim().toUpperCase();

        if (!nome) {
            return res.status(400).json({ success: false, error: 'Nome é obrigatório.' });
        }

        // Se informou email, verifica duplicado
        if (email) {
            const existe = db.prepare(`SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1`).get(email);
            if (existe) {
                return res.status(409).json({ success: false, error: 'Este e-mail já está cadastrado.' });
            }
        }

        // Se informou senha, valida e faz hash
        let senhaHash = null;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres.' });
            }
            senhaHash = await bcrypt.hash(password, 12);
        }

        const agora = new Date().toISOString();

        const resultado = db.prepare(`
            INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        `).run(nome, email, senhaHash, perfil, agora, agora);

        return res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso.',
            user: { id: resultado.lastInsertRowid, nome, email, perfil, ativo: 1 }
        });
    } catch (error) {
        console.error('[AUTH] POST /usuarios:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ATUALIZAR
router.put('/usuarios/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const nome = String(req.body?.nome || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase() || null;
        const password = String(req.body?.password || '');
        const perfil = String(req.body?.perfil || 'USUARIO').trim().toUpperCase();
        const ativo = req.body?.ativo !== undefined ? Number(req.body.ativo) : 1;

        if (!id || !nome) {
            return res.status(400).json({ success: false, error: 'ID e nome são obrigatórios.' });
        }

        const existe = db.prepare(`SELECT id FROM usuarios WHERE id = ?`).get(id);
        if (!existe) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
        }

        // Se informou email, verifica duplicado (em outro usuário)
        if (email) {
            const duplicado = db.prepare(`SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ? LIMIT 1`).get(email, id);
            if (duplicado) {
                return res.status(409).json({ success: false, error: 'Este e-mail já está em uso.' });
            }
        }

        const agora = new Date().toISOString();

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres.' });
            }
            const senhaHash = await bcrypt.hash(password, 12);
            db.prepare(`
                UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, perfil = ?, ativo = ?, updated_at = ?
                WHERE id = ?
            `).run(nome, email, senhaHash, perfil, ativo, agora, id);
        } else {
            db.prepare(`
                UPDATE usuarios SET nome = ?, email = ?, perfil = ?, ativo = ?, updated_at = ?
                WHERE id = ?
            `).run(nome, email, perfil, ativo, agora, id);
        }

        return res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } catch (error) {
        console.error('[AUTH] PUT /usuarios/:id:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// DESATIVAR (soft delete)
router.delete('/usuarios/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID inválido.' });
        }

        const agora = new Date().toISOString();
        const resultado = db.prepare(`UPDATE usuarios SET ativo = 0, updated_at = ? WHERE id = ?`).run(agora, id);

        if (resultado.changes === 0) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
        }

        return res.json({ success: true, message: 'Usuário desativado.' });
    } catch (error) {
        console.error('[AUTH] DELETE /usuarios/:id:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// REATIVAR
router.patch('/usuarios/:id/reativar', (req, res) => {
    try {
        const id = Number(req.params.id);
        const agora = new Date().toISOString();
        db.prepare(`UPDATE usuarios SET ativo = 1, updated_at = ? WHERE id = ?`).run(agora, id);
        return res.json({ success: true, message: 'Usuário reativado.' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
