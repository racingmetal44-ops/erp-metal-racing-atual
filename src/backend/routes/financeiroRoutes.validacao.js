import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../data');
const CONTAS_FILE = path.join(DATA_DIR, 'contas-pagar.json');
const NFE_FILE = path.join(DATA_DIR, 'nfe-entradas.json');

function garantirArquivo() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(CONTAS_FILE)) {
        fs.writeFileSync(
            CONTAS_FILE,
            JSON.stringify([], null, 2),
            'utf8'
        );
    }
}

function lerContas() {
    garantirArquivo();

    try {
        const conteudo = fs.readFileSync(CONTAS_FILE, 'utf8');
        return JSON.parse(conteudo || '[]');
    } catch {
        return [];
    }
}

function salvarContas(contas) {
    garantirArquivo();

    fs.writeFileSync(
        CONTAS_FILE,
        JSON.stringify(contas, null, 2),
        'utf8'
    );
}

function lerNfes() {
    if (!fs.existsSync(NFE_FILE)) {
        return [];
    }

    try {
        const conteudo = fs.readFileSync(NFE_FILE, 'utf8');
        return JSON.parse(conteudo || '[]');
    } catch {
        return [];
    }
}

function hoje() {
    return new Date().toISOString().slice(0, 10);
}

function calcularStatus(conta) {
    if (conta.status === 'PAGA') {
        return 'PAGA';
    }

    const valor = Number(conta.valor || 0);
    const pago = Number(conta.valor_pago || 0);

    if (pago > 0 && pago < valor) {
        return 'PARCIAL';
    }

    if (
        conta.data_vencimento &&
        conta.data_vencimento < hoje()
    ) {
        return 'VENCIDA';
    }

    return 'PENDENTE';
}

// =====================================================
// SINCRONIZAR NF-e ? CONTAS A PAGAR
// =====================================================

