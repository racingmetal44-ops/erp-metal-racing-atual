import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const API = 'http://127.0.0.1:3001';

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
        naturezaOperacao: 'COMPRA',
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
            valorTotal: 0
        }
    ]);

    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

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

        setProdutosERP(data || []);
    }

    useEffect(() => {

        carregarEntradas().catch(console.error);
        carregarProdutos().catch(console.error);

    }, []);

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
                valorTotal: 0
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

    async function confirmarEntrada(entrada) {

        setErro('');
        setMensagem('');

        const itens =
            entrada.produtos.map(
                (produto, index) => {

                    const vinculo =
                        document.getElementById(
                            `produto-${entrada.id}-${index}`
                        )?.value;

                    const produtoERP =
                        produtosERP.find(
                            p =>
                                String(p.id) ===
                                String(vinculo)
                        );

                    return {
                        itemNfe:
                            produto.item,

                        produtoId:
                            produtoERP?.id ||
                            null,

                        sku:
                            produtoERP?.sku ||
                            '',

                        quantidade:
                            Number(
                                document.getElementById(
                                    `quantidade-${entrada.id}-${index}`
                                )?.value ||
                                produto.quantidade
                            ),

                        valorUnitario:
                            Number(
                                produto.valorUnitario
                            )
                    };
                }
            );

        if (
            itens.some(
                item => !item.produtoId
            )
        ) {
            setErro(
                'Vincule todos os produtos da NF-e ao cadastro do ERP.'
            );
            return;
        }

        setLoading(true);

        try {

            // 1. Atualiza o estoque no Supabase
            for (const item of itens) {

                const {
                    data: produto,
                    error: erroProduto
                } = await supabase
                    .from('products')
                    .select(
                        'id,name,sku,current_stock,estoque_atual'
                    )
                    .eq('id', item.produtoId)
                    .single();

                if (erroProduto) {
                    throw erroProduto;
                }

                const atual =
                    Number(
                        produto.current_stock ?? 0
                    );

                const atualLegado =
                    Number(
                        produto.estoque_atual ?? atual
                    );

                const novaQuantidade =
                    atual + item.quantidade;

                const novaQuantidadeLegado =
                    atualLegado + item.quantidade;

                const { error: erroUpdate } =
                    await supabase
                        .from('products')
                        .update({
                            current_stock:
                                novaQuantidade,
                            estoque_atual:
                                novaQuantidadeLegado
                        })
                        .eq(
                            'id',
                            item.produtoId
                        );

                if (erroUpdate) {
                    throw erroUpdate;
                }

                await supabase
                    .from('bipagem_history')
                    .insert({
                        product_id:
                            item.produtoId,

                        product_name:
                            produto.name,

                        product_sku:
                            produto.sku,

                        tipo:
                            'entrada_nf',

                        quantidade:
                            item.quantidade,

                        quantidade_anterior:
                            atual,

                        quantidade_nova:
                            novaQuantidade,

                        usuario_id:
                            null,

                        usuario_nome:
                            'Entrada NF-e',

                        created_at:
                            new Date().toISOString()
                    });
            }

            // 2. Confirma a entrada no backend
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

            setMensagem(
                '✅ Entrada confirmada e estoque atualizado.'
            );

            await carregarEntradas();

            setEntradaSelecionada(
                data.entrada
            );

        } catch (error) {

            console.error(error);

            setErro(
                error.message
            );

        } finally {

            setLoading(false);

        }
    }

    return (
        <div className="space-y-6">

            <div className="flex gap-2">

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

            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">

                <h2 className="text-lg font-semibold text-white mb-4">
                    📋 Entradas em conferência
                </h2>

                {entradas.length === 0 ? (

                    <p className="text-slate-400">
                        Nenhuma entrada pendente.
                    </p>

                ) : (

                    <div className="space-y-4">

                        {entradas.map(
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
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">
                                                Fornecedor
                                            </span>

                                            <div className="text-white">
                                                {entrada.fornecedor?.razaoSocial}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">
                                                Tipo
                                            </span>

                                            <div className="text-white">
                                                {entrada.tipo}
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
                                            </div>
                                        </div>

                                    </div>

                                    {entrada.status !== 'CONFIRMADA' && (

                                        <div className="mt-4 space-y-3">

                                            {entrada.produtos.map(
                                                (produto, index) => (

                                                    <div
                                                        key={index}
                                                        className="grid grid-cols-1 md:grid-cols-3 gap-2"
                                                    >

                                                        <div className="text-sm text-white p-2 bg-slate-900 rounded-lg">
                                                            {produto.descricao}
                                                        </div>

                                                        <select
                                                            id={
                                                                `produto-${entrada.id}-${index}`
                                                            }
                                                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                                        >

                                                            <option value="">
                                                                Selecionar produto do ERP
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
                                                ✅ CONFIRMAR ENTRADA E ATUALIZAR ESTOQUE
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
