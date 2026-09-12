?import express from 'express';
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
                error: 'Nome, e-mail e senha s�o obrigat�rios.'
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
                error: 'Este e-mail j� est� cadastrado.'
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
                error: 'E-mail e senha s�o obrigat�rios.'
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
                error: 'E-mail ou senha inv�lidos.'
            });
        }

        if (!usuario.senha_hash) {
            return res.status(401).json({
                success: false,
                error: 'Este usu�rio ainda n�o possui uma senha local cadastrada.'
            });
        }

        const senhaValida = await bcrypt.compare(password, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({
                success: false,
                error: 'E-mail ou senha inv�lidos.'
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

export default router;