router.post('/sincronizar-nfe', (req, res) => {
    try {
        const contas = lerContas();
        const nfes = lerNfes();

        let criadas = 0;

        for (const nfe of nfes) {
            const duplicatas =
                Array.isArray(nfe?.pagamento?.duplicatas)
                    ? nfe.pagamento.duplicatas
                    : [];

            for (const parcela of duplicatas) {
                const chave = String(nfe.chave || '');

                const numeroParcela =
                    String(parcela.numero || '');

                const existe = contas.some(item =>
                    String(item.nfe_chave || '') === chave &&
                    String(item.numero_parcela || '') === numeroParcela
                );

                if (existe) {
                    continue;
                }

                const proximoId =
                    contas.length > 0
                        ? Math.max(
                            ...contas.map(item =>
                                Number(item.id) || 0
                            )
                        ) + 1
                        : 1;

                const valor =
                    Number(parcela.valor || 0);

                const conta = {
                    id: proximoId,

                    fornecedor_nome:
                        nfe?.fornecedor?.razaoSocial ||
                        nfe?.fornecedor?.nomeFantasia ||
                        'Fornecedor não informado',

                    fornecedor_cnpj:
                        nfe?.fornecedor?.cnpj ||
                        nfe?.fornecedor?.cpf ||
                        '',

                    nfe_id:
                        nfe.id ?? null,

                    nfe_numero:
                        nfe.numero ?? '',

                    nfe_serie:
                        nfe.serie ?? '',

                    nfe_chave:
                        chave,

                    numero_titulo:
                        `${nfe.numero || 'NF'}-${numeroParcela || '1'}`,

                    numero_parcela:
                        numeroParcela,

                    descricao:
                        `NF-e ${nfe.numero || ''} - Parcela ${numeroParcela || ''}`,

                    valor,

                    valor_pago: 0,

                    data_emissao:
                        nfe.dataEmissao || null,

                    data_vencimento:
                        parcela.vencimento || null,

                    data_pagamento:
                        null,

                    status:
                        calcularStatus({
                            valor,
                            valor_pago: 0,
                            data_vencimento:
                                parcela.vencimento || null
                        }),

                    forma_pagamento:
                        nfe?.pagamento?.pagamentos?.[0]?.forma ||
                        '',

                    forma_pagamento_descricao:
                        nfe?.pagamento?.pagamentos?.[0]?.descricaoForma ||
                        '',

                    conta_financeira: '',

                    centro_custo: '',

                    juros: 0,

                    multa: 0,

                    desconto: 0,

                    observacao: '',

                    origem: 'NFE_ENTRADA',

                    created_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString()
                };

                contas.push(conta);
                criadas++;
            }
        }

        salvarContas(contas);

        res.json({
            success: true,
            criadas,
            total: contas.length
        });

    } catch (error) {
        console.error(
            '[FINANCEIRO] Erro ao sincronizar NF-e:',
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// LISTAR CONTAS A PAGAR
// =====================================================

router.get('/contas-pagar', (req, res) => {
    try {
        const contas = lerContas();

        const atualizadas = contas.map(conta => ({
            ...conta,
            status: calcularStatus(conta)
        }));

        salvarContas(atualizadas);

        res.json({
            success: true,
            contas: atualizadas,
            count: atualizadas.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// BAIXAR / PAGAR TéTULO
// =====================================================

router.post('/contas-pagar/:id/baixar', (req, res) => {
    try {
        const contas = lerContas();

        const id = Number(req.params.id);

        const conta = contas.find(
            item => Number(item.id) === id
        );

        if (!conta) {
            return res.status(404).json({
                success: false,
                error: 'Conta a pagar não encontrada.'
            });
        }

        const valorOriginal = Number(conta.valor || 0);
        const valorPagoAnterior = Number(conta.valor_pago || 0);

        const juros = Number(req.body.juros || 0);
        const multa = Number(req.body.multa || 0);
        const desconto = Number(req.body.desconto || 0);
        const valorInformado = Number(req.body.valor_pago);

        if (!Number.isFinite(valorOriginal) || valorOriginal <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valor original da conta é inválido.'
            });
        }

        if (!Number.isFinite(valorInformado) || valorInformado <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Informe um valor de pagamento maior que zero.'
            });
        }

        if (
            !Number.isFinite(juros) ||
            !Number.isFinite(multa) ||
            !Number.isFinite(desconto) ||
            juros < 0 ||
            multa < 0 ||
            desconto < 0
        ) {
            return res.status(400).json({
                success: false,
                error: 'Juros, multa e desconto devem ser valores válidos e não negativos.'
            });
        }

        const baixas = Array.isArray(conta.baixas)
            ? conta.baixas
            : [];

        const jurosAnteriores = baixas.reduce(
            (total, baixa) => total + Number(baixa.juros || 0),
            0
        );

        const multaAnterior = baixas.reduce(
            (total, baixa) => total + Number(baixa.multa || 0),
            0
        );

        const descontoAnterior = baixas.reduce(
            (total, baixa) => total + Number(baixa.desconto || 0),
            0
        );

        const totalJuros = jurosAnteriores + juros;
        const totalMulta = multaAnterior + multa;
        const totalDesconto = descontoAnterior + desconto;

        const valorTotalDevido =
            valorOriginal +
            totalJuros +
            totalMulta -
            totalDesconto;

        const saldoAntes =
            valorTotalDevido - valorPagoAnterior;

        if (saldoAntes <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Esta conta já está totalmente paga.'
            });
        }

        if (valorInformado > saldoAntes + 0.01) {
            return res.status(400).json({
                success: false,
                error: `Valor informado excede o saldo restante de R$ ${saldoAntes.toFixed(2)}.`
            });
        }

        const dataPagamento =
            req.body.data_pagamento ||
            hoje();

        const novaBaixa = {
            id: Date.now(),
            valor: valorInformado,
            juros,
            multa,
            desconto,
            data_pagamento: dataPagamento,
            forma_pagamento:
                req.body.forma_pagamento ||
                conta.forma_pagamento ||
                '',
            conta_financeira:
                req.body.conta_financeira ||
                conta.conta_financeira ||
                '',
            observacao:
                req.body.observacao ||
                '',
            created_at: new Date().toISOString()
        };

        baixas.push(novaBaixa);

        const novoValorPago =
            valorPagoAnterior +
            valorInformado;

        const saldoDepois =
            valorTotalDevido -
            novoValorPago;

        conta.baixas = baixas;
        conta.valor_pago = Number(novoValorPago.toFixed(2));

        conta.juros = Number(totalJuros.toFixed(2));
        conta.multa = Number(totalMulta.toFixed(2));
        conta.desconto = Number(totalDesconto.toFixed(2));

        conta.data_pagamento =
            dataPagamento;

        conta.forma_pagamento =
            novaBaixa.forma_pagamento;

        conta.conta_financeira =
            novaBaixa.conta_financeira;

        conta.observacao =
            novaBaixa.observacao ||
            conta.observacao ||
            '';

        if (saldoDepois <= 0.01) {
            conta.valor_pago =
                Number(valorTotalDevido.toFixed(2));

            conta.status = 'PAGA';
        } else {
            conta.status = 'PARCIAL';
        }

        conta.updated_at =
            new Date().toISOString();

        salvarContas(contas);

        res.json({
            success: true,
            conta,
            saldo_restante: Number(
                Math.max(0, saldoDepois).toFixed(2)
            )
        });

    } catch (error) {
        console.error(
            '[FINANCEIRO] Erro na baixa:',
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

