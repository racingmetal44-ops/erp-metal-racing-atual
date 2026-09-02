import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const API = ''

export function NfeEntradaPanel({ empresaId }) {

    const [aba, setAba] = useState('xml');
    const [entradas, setEntradas] = useState([]);
    const [produtosERP, setProdutosERP] = useState([]);
    const [entradaSelecionada, setEntradaSelecionada] = useState(null);

    const [arquivo, setArquivo] = useState(null);
    const [fornecedor, setFornecedor] = useState({
        razaoSocial: '',
        cnpj: '',
        ie: ''
    });

    const [manual, setManual] = useState({
        numero: '',
        serie: '1',
        chave: '',
        dataEmissao: '',
        cfop: '2102',
        naturezaOperacao: 'COMPRA',
        frete: 0,
        desconto: 0,
        valorTotal: 0,
        observacao: ''
    });

    const [produtosManual, setProdutosManual] = useState([
        {
            codigo: '',
            descricao: '',
            ncm: '',
            cfop: '2102',
            unidade: 'UN',
            quantidade: 1,
            valorUnitario: 0,
            valorTotal: 0,
            cstCsosn: '',
            ipi: 0,
            pis: 0,
            cofins: 0
        }
    ]);

    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    // =========================================
    // SEFAZ - Distribuição DF-e
    // =========================================
    const [consultandoSefaz, setConsultandoSefaz] = useState(false);
    const [resultadoSefaz, setResultadoSefaz] = useState(null);

    // =========================================
    // BLOQUEIO DE CONSULTA SEFAZ - cStat 656
    // =========================================
    const chaveBloqueioSefaz =
        `nfe-sefaz-bloqueio-${empresaId || 'sem-empresa'}`;

    const obterBloqueioSefaz = () => {
        try {
            const valor =
                localStorage.getItem(chaveBloqueioSefaz);

            const timestamp = Number(valor || 0);

            return Number.isFinite(timestamp)
                ? timestamp
                : 0;

        } catch {
            return 0;
        }
    };

    const [bloqueioSefazAte, setBloqueioSefazAte] =
        useState(() => obterBloqueioSefaz());

    const [tempoBloqueioSefaz, setTempoBloqueioSefaz] =
        useState(0);



    // =========================================
    // FILTROS E BUSCA
    // =========================================
    const [filtro, setFiltro] = useState('todas');
    const [busca, setBusca] = useState('');

    async function carregarEntradas() {

        const response =
            await fetch(`${API}/api/nfe-entradas`);

        const data =
            await response.json();

        if (data.success) {
            setEntradas(data.entradas || []);
        }
    }

    async function carregarProdutos() {

        const { data, error } =
            await supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true });

        if (error) {
            throw error;
        }

        console.log('=== PRODUTOS ERP CARREGADOS ===');
console.log('Quantidade:', (data || []).length);
console.log('Primeiro produto:', (data || [])[0]);
console.log('Campos do primeiro produto:', Object.keys((data || [])[0] || {}));

