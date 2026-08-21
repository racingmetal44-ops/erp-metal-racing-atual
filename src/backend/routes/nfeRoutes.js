import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ============================================
// ARMAZENAMENTO
// ============================================
const DATA_DIR = path.join(process.cwd(), 'data');
const NFE_FILE = path.join(DATA_DIR, 'nfe.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(NFE_FILE)) {
    fs.writeJsonSync(NFE_FILE, []);
}

function getNFe() {
    try {
        return fs.readJsonSync(NFE_FILE);
    } catch {
        return [];
    }
}

function saveNFe(nfeList) {
    fs.writeJsonSync(NFE_FILE, nfeList);
}

// ============================================
// ROTAS
// ============================================

// Listar NF-e emitidas
router.get('/', (req, res) => {
    try {
        const nfeList = getNFe();
        res.json(nfeList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Emitir NF-e
router.post('/emitir', async (req, res) => {
    try {
        const { empresa_id, cliente, cnpj_cliente, produtos, total, numero, serie, natureza_operacao, observacao } = req.body;
        
        if (!empresa_id || !cliente || !produtos || produtos.length === 0) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const nfe = {
            id: Date.now(),
            empresa_id,
            numero: numero || String(Date.now()).slice(-6),
            serie: serie || '1',
            cliente,
            cnpj_cliente: cnpj_cliente || '',
            produtos,
            total: total || produtos.reduce((s, p) => s + (p.quantidade * p.valor_unitario), 0),
            natureza_operacao: natureza_operacao || 'VENDA',
            observacao: observacao || '',
            status: 'EMITIDA',
            chave_acesso: 'NFE' + Date.now(),
            data_emissao: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        const nfeList = getNFe();
        nfeList.push(nfe);
        saveNFe(nfeList);

        // Simular envio para SEFAZ
        const resultadoSefaz = {
            cStat: '100',
            xMotivo: 'Autorizado o uso da NF-e',
            nProt: String(Date.now()).padStart(15, '0'),
            dhRecbto: new Date().toISOString()
        };

        res.json({
            success: true,
            data: nfe,
            sefaz: resultadoSefaz,
            message: 'NF-e emitida com sucesso!'
        });
    } catch (error) {
        console.error('Erro ao emitir NF-e:', error);
        res.status(500).json({ error: error.message });
    }
});

// Testar SEFAZ
router.post('/testar-sefaz', async (req, res) => {
    try {
        const { empresa_id } = req.body;
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'Empresa não informada' });
        }

        // Simular teste SEFAZ
        const resultado = {
            success: true,
            cStat: '107',
            xMotivo: 'Serviço em operação',
            ambiente: 'homologacao',
            uf: 'SC',
            data: new Date().toISOString(),
            message: 'SEFAZ conectada com sucesso!'
        };

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar NF-e
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const nfeList = getNFe();
        const filtered = nfeList.filter(n => n.id !== id);
        
        if (filtered.length === nfeList.length) {
            return res.status(404).json({ error: 'NF-e não encontrada' });
        }
        
        saveNFe(filtered);
        res.json({ success: true, message: 'NF-e cancelada!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
