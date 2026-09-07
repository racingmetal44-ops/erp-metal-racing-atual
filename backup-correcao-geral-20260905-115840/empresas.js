const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const empresasFilePath = path.join(__dirname, '../../data/companies.json');

const lerEmpresas = () => {
    try {
        if (fs.existsSync(empresasFilePath)) {
            const data = fs.readFileSync(empresasFilePath, 'utf8');
            const empresas = JSON.parse(data);
            return Array.isArray(empresas) ? empresas : [empresas];
        }
        return [];
    } catch (error) {
        console.error('Erro ao ler empresas:', error);
        return [];
    }
};

router.get('/', (req, res) => {
    const empresas = lerEmpresas();
    res.json(empresas);
});

router.get('/:id', (req, res) => {
    const empresas = lerEmpresas();
    const empresa = empresas.find(e => e.id === req.params.id || e.cnpj === req.params.id);
    if (empresa) {
        res.json(empresa);
    } else {
        res.status(404).json({ error: 'Empresa não encontrada' });
    }
});

module.exports = router;