setProdutosERP(data || []);
    }

    // =========================================
    // LOCALIZAR PRODUTO DO ERP AUTOMATICAMENTE
    // =========================================
    function localizarProdutoERP(produto) {

        const codigoNFe =
            String(produto?.codigo || '')
                .trim()
                .toUpperCase();

        const eanNFe =
            String(produto?.ean || '')
                .replace(/\D/g, '');

        // 1 - Correspondência exata pelo SKU
        if (codigoNFe) {

            const porSku =
                produtosERP.find(
                    p =>
                        String(p?.sku || '')
                            .trim()
                            .toUpperCase() === codigoNFe
                );

            if (porSku) {
                return porSku;
            }
        }

        // 2 - Correspondência pelo EAN/barcode
        if (
            eanNFe &&
            eanNFe !== 'SEM GTIN' &&
            eanNFe !== '0'
        ) {

            const porEan =
                produtosERP.find(p => {

                    const eanERP =
                        String(
                            p?.barcode ||
                            p?.ean ||
                            p?.gtin ||
                            ''
                        ).replace(/\D/g, '');

                    return (
                        eanERP &&
                        eanERP === eanNFe
                    );
                });

            if (porEan) {
                return porEan;
            }
        }

        return null;
    }

    useEffect(() => {

        carregarEntradas().catch(console.error);
        carregarProdutos().catch(console.error);

    }, []);

    // =========================================
    // CONTADOR DO BLOQUEIO SEFAZ
    // =========================================
    useEffect(() => {

        const atualizarContador = () => {

            const restante =
                Math.max(
                    0,
                    Number(bloqueioSefazAte || 0) -
                    Date.now()
                );

            setTempoBloqueioSefaz(restante);

            if (restante <= 0) {

                try {
                    localStorage.removeItem(
                        chaveBloqueioSefaz
                    );
                } catch {}

                setBloqueioSefazAte(0);

            }

        };

        atualizarContador();

        const intervalo =
            window.setInterval(
                atualizarContador,
                1000
            );

        return () =>
            window.clearInterval(intervalo);

    }, [
        bloqueioSefazAte,
        chaveBloqueioSefaz
    ]);

    // =========================================
    // CONSULTAR SEFAZ (NFeDistribuicaoDFe)
    // =========================================
    async function consultarSefaz() {

        if (!empresaId) {
            setErro('Empresa não informada.');
            return;
        }

        const agora = Date.now();

        const bloqueadoAte =
            Number(
                localStorage.getItem(
                    chaveBloqueioSefaz
                ) || 0
            );

        if (bloqueadoAte > agora) {

            setBloqueioSefazAte(
                bloqueadoAte
            );

            setTempoBloqueioSefaz(
                bloqueadoAte - agora
            );

            setErro(
                '🔴 A consulta à SEFAZ está temporariamente bloqueada por consumo indevido (cStat 656). Aguarde 1 hora antes de consultar novamente.'
            );

            return;
        }

        setConsultandoSefaz(true);
        setErro('');
        setMensagem('');
        setResultadoSefaz(null);

        try {

            const response = await fetch(
                `${API}/api/nfe-entradas/sincronizar-sefaz`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        empresaId: String(empresaId)
                    })
                }
            );

            const data = await response.json();

            setResultadoSefaz(data);

            if (
                String(data?.cStat) === '656' ||
                data?.bloqueado === true
            ) {

                const ate =
                    Date.now() +
                    (
                        Number(
                            data?.aguardarMinutos ||
                            60
                        ) * 60 * 1000
                    );

                try {
                    localStorage.setItem(
                        chaveBloqueioSefaz,
                        String(ate)
                    );
                } catch {}

                setBloqueioSefazAte(ate);
                setTempoBloqueioSefaz(
                    ate - Date.now()
                );

                setMensagem('');

                setErro(
                    `🔴 SEFAZ bloqueou temporariamente a consulta. cStat 656 — Consumo Indevido. Aguarde 1 hora antes de consultar novamente.`
                );

                return;
            }

            if (data.success) {
                setMensagem(
                    `✅ ${data.message}`
                );
            } else {
                setErro(
                    `❌ SEFAZ: ${data.xMotivo || data.error || 'Consulta sem sucesso fiscal.'}`
                );
            }

            await carregarEntradas();

        } catch (error) {

            setErro(`Erro ao consultar SEFAZ: ${error.message}`);

        } finally {

            setConsultandoSefaz(false);

        }
    }

    // =========================================
    // MANIFESTAÇÃO DO DESTINATÁRIO
    // =========================================
    async function manifestar(entrada, tipoEvento) {

        setErro('');
        setMensagem('');

        const justificativa =
            tipoEvento === '210240'
                ? window.prompt(
                    'Operação não Realizada exige justificativa (mínimo 15 caracteres):'
                )
                : null;

        if (tipoEvento === '210240' && (!justificativa || justificativa.trim().length < 15)) {
            setErro('Justificativa obrigatória (mínimo 15 caracteres) para Operação não Realizada.');
            return;
        }

        setLoading(true);

        try {

            const response = await fetch(
                `${API}/api/nfe-entradas/${entrada.id}/manifestar`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tipoEvento,
                        justificativa
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.xMotivo || data.error || 'Falha na manifestação.');
            }

            setMensagem(`✅ ${data.message} (cStat ${data.cStat})`);

            await carregarEntradas();

        } catch (error) {

            setErro(`Manifestação: ${error.message}`);

        } finally {

            setLoading(false);

        }
    }

    // =========================================
    // FILTRO + BUSCA
    // =========================================
    const entradasFiltradas = useMemo(() => {

        let lista = [...entradas].sort(
            (a, b) => Number(b.id) - Number(a.id)
        );

        if (filtro === 'pendentes') {
            lista = lista.filter(e => e.status === 'CONFERENCIA');
        } else if (filtro === 'processadas') {
            lista = lista.filter(e => e.status === 'CONFIRMADA');
        } else if (filtro === 'novas') {
            lista = lista.filter(e => e.tipo === 'SEFAZ' && e.status === 'CONFERENCIA');
        } else if (filtro === 'importadas') {
            lista = lista.filter(e => e.tipo === 'XML' || e.tipo === 'MANUAL');
        } else if (filtro === 'erro') {
            lista = lista.filter(e => e.status === 'ERRO');
        }

        const termo = busca.trim().toLowerCase();

        if (termo) {
            lista = lista.filter(e =>
                (e.chave || '').toLowerCase().includes(termo) ||
                (e.fornecedor?.cnpj || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '')) ||
                (e.fornecedor?.razaoSocial || '').toLowerCase().includes(termo) ||
                String(e.numero || '').includes(termo)
            );
        }

        return lista;

    }, [entradas, filtro, busca]);

    // =========================================
    // IMPORTAR XML MANUAL
    // =========================================
    async function importarXML() {

        if (!arquivo) {
            setErro('Selecione um arquivo XML.');
            return;
        }

        if (!empresaId) {
            setErro('Empresa não informada.');
            return;
        }

        setLoading(true);
        setErro('');
        setMensagem('');

        try {

            const formData = new FormData();

            formData.append(
                'empresaId',
                String(empresaId)
            );

            formData.append(
                'xml',
                arquivo
            );

            const response = await fetch(
                `${API}/api/nfe-entradas/importar-xml`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            const data =
                await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Erro ao importar XML.'
                );
            }

            setMensagem(
                '✅ XML importado para conferência.'
            );

            setArquivo(null);

            await carregarEntradas();

            setEntradaSelecionada(
                data.entrada
            );

        } catch (error) {

            setErro(error.message);

        } finally {

            setLoading(false);

        }
    }

    // =========================================
    // ENTRADA MANUAL
    // =========================================
    function adicionarProdutoManual() {

        setProdutosManual([
            ...produtosManual,
            {
                codigo: '',
                descricao: '',
                ncm: '',
                cfop: '2102',
                unidade: 'UN',
                quantidade: 1,
                valorUnitario: 0,
                valorTotal: 0,
                cstCsosn: '',
                ipi: 0,
                pis: 0,
                cofins: 0
            }
        ]);
    }

    function atualizarProdutoManual(index, campo, valor) {

        const lista =
            [...produtosManual];

        lista[index] = {
            ...lista[index],
            [campo]: valor
        };

        if (
            campo === 'quantidade' ||
            campo === 'valorUnitario'
        ) {

            const quantidade =
                Number(
                    campo === 'quantidade'
                        ? valor
                        : lista[index].quantidade
                );

            const unitario =
                Number(
                    campo === 'valorUnitario'
                        ? valor
                        : lista[index].valorUnitario
                );

            lista[index].valorTotal =
                quantidade * unitario;
        }

        setProdutosManual(lista);
    }

    async function cadastrarManual() {

        if (!empresaId) {
            setErro('Empresa não informada.');
            return;
        }

        if (!fornecedor.razaoSocial.trim()) {
            setErro('Informe o fornecedor.');
            return;
        }

        if (!manual.numero.trim()) {
            setErro('Informe o número da NF-e.');
            return;
        }

        setLoading(true);
        setErro('');
        setMensagem('');

        try {

            const response =
                await fetch(
                    `${API}/api/nfe-entradas/manual`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body: JSON.stringify({
                            empresaId,
                            fornecedor,
                            numero: manual.numero,
                            serie: manual.serie,
                            chave: manual.chave,
                            dataEmissao:
                                manual.dataEmissao ||
                                new Date().toISOString(),
                            naturezaOperacao:
                                manual.naturezaOperacao,
                            observacao:
                                manual.observacao,
                            produtos:
                                produtosManual
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                    'Erro na entrada manual.'
                );
            }

            setMensagem(
                '✅ Entrada manual criada para conferência.'
            );

            await carregarEntradas();

            setEntradaSelecionada(
                data.entrada
            );

        } catch (error) {

            setErro(error.message);

        } finally {

            setLoading(false);

        }
    }

    // =========================================
    // CONFIRMAR ENTRADA (backend transacional)
    // O estoque é atualizado pelo BACKEND com
    // transação e rollback. O frontend apenas
    // envia os vínculos.
    // =========================================
    // =========================================
    // CONFIRMAR ENTRADA
    // =========================================
    async function confirmarEntrada(entrada) {

        setErro('');
        setMensagem('');

        if (!entrada?.id) {
            setErro('Entrada NF-e não informada.');
            return;
        }

        if (entrada.status === 'CONFIRMADA') {
            setErro('Esta NF-e já possui entrada de estoque.');
            return;
        }

        const produtos =
            Array.isArray(entrada.produtos)
                ? entrada.produtos
                : [];

        if (!produtos.length) {
            setErro('Esta NF-e não possui produtos para entrada.');
            return;
        }

        const confirmado = window.confirm(
            '⚠️ ESTA OPERAÇÃO IRÁ ALTERAR O ESTOQUE.\n\n' +
            `NF-e ${entrada.numero || '-'} - ` +
            `${entrada.fornecedor?.razaoSocial || 'fornecedor'}\n` +
            `${produtos.length} item(ns) receberão entrada de estoque.\n\n` +
            'Produtos não cadastrados serão criados automaticamente.\n\n' +
            'Confirma a entrada?'
        );

        if (!confirmado) {
            return;
        }

        const itens = produtos.map((produto, index) => {

            const elementoProduto =
                document.getElementById(
                    `produto-${entrada.id}-${index}`
                );

            const produtoSelecionadoId =
                elementoProduto?.value?.trim() || '';

            const produtoERP =
                produtosERP.find(
                    p =>
                        String(p?.id) ===
                        String(produtoSelecionadoId)
                ) || null;

            const elementoQuantidade =
                document.getElementById(
                    `quantidade-${entrada.id}-${index}`
                );

            const quantidade =
                Number(
                    elementoQuantidade?.value ??
                    produto.quantidade ??
                    0
                );

            return {
                itemNfe:
                    Number(
                        produto.item ??
                        index + 1
                    ),

                produtoId:
                    produtoERP?.id || null,

                codigo:
                    String(
                        produto.codigo ||
                        ''
                    ).trim(),

                sku:
                    String(
                        produtoERP?.sku ||
                        produto.codigo ||
                        ''
                    ).trim(),

                descricao:
                    String(
                        produto.descricao ||
                        ''
                    ).trim(),

                ean:
                    String(
                        produto.ean ||
                        ''
                    ).trim(),

                unidade:
                    String(
                        produto.unidade ||
                        'UN'
                    ).trim(),

                quantidade,

                valorUnitario:
                    Number(
                        produto.valorUnitario ||
                        0
                    )
            };
        });

        const invalidos =
            itens.filter(
                item =>
                    !Number.isFinite(item.quantidade) ||
                    item.quantidade <= 0
            );

        if (invalidos.length) {
            setErro(
                'Existe pelo menos um item com quantidade inválida.'
            );
            return;
        }

        console.log(
            '[NFE ENTRADA] Itens enviados ao backend:',
            itens
        );

        setLoading(true);

        try {

            const response =
                await fetch(
                    `${API}/api/nfe-entradas/${entrada.id}/confirmar`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body: JSON.stringify({
                            itens
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                    'Erro ao confirmar entrada.'
                );
            }

            const resumo =
                data.resumo || {};

            const sefaz =
                data.sefaz || {};

            let mensagemSefaz = '';

            if (sefaz.success) {

                mensagemSefaz =
                    '\n✅ CONFIRMAÇÃO DA OPERAÇÃO ACEITA PELA SEFAZ' +
                    `\ncStat: ${sefaz.cStat || '-'}` +
                    `\nProtocolo: ${sefaz.protocolo || '-'}`;

            } else if (sefaz.enviada) {

                mensagemSefaz =
                    '\n⚠️ ENTRADA REALIZADA, MAS A MANIFESTAÇÃO NÃO FOI ACEITA PELA SEFAZ' +
                    `\ncStat: ${sefaz.cStat || '-'}` +
                    `\nMotivo: ${sefaz.xMotivo || '-'}`;

            } else {

                mensagemSefaz =
                    '\n⚠️ ENTRADA REALIZADA NO ERP' +
                    '\nManifestação não enviada à SEFAZ' +
                    `\nMotivo: ${sefaz.xMotivo || '-'}`;
            }

            setMensagem(
                '✅ Entrada realizada com sucesso.' +
                `\nNF-e ${resumo.numero || entrada.numero || '-'}` +
                ` — ${resumo.fornecedor || entrada.fornecedor?.razaoSocial || ''}` +
                ` — ${resumo.quantidadeItens ?? itens.length} item(ns)` +
                ` — quantidade total ${resumo.quantidadeTotal ?? '-'}.` +
                mensagemSefaz
            );

            await carregarEntradas();
            await carregarProdutos();

            setEntradaSelecionada(
                data.entrada || null
            );

        } catch (error) {

            console.error(
                '[NFE ENTRADA] Erro:',
                error
            );

            setErro(
                error?.message ||
                'Erro ao confirmar entrada.'
            );

        } finally {

            setLoading(false);
        }
    }

    // =========================================
    // RENDER
    // =========================================
    return (
        <div className="space-y-6">

            <div className="flex gap-2 flex-wrap">

                <button
                    onClick={() => setAba('sefaz')}
                    className={
                        `px-4 py-2 rounded-lg ${
                            aba === 'sefaz'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300'
                        }`
                    }
                >
                    🌐 SEFAZ
                </button>

                <button
                    onClick={() => setAba('xml')}
                    className={
                        `px-4 py-2 rounded-lg ${
                            aba === 'xml'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300'
                        }`
                    }
                >
                    📄 Entrada por XML
                </button>

                <button
                    onClick={() => setAba('manual')}
                    className={
                        `px-4 py-2 rounded-lg ${
                            aba === 'manual'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300'
                        }`
                    }
                >
                    ✏️ Entrada Manual
                </button>

            </div>

            {mensagem && (
                <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300">
                    {mensagem}
                </div>
            )}

            {erro && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300">
                    ❌ {erro}
                </div>
            )}

            {/* =========================================
                ABA SEFAZ - DISTRIBUIÇÃO DF-e
            ========================================== */}
            {aba === 'sefaz' && (

                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 space-y-4">

                    <h2 className="text-lg font-semibold text-white">
                        🌐 Consultar SEFAZ (Distribuição DF-e)
                    </h2>

                    <p className="text-sm text-slate-400">
                        Consulta os documentos fiscais destinados ao CNPJ da empresa
                        usando o certificado A1 e o serviço oficial NFeDistribuicaoDFe.
                    </p>

                    <button
                        onClick={consultarSefaz}
                        disabled={
                            consultandoSefaz ||
                            !empresaId ||
                            tempoBloqueioSefaz > 0
                        }
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold"
                    >
                        {consultandoSefaz
                            ? '⏳ Consultando SEFAZ...'
                            : tempoBloqueioSefaz > 0
                                ? `⏱️ Aguardar ${Math.floor(tempoBloqueioSefaz / 60000)}:${String(Math.floor((tempoBloqueioSefaz % 60000) / 1000)).padStart(2, '0')}`
                                : '🌐 Consultar SEFAZ'}
                    </button>

                    {tempoBloqueioSefaz > 0 && (
                        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300">
                            <div className="font-bold">
                                🔴 CONSULTA À SEFAZ TEMPORARIAMENTE BLOQUEADA
                            </div>

                            <div className="text-sm mt-1">
                                cStat: 656 — Consumo Indevido
                            </div>

                            <div className="text-sm mt-1">
                                Aguarde 1 hora antes de realizar nova consulta.
                            </div>

                            <div className="text-lg font-bold mt-2">
                                ⏱️ {Math.floor(tempoBloqueioSefaz / 60000)}:
                                {String(
                                    Math.floor(
                                        (tempoBloqueioSefaz % 60000) / 1000
                                    )
                                ).padStart(2, '0')}
                            </div>
                        </div>
                    )}

                    {resultadoSefaz && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300 space-y-1">
                            <div><b className="text-white">cStat:</b> {resultadoSefaz.cStat || 'N/A'}</div>
                            <div><b className="text-white">xMotivo:</b> {resultadoSefaz.xMotivo || 'N/A'}</div>
                            <div><b className="text-white">ultNSU:</b> {resultadoSefaz.ultNSU || 'N/A'}</div>
                            <div><b className="text-white">maxNSU:</b> {resultadoSefaz.maxNSU || 'N/A'}</div>
                            <div><b className="text-white">Documentos recebidos:</b> {resultadoSefaz.quantidadeDocumentos ?? 0}</div>
                            <div><b className="text-white">Novas NF-e importadas:</b> {resultadoSefaz.novasEntradas ?? 0}</div>
                        </div>
                    )}

                </div>

            )}

            {aba === 'xml' && (

                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">

                    <h2 className="text-lg font-semibold text-white">
                        📥 Importar XML de NF-e
                    </h2>

                    <input
                        type="file"
                        accept=".xml,text/xml,application/xml"
                        className="mt-4 block w-full text-slate-300"
                        onChange={
                            e =>
                                setArquivo(
                                    e.target.files?.[0] ||
                                    null
                                )
                        }
                    />

                    <button
                        onClick={importarXML}
                        disabled={loading || !arquivo}
                        className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white"
                    >
                        {loading
                            ? '⏳ Processando...'
                            : '📥 Importar XML'}
                    </button>

                </div>
            )}

            {aba === 'manual' && (

                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 space-y-4">

                    <input
                        placeholder="Fornecedor"
                        value={fornecedor.razaoSocial}
                        onChange={
                            e =>
                                setFornecedor({
                                    ...fornecedor,
                                    razaoSocial:
                                        e.target.value
                                })
                        }
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />

                    <input
                        placeholder="CNPJ fornecedor"
                        value={fornecedor.cnpj}
                        onChange={
                            e =>
                                setFornecedor({
                                    ...fornecedor,
                                    cnpj:
                                        e.target.value
                                })
                        }
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />

                    <input
                        placeholder="Número NF-e"
                        value={manual.numero}
                        onChange={
                            e =>
                                setManual({
                                    ...manual,
                                    numero:
                                        e.target.value
                                })
                        }
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                    />

                    {produtosManual.map(
                        (produto, index) => (

                            <div
                                key={index}
                                className="grid grid-cols-1 md:grid-cols-4 gap-2"
                            >

                                <input
                                    placeholder="Código"
                                    value={produto.codigo}
                                    onChange={
                                        e =>
                                            atualizarProdutoManual(
                                                index,
                                                'codigo',
                                                e.target.value
                                            )
                                    }
                                    className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                                />

                                <input
                                    placeholder="Descrição"
                                    value={produto.descricao}
                                    onChange={
                                        e =>
                                            atualizarProdutoManual(
                                                index,
                                                'descricao',
                                                e.target.value
                                            )
                                    }
                                    className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                                />

                                <input
                                    type="number"
                                    placeholder="Quantidade"
                                    value={produto.quantidade}
                                    onChange={
                                        e =>
                                            atualizarProdutoManual(
                                                index,
                                                'quantidade',
                                                e.target.value
                                            )
                                    }
                                    className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                                />

                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Valor unitário"
                                    value={produto.valorUnitario}
                                    onChange={
                                        e =>
                                            atualizarProdutoManual(
                                                index,
                                                'valorUnitario',
                                                e.target.value
                                            )
                                    }
                                    className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-white"
                                />

                            </div>

                        )
                    )}

                    <button
                        onClick={adicionarProdutoManual}
                        className="px-3 py-2 rounded-lg bg-slate-700 text-white"
                    >
                        ➕ Produto
                    </button>

                    <button
                        onClick={cadastrarManual}
                        disabled={loading}
                        className="ml-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        ✅ Criar Entrada
                    </button>

                </div>
            )}

            {/* =========================================
                LISTA DE ENTRADAS + FILTROS
            ========================================== */}
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">

                <h2 className="text-lg font-semibold text-white mb-4">
                    📋 Entradas de NF-e
                </h2>

                <div className="flex flex-wrap gap-2 mb-4">

                    {[
                        ['todas', 'Todas'],
                        ['novas', 'Novas'],
                        ['importadas', 'Importadas'],
                        ['pendentes', 'Pendentes'],
                        ['processadas', 'Processadas'],
                        ['erro', 'Com erro']
                    ].map(([valor, rotulo]) => (

                        <button
                            key={valor}
                            onClick={() => setFiltro(valor)}
                            className={
                                `px-3 py-1 rounded-full text-sm ${
                                    filtro === valor
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-slate-300'
                                }`
                            }
                        >
                            {rotulo}
                        </button>

                    ))}

                </div>

                <input
                    placeholder="🔎 Buscar por chave, CNPJ, fornecedor ou número..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-white mb-4"
                />

                {entradasFiltradas.length === 0 ? (

                    <p className="text-slate-400">
                        Nenhuma entrada encontrada.
                    </p>

                ) : (

                    <div className="space-y-4">

                        {entradasFiltradas.map(
                            entrada => (

                                <div
                                    key={entrada.id}
                                    className="rounded-xl border border-slate-700 p-4"
                                >

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">

                                        <div>
                                            <span className="text-slate-500">
                                                NF-e
                                            </span>

                                            <div className="text-white">
                                                {entrada.numero}
                                                {entrada.serie && (
                                                    <span className="text-slate-500"> / série {entrada.serie}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">
                                                Fornecedor
                                            </span>

                                            <div className="text-white">
                                                {entrada.fornecedor?.razaoSocial}
                                                {entrada.fornecedor?.cnpj && (
                                                    <div className="text-slate-500 text-xs">
                                                        CNPJ {entrada.fornecedor.cnpj}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">
                                                Valor total
                                            </span>

                                            <div className="text-white">
                                                R$ {(entrada.totais?.nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">
                                                Status
                                            </span>

                                            <div className={
                                                entrada.status === 'CONFIRMADA'
                                                    ? 'text-emerald-400'
                                                    : 'text-yellow-400'
                                            }>
                                                {entrada.status}
                                                {entrada.tipo === 'SEFAZ' && entrada.nsu && (
                                                    <div className="text-slate-500 text-xs">
                                                        NSU {entrada.nsu}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    {entrada.chave && (
                                        <div className="mt-2 text-xs text-slate-500 break-all">
                                            Chave: {entrada.chave}
                                        </div>
                                    )}
                                    {entrada.manifestacao && (
                                        <div className={
                                            "mt-3 p-3 rounded-lg border " +
                                            (
                                                entrada.manifestacao.success
                                                    ? "bg-emerald-900/20 border-emerald-700/60"
                                                    : "bg-red-900/20 border-red-700/60"
                                            )
                                        }>
                                            <div className={
                                                "text-sm font-bold " +
                                                (
                                                    entrada.manifestacao.success
                                                        ? "text-emerald-300"
                                                        : "text-red-300"
                                                )
                                            }>
                                                {entrada.manifestacao.success
                                                    ? "✅ RETORNO DA SEFAZ"
                                                    : "❌ RETORNO DA SEFAZ"}
                                            </div>

                                            <div className="text-xs text-slate-300 mt-1">
                                                Evento:{" "}
                                                {entrada.manifestacao.descricao || "Manifestação"}
                                            </div>

                                            <div className="text-xs text-slate-300 mt-1">
                                                cStat:{" "}
                                                <span className="font-bold text-white">
                                                    {entrada.manifestacao.cStat || "N/A"}
                                                </span>
                                            </div>

                                            <div className="text-xs text-slate-300 mt-1">
                                                Mensagem SEFAZ:{" "}
                                                <span className="text-white">
                                                    {entrada.manifestacao.xMotivo || "Não informado"}
                                                </span>
                                            </div>

                                            {entrada.manifestacao.protocolo && (
                                                <div className="text-xs text-slate-300 mt-1">
                                                    Protocolo:{" "}
                                                    <span className="font-bold text-white">
                                                        {entrada.manifestacao.protocolo}
                                                    </span>
                                                </div>
                                            )}

                                            {entrada.manifestacao.dataHora && (
                                                <div className="text-xs text-slate-400 mt-1">
                                                    Data/hora:{" "}
                                                    {new Date(
                                                        entrada.manifestacao.dataHora
                                                    ).toLocaleString("pt-BR")}
                                                </div>
                                            )}
                                        </div>
                                    )}


                                    {/* Ações fiscais */}
                                    <div className="mt-3 flex flex-wrap gap-2">

                                        {entrada.chave && entrada.status !== 'CONFIRMADA' && (
                                            <>
                                                <button
                                                    onClick={() => manifestar(entrada, '210200')}
                                                    disabled={loading}
                                                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white"
                                                >
                                                    ✅ Confirmação da Operação
                                                </button>

                                                <button
                                                    onClick={() => manifestar(entrada, '210210')}
                                                    disabled={loading}
                                                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white"
                                                >
                                                    📨 Ciência da Operação
                                                </button>

                                                <button
                                                    onClick={() => manifestar(entrada, '210220')}
                                                    disabled={loading}
                                                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white"
                                                >
                                                    ❓ Desconhecimento
                                                </button>

                                                <button
                                                    onClick={() => manifestar(entrada, '210240')}
                                                    disabled={loading}
                                                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white"
                                                >
                                                    🚫 Operação não Realizada
                                                </button>
                                            </>
                                        )}

                                        <a
                                            href={`${API}/api/nfe-entradas/${entrada.id}/xml`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white"
                                        >
                                            📄 Baixar XML
                                        </a>

                                    </div>

                                    {entrada.status !== 'CONFIRMADA' && (

                                        <div className="mt-4 space-y-3">

                                            {(entrada.produtos || []).map(
                                                (produto, index) => (

                                                    <div
                                                        key={index}
                                                        className="grid grid-cols-1 md:grid-cols-3 gap-2"
                                                    >

                                                        <div className="text-sm text-white p-2 bg-slate-900 rounded-lg">
                                                            {produto.descricao}
                                                            <div className="text-xs text-slate-500">
                                                                {produto.quantidade} {produto.unidade} × R$ {Number(produto.valorUnitario).toFixed(2)}
                                                                {produto.ncm ? ` | NCM ${produto.ncm}` : ''}
                                                                {produto.cfop ? ` | CFOP ${produto.cfop}` : ''}
                                                            </div>
                                                        </div>

                                                        <select
                                                            id={
                                                                `produto-${entrada.id}-${index}`
                                                            }
                                                            defaultValue={localizarProdutoERP(produto)?.id || ''}
                                                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                                        >

                                                            <option value="">
                                                                Produto não cadastrado — selecione
                                                            </option>

                                                            {produtosERP.map(
                                                                produtoERP => (

                                                                    <option
                                                                        key={produtoERP.id}
                                                                        value={produtoERP.id}
                                                                    >
                                                                        {produtoERP.name}
                                                                        {' — '}
                                                                        {produtoERP.sku}
                                                                    </option>

                                                                )
                                                            )}

                                                        </select>

                                                        <input
                                                            id={
                                                                `quantidade-${entrada.id}-${index}`
                                                            }
                                                            type="number"
                                                            step="0.001"
                                                            defaultValue={
                                                                produto.quantidade
                                                            }
                                                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                                        />

                                                    </div>

                                                )
                                            )}

                                            <div className="p-3 rounded-lg bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-sm">
                                                ⚠️ Esta operação irá alterar o estoque.
                                            </div>

                                            <button
                                                onClick={
                                                    () =>
                                                        confirmarEntrada(
                                                            entrada
                                                        )
                                                }
                                                disabled={loading}
                                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-semibold"
                                            >
                                                ✅ CONFIRMAR ENTRADA
                                            </button>

                                        </div>
                                    )}

                                </div>

                            )
                        )}

                    </div>

                )}

            </div>

        </div>
    );
}




export default NfeEntradaPanel;