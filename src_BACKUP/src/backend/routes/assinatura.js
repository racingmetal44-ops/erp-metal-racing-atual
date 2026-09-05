import express from 'express';
const router = express.Router();

router.post('/assinar-xml', async (req, res) => {
    try {
        const { xml, empresa_id } = req.body;

        if (!xml) {
            return res.status(400).json({
                success: false,
                error: 'XML não informado'
            });
        }

        console.log('[ASSINATURA] Recebido XML para assinar');
        console.log('[ASSINATURA] Tamanho do XML:', xml.length);

        res.json({
            success: true,
            message: 'XML recebido com sucesso',
            xmlAssinado: xml,
            data: {
                recebido_em: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[ASSINATURA] Erro:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
