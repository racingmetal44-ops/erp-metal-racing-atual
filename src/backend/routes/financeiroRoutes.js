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
    if (process.env.VERCEL) {
        return;
    }

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

function arredondar(valor) {
    return Number(Number(valor || 0).toFixed(2));
}

function dataDocumento(nfe) {
    return String(
        nfe?.dataEntrada ||
        nfe?.dataEmissao ||
        ''
    ).slice(0, 10);
}

function nfeRegistradaComoEntrada(nfe) {
    return String(nfe?.status || '').toUpperCase() === 'CONFIRMADA';
}

export function sincronizarContasNfe({ persistir = true } = {}) {
    const contas = lerContas();
    const nfes = lerNfes();
    let criadas = 0;
    let atualizadas = 0;

    for (const nfe of nfes) {
        if (!nfeRegistradaComoEntrada(nfe)) {
            continue;
        }

        const duplicatas = Array.isArray(nfe?.pagamento?.duplicatas)
            ? nfe.pagamento.duplicatas
            : [];

        for (const parcela of duplicatas) {
            const chave = String(nfe.chave || '');
            const numeroParcela = String(parcela.numero || '1');
            const existente = contas.find(item =>
                String(item.nfe_chave || '') === chave &&
                String(item.numero_parcela || '1') === numeroParcela
            );

            const base = {
                fornecedor_nome: nfe?.fornecedor?.razaoSocial || nfe?.fornecedor?.nomeFantasia || 'Fornecedor não informado',
                fornecedor_cnpj: nfe?.fornecedor?.cnpj || nfe?.fornecedor?.cpf || '',
                nfe_id: nfe.id ?? null,
                nfe_numero: nfe.numero ?? '',
                nfe_serie: nfe.serie ?? '',
                nfe_chave: chave,
                numero_titulo: `${nfe.numero || 'NF'}-${numeroParcela}`,
                numero_parcela: numeroParcela,
                descricao: `NF-e ${nfe.numero || ''} - Parcela ${numeroParcela}`,
                valor: arredondar(parcela.valor),
                data_emissao: nfe.dataEmissao || null,
                data_vencimento: parcela.vencimento || null,
                forma_pagamento: nfe?.pagamento?.pagamentos?.[0]?.forma || '',
                forma_pagamento_descricao: nfe?.pagamento?.pagamentos?.[0]?.descricaoForma || '',
                origem: 'NFE_ENTRADA'
            };

            if (existente) {
                Object.assign(existente, base, {
                    updated_at: new Date().toISOString(),
                    status: calcularStatus(existente)
                });
                atualizadas++;
                continue;
            }

            const proximoId = contas.length
                ? Math.max(...contas.map(item => Number(item.id) || 0)) + 1
                : 1;

            contas.push({
                id: proximoId,
                ...base,
                valor_pago: 0,
                data_pagamento: null,
                status: calcularStatus(base),
                conta_financeira: '',
                centro_custo: '',
                categoria: 'NF-e de entrada',
                juros: 0,
                multa: 0,
                desconto: 0,
                observacao: '',
                baixas: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            criadas++;
        }
    }

    if (persistir) salvarContas(contas);
    return { contas, criadas, atualizadas };
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
// SINCRONIZAR NF-e é?' CONTAS A PAGAR
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
// BAIXAR / PAGAR TÍTULO
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


// =====================================================
// RELATéRIO FINANCEIRO + NF-e DE ENTRADA
// =====================================================

function gerarRelatorioNfeFinanceiro(req) {
    const query = req.method === 'GET' ? req.query : req.body;
    const filtros = query || {};
    const sincronizacao = sincronizarContasNfe();
    const contas = sincronizacao.contas.map(conta => ({
        ...conta,
        status: calcularStatus(conta)
    }));
    const chavesSelecionadas = new Set();

    let nfes = lerNfes().filter(nfeRegistradaComoEntrada);

    const inicio = filtros.dataInicial || filtros.data_inicio || '';
    const fim = filtros.dataFinal || filtros.data_fim || '';
    const fornecedor = String(filtros.fornecedor || '').trim().toLowerCase();
    const cnpj = String(filtros.cnpj || '').replace(/\D/g, '');
    const numero = String(filtros.numero || '').trim().toLowerCase();
    const statusNfe = String(filtros.statusNfe || filtros.status || '').toUpperCase();

    nfes = nfes.filter(nfe => {
        const data = dataDocumento(nfe);
        const nomeFornecedor = String(nfe?.fornecedor?.razaoSocial || nfe?.fornecedor?.nomeFantasia || '').toLowerCase();
        const documentoFornecedor = String(nfe?.fornecedor?.cnpj || nfe?.fornecedor?.cpf || '').replace(/\D/g, '');
        const status = String(nfe?.status || '').toUpperCase();

        if (inicio && data < inicio) return false;
        if (fim && data > fim) return false;
        if (fornecedor && !nomeFornecedor.includes(fornecedor) && !documentoFornecedor.includes(fornecedor)) return false;
        if (cnpj && !documentoFornecedor.includes(cnpj)) return false;
        if (numero && !String(nfe.numero || '').toLowerCase().includes(numero)) return false;
        if (statusNfe && statusNfe !== 'TODAS' && status !== statusNfe) return false;
        return true;
    });

    nfes.forEach(nfe => chavesSelecionadas.add(String(nfe.chave || '')));

    const nfeRows = nfes.map(nfe => {
        const totais = nfe.totais || {};
        const fornecedorNfe = nfe.fornecedor || {};
        return {
            id: nfe.id,
            numero: nfe.numero || '',
            serie: nfe.serie || '',
            chave: nfe.chave || '',
            data_emissao: nfe.dataEmissao || '',
            data_entrada: nfe.dataEntrada || '',
            modelo: nfe.modelo || '55',
            tipo_operacao: nfe.tipoOperacao || '',
            natureza_operacao: nfe.naturezaOperacao || '',
            emitente: fornecedorNfe.razaoSocial || fornecedorNfe.nomeFantasia || '',
            fornecedor_cnpj: fornecedorNfe.cnpj || fornecedorNfe.cpf || '',
            fornecedor_ie: fornecedorNfe.ie || fornecedorNfe.inscricaoEstadual || '',
            destinatario: nfe.destinatario?.razaoSocial || nfe.destinatario?.nome || '',
            destinatario_cnpj: nfe.destinatario?.cnpj || nfe.destinatario?.cpf || '',
            status: nfe.status || '',
            protocolo: nfe.protocoloSefaz || nfe.protocolo || '',
            valor_produtos: arredondar(totais.produtos || totais.valorProdutos),
            frete: arredondar(totais.frete),
            seguro: arredondar(totais.seguro),
            desconto: arredondar(totais.desconto),
            outras_despesas: arredondar(totais.outrasDespesas),
            base_icms: arredondar(totais.baseIcms || totais.baseICMS),
            valor_icms: arredondar(totais.icms || totais.valorICMS),
            base_icms_st: arredondar(totais.baseIcmsSt || totais.baseICMSST),
            valor_icms_st: arredondar(totais.icmsSt || totais.valorICMSST),
            ipi: arredondar(totais.ipi),
            pis: arredondar(totais.pis),
            cofins: arredondar(totais.cofins),
            fcp: arredondar(totais.fcp),
            total: arredondar(totais.nota || totais.total)
        };
    });

    const produtos = nfes.flatMap(nfe => (nfe.produtos || []).map((produto, index) => ({
        nfe_numero: nfe.numero || '',
        nfe_chave: nfe.chave || '',
        item: produto.item || index + 1,
        codigo: produto.codigo || '',
        sku: produto.sku || '',
        ean: produto.ean || produto.gtin || '',
        descricao: produto.descricao || '',
        ncm: produto.ncm || '',
        cfop: produto.cfop || '',
        cest: produto.cest || '',
        unidade: produto.unidade || '',
        quantidade: Number(produto.quantidade || 0),
        valor_unitario: arredondar(produto.valorUnitario),
        valor_total: arredondar(produto.valorTotal),
        desconto: arredondar(produto.desconto),
        icms: arredondar(produto.icms),
        ipi: arredondar(produto.ipi),
        pis: arredondar(produto.pis),
        cofins: arredondar(produto.cofins)
    })));

    const contasRelacionadas = contas.filter(conta => chavesSelecionadas.has(String(conta.nfe_chave || '')));
    const situacao = String(filtros.situacaoFinanceira || filtros.financeiro || '').toUpperCase();
    const contasFiltradas = situacao && situacao !== 'TODAS'
        ? contasRelacionadas.filter(conta => {
            if (situacao === 'PAGO' || situacao === 'PAGOS') return conta.status === 'PAGA';
            if (situacao === 'VENCIDO' || situacao === 'VENCIDOS') return conta.status === 'VENCIDA';
            if (situacao === 'PENDENTE' || situacao === 'PENDENTES') return conta.status === 'PENDENTE' || conta.status === 'PARCIAL';
            return true;
        })
        : contasRelacionadas;

    const totalNfe = nfeRows.reduce((total, item) => total + item.total, 0);
    const totalImpostos = nfeRows.reduce((total, item) => total + item.valor_icms + item.valor_icms_st + item.ipi + item.pis + item.cofins + item.fcp, 0);
    const totalFinanceiro = contasFiltradas.reduce((total, item) => total + Number(item.valor || 0), 0);
    const totalPago = contasFiltradas.reduce((total, item) => total + Number(item.valor_pago || 0), 0);
    const totalPendente = contasFiltradas.reduce((total, item) => total + Math.max(Number(item.valor || 0) - Number(item.valor_pago || 0), 0), 0);
    const totalVencido = contasFiltradas.filter(item => item.status === 'VENCIDA').reduce((total, item) => total + Math.max(Number(item.valor || 0) - Number(item.valor_pago || 0), 0), 0);

    return {
        success: true,
        filtros,
        resumo: {
            quantidade_nfe: nfeRows.length,
            valor_total_nfe: arredondar(totalNfe),
            total_produtos: produtos.reduce((total, item) => total + item.quantidade, 0),
            total_impostos: arredondar(totalImpostos),
            total_financeiro: arredondar(totalFinanceiro),
            total_pago: arredondar(totalPago),
            total_pendente: arredondar(totalPendente),
            total_vencido: arredondar(totalVencido),
            quantidade_titulos: contasFiltradas.length,
            quantidade_fornecedores: new Set(nfeRows.map(item => item.fornecedor_cnpj || item.emitente)).size
        },
        nfe: nfeRows,
        produtos,
        financeiro: contasFiltradas,
        impostos: nfeRows.map(item => ({ numero: item.numero, chave: item.chave, icms: item.valor_icms, icms_st: item.valor_icms_st, ipi: item.ipi, pis: item.pis, cofins: item.cofins, fcp: item.fcp }))
    };
}

const relatorioNfeFinanceiro = (req, res) => {
    try {
        res.json(gerarRelatorioNfeFinanceiro(req));
    } catch (error) {
        console.error('[RELATORIO NFE] Erro ao gerar relatório:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

router.get('/relatorios/nfe-financeiro', relatorioNfeFinanceiro);
router.post('/relatorios/nfe-financeiro', relatorioNfeFinanceiro);

router.get('/relatorio', (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            status,
            fornecedor
        } = req.query;

        const contas = lerContas();
        const nfes = lerNfes();

        let contasFiltradas = [...contas];
        let nfesFiltradas = [...nfes];

        if (data_inicio) {
            contasFiltradas = contasFiltradas.filter(conta =>
                String(conta.data_vencimento || '') >= String(data_inicio)
            );

            nfesFiltradas = nfesFiltradas.filter(nfe =>
                String(nfe.dataEntrada || nfe.dataEmissao || '') >= String(data_inicio)
            );
        }

        if (data_fim) {
            contasFiltradas = contasFiltradas.filter(conta =>
                String(conta.data_vencimento || '') <= String(data_fim)
            );

            nfesFiltradas = nfesFiltradas.filter(nfe =>
                String(nfe.dataEntrada || nfe.dataEmissao || '') <= String(data_fim)
            );
        }

        if (status) {
            contasFiltradas = contasFiltradas.filter(
                conta => conta.status === status
            );
        }

        if (fornecedor) {
            const termo = String(fornecedor).toLowerCase();

            contasFiltradas = contasFiltradas.filter(conta =>
                String(conta.fornecedor_nome || '')
                    .toLowerCase()
                    .includes(termo) ||
                String(conta.fornecedor_cnpj || '')
                    .toLowerCase()
                    .includes(termo)
            );

            nfesFiltradas = nfesFiltradas.filter(nfe =>
                String(nfe?.fornecedor?.razaoSocial || '')
                    .toLowerCase()
                    .includes(termo) ||
                String(nfe?.fornecedor?.nomeFantasia || '')
                    .toLowerCase()
                    .includes(termo) ||
                String(nfe?.fornecedor?.cnpj || '')
                    .toLowerCase()
                    .includes(termo)
            );
        }

        contasFiltradas = contasFiltradas.map(conta => ({
            ...conta,
            status: calcularStatus(conta)
        }));

        const totalOriginal = contasFiltradas.reduce(
            (total, conta) =>
                total + Number(conta.valor || 0),
            0
        );

        const totalPago = contasFiltradas.reduce(
            (total, conta) =>
                total + Number(conta.valor_pago || 0),
            0
        );

        const totalPendente = contasFiltradas.reduce(
            (total, conta) =>
                total + Math.max(
                    Number(conta.valor || 0) -
                    Number(conta.valor_pago || 0),
                    0
                ),
            0
        );

        const totalJuros = contasFiltradas.reduce(
            (total, conta) =>
                total + Number(conta.juros || 0),
            0
        );

        const totalMulta = contasFiltradas.reduce(
            (total, conta) =>
                total + Number(conta.multa || 0),
            0
        );

        const totalDesconto = contasFiltradas.reduce(
            (total, conta) =>
                total + Number(conta.desconto || 0),
            0
        );

        res.json({
            success: true,

            filtros: {
                data_inicio: data_inicio || null,
                data_fim: data_fim || null,
                status: status || null,
                fornecedor: fornecedor || null
            },

            resumo: {
                total_nfe: nfesFiltradas.length,
                total_titulos: contasFiltradas.length,

                total_original: Number(totalOriginal.toFixed(2)),
                total_pago: Number(totalPago.toFixed(2)),
                total_pendente: Number(totalPendente.toFixed(2)),
                total_juros: Number(totalJuros.toFixed(2)),
                total_multa: Number(totalMulta.toFixed(2)),
                total_desconto: Number(totalDesconto.toFixed(2)),

                quantidade_pagas:
                    contasFiltradas.filter(
                        conta => conta.status === 'PAGA'
                    ).length,

                quantidade_pendentes:
                    contasFiltradas.filter(
                        conta =>
                            conta.status === 'PENDENTE' ||
                            conta.status === 'PARCIAL'
                    ).length,

                quantidade_vencidas:
                    contasFiltradas.filter(
                        conta => conta.status === 'VENCIDA'
                    ).length
            },

            contas_pagar: contasFiltradas,
            nfe_entradas: nfesFiltradas
        });

    } catch (error) {
        console.error(
            '[FINANCEIRO] Erro ao gerar relatério:',
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

