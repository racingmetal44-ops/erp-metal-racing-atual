import { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Minus,
  AlertTriangle,
  Package,
  Search,
  X,
  History,
  TrendingUp,
  TrendingDown,
  User,
  Users,
  CheckCircle,
  LogIn
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BipagemPage() {
  const [codigo, setCodigo] = useState('');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState({ entradas: 0, saidas: 0, nao_encontrados: 0, total: 0 });
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [showUsuarios, setShowUsuarios] = useState(false);
  const inputRef = useRef(null);
  const [bipeStatus, setBipeStatus] = useState(null);
  const [bipeTimeout, setBipeTimeout] = useState(null);

  // Carregar usuários e histórico
  useEffect(() => {
    loadUsuarios();
    loadHistory();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function loadUsuarios() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('nome_completo', { ascending: true });

    if (data) {
      setUsuarios(data);
      // Selecionar o primeiro usuário automaticamente
      if (data.length > 0 && !usuarioSelecionado) {
        setUsuarioSelecionado(data[0]);
      }
    }
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('bipagem_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setHistory(data);
      calcularStats(data);
    }
  }

  function calcularStats(historico) {
    const entradas = historico.filter(h => h.tipo === 'entrada').length;
    const saidas = historico.filter(h => h.tipo === 'saida').length;
    const nao_encontrados = historico.filter(h => h.tipo === 'nao_encontrado').length;
    setStats({ entradas, saidas, nao_encontrados, total: historico.length });
  }

  function handleCodigoChange(e) {
    const value = e.target.value;
    setCodigo(value);
    
    if (bipeTimeout) {
      clearTimeout(bipeTimeout);
      setBipeTimeout(null);
    }
    
    if (value.length >= 2) {
      const timeout = setTimeout(() => {
        buscarProduto(value);
      }, 300);
      setBipeTimeout(timeout);
    }
  }

  async function buscarProduto(codigo) {
    if (!codigo || codigo.trim() === '') {
      setMessage('Digite ou leia um código de barras');
      setMessageType('info');
      return;
    }

    setLoading(true);
    setProduct(null);
    setMessage('');
    setBipeStatus(null);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`barcode.eq.${codigo},sku.eq.${codigo}`)
        .single();

      setLoading(false);

      if (error || !data) {
        setBipeStatus('nao_encontrado');
        setProduct(null);
        setMessage(`Produto "${codigo}" não encontrado!`);
        setMessageType('info');
        
        await registrarBipagemNaoEncontrada(codigo);
        
        setTimeout(() => {
          setBipeStatus(null);
          setMessage('');
          setCodigo('');
          if (inputRef.current) inputRef.current.focus();
        }, 2500);
        return;
      }

      const { data: files } = await supabase
        .from('product_files')
        .select('*')
        .eq('product_id', data.id)
        .order('sort_order', { ascending: true });

      const produtoCompleto = { ...data, images: files || [] };
      setProduct(produtoCompleto);
      setMessage(`Produto encontrado: ${data.name}`);
      setMessageType('success');
      setCodigo('');

    } catch (error) {
      setLoading(false);
      setBipeStatus('nao_encontrado');
      setMessage(`Erro: ${error.message}`);
      setMessageType('error');
    }
  }

  async function registrarBipagemNaoEncontrada(codigo) {
    try {
      const { error: historyError } = await supabase
        .from('bipagem_history')
        .insert({
          product_id: null,
          product_name: 'Produto não encontrado',
          product_sku: codigo,
          tipo: 'nao_encontrado',
          quantidade: 0,
          quantidade_anterior: 0,
          quantidade_nova: 0,
          usuario_id: usuarioSelecionado?.id || null,
          usuario_nome: usuarioSelecionado?.nome_completo || 'Sistema',
          created_at: new Date().toISOString()
        });
      if (historyError) throw historyError;
      await loadHistory();
    } catch (error) {
      console.error('Erro ao registrar:', error);
    }
  }

  async function confirmarBipe(tipo) {
    if (!product) {
      setMessage('Nenhum produto bipado!');
      setMessageType('info');
      return;
    }

    if (!usuarioSelecionado) {
      setMessage('Selecione um usuário antes de bipar!');
      setMessageType('error');
      return;
    }

    const quantidadeAtual = Number(product.current_stock ?? product.estoque_atual ?? 0);
    let novaQuantidade = quantidadeAtual;

    if (tipo === 'entrada') {
      novaQuantidade = quantidadeAtual + 1;
    } else {
      if (quantidadeAtual <= 0) {
        setMessage('Produto com quantidade zero! Não pode remover.');
        setMessageType('error');
        return;
      }
      novaQuantidade = quantidadeAtual - 1;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
        current_stock: novaQuantidade,
        estoque_atual: novaQuantidade
      })
        .eq('id', product.id);

      if (error) throw error;

      const { error: historyError } = await supabase
        .from('bipagem_history')
        .insert({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          tipo: tipo,
          quantidade: 1,
          quantidade_anterior: quantidadeAtual,
          quantidade_nova: novaQuantidade,
          usuario_id: usuarioSelecionado.id,
          usuario_nome: usuarioSelecionado.nome_completo,
          created_at: new Date().toISOString()
        });
      if (historyError) throw historyError;

      if (tipo === 'entrada') {
        setBipeStatus('entrada');
        setMessage(`?? ${usuarioSelecionado.nome_completo} - ENTRADA: ${product.name} +1 (${quantidadeAtual} ? ${novaQuantidade})`);
        setMessageType('success');
      } else {
        setBipeStatus('saida');
        setMessage(`?? ${usuarioSelecionado.nome_completo} - SAÍDA: ${product.name} -1 (${quantidadeAtual} ? ${novaQuantidade})`);
        setMessageType('error');
      }

      setProduct({ ...product, estoque_atual: novaQuantidade });
      await loadHistory();

      setTimeout(() => {
        setProduct(null);
        setMessage('');
        setMessageType(null);
        setBipeStatus(null);
        if (inputRef.current) inputRef.current.focus();
      }, 2500);

    } catch (error) {
      setMessage(`? Erro ao atualizar: ${error.message}`);
      setMessageType('error');
    }
  }

  function limparBusca() {
    setProduct(null);
    setMessage('');
    setMessageType(null);
    setBipeStatus(null);
    setCodigo('');
    if (inputRef.current) inputRef.current.focus();
  }

  function formatarData(data) {
    const d = new Date(data);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getBipeBgColor() {
    switch (bipeStatus) {
      case 'entrada': return 'border-emerald-500/50 bg-emerald-500/10';
      case 'saida': return 'border-rose-500/50 bg-rose-500/10';
      case 'nao_encontrado': return 'border-blue-500/50 bg-blue-500/10';
      default: return 'border-slate-800 bg-slate-900';
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold">?? Bipagem</h1>
        <p className="mt-2 text-sm text-slate-400">Leitura de código de barras para entrada e saéda de produtos.</p>
      </div>

      {/* USUéRIO ATIVO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Operador atual</p>
              <p className="text-lg font-semibold text-white">
                {usuarioSelecionado?.nome_completo || 'Nenhum usuário selecionado'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUsuarios(!showUsuarios)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <Users size={16} />
            {showUsuarios ? 'Ocultar' : 'Trocar usuário'}
          </button>
        </div>

        {/* LISTA DE USUéRIOS */}
        {showUsuarios && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            {usuarios.map((usuario) => (
              <button
                key={usuario.id}
                onClick={() => {
                  setUsuarioSelecionado(usuario);
                  setShowUsuarios(false);
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border transition ${
                  usuarioSelecionado?.id === usuario.id
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-slate-700 hover:border-slate-500 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {usuarioSelecionado?.id === usuario.id && (
                  <CheckCircle size={16} className="text-orange-400" />
                )}
                <span className="text-sm">{usuario.nome_completo}</span>
                <span className="text-xs text-slate-500">{usuario.cargo}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400"><TrendingUp size={18} /><span className="text-sm">Entradas</span></div>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.entradas}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 text-rose-400"><TrendingDown size={18} /><span className="text-sm">Saídas</span></div>
          <p className="mt-1 text-2xl font-bold text-rose-400">{stats.saidas}</p>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 text-blue-400"><AlertTriangle size={18} /><span className="text-sm">Não Encontrados</span></div>
          <p className="mt-1 text-2xl font-bold text-blue-400">{stats.nao_encontrados}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-slate-400"><Package size={18} /><span className="text-sm">Total de Bipagens</span></div>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
        </div>
      </div>

      {/* LEITOR */}
      <div className={`rounded-2xl border-2 p-6 transition-all duration-300 ${getBipeBgColor()}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {bipeStatus === 'entrada' ? '?? ENTRADA' :
             bipeStatus === 'saida' ? '?? SAÍDA' :
             bipeStatus === 'nao_encontrado' ? '?? NºO ENCONTRADO' :
             '?? Leitor de Código'}
          </h2>
          <button onClick={limparBusca} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              className={`w-full rounded-xl border-2 bg-slate-950 px-12 py-4 text-lg font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all duration-300 ${
                bipeStatus === 'entrada' ? 'border-emerald-500 focus:border-emerald-400' :
                bipeStatus === 'saida' ? 'border-rose-500 focus:border-rose-400' :
                bipeStatus === 'nao_encontrado' ? 'border-blue-500 focus:border-blue-400' :
                'border-slate-700 focus:border-orange-500'
              }`}
              placeholder="Digite ou leia o código de barras..."
              value={codigo}
              onChange={handleCodigoChange}
              autoFocus
            />
          </div>
          <button onClick={() => buscarProduto(codigo)} className="px-6 py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition flex items-center gap-2">
            <Search size={18} /> Buscar
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">?? A busca é feita automaticamente apés digitar o código</p>

        {/* PRODUTO ENCONTRADO */}
        {product && (
          <div className={`mt-4 rounded-xl border p-4 transition-all duration-300 ${
            bipeStatus === 'entrada' ? 'border-emerald-500/50 bg-emerald-500/10' :
            bipeStatus === 'saida' ? 'border-rose-500/50 bg-rose-500/10' :
            'border-slate-700 bg-slate-950/70'
          }`}>
            <div className="flex items-center gap-4">
              {product.images && product.images.length > 0 ? (
                <img src={product.images[0].file_url} alt={product.name} className="w-20 h-20 rounded-xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center"><Package size={32} className="text-slate-500" /></div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                <p className="text-sm text-slate-400">SKU: {product.sku}</p>
                <div className="mt-1 flex items-center gap-4">
                  <span className="text-sm text-slate-400">Quantidade atual:</span>
                  <span className={`text-xl font-bold ${
                    (product.estoque_atual ?? 0) < (product.estoque_minimo ?? 0) ? 'text-rose-400' :
                    (product.estoque_atual ?? 0) > (product.estoque_maximo ?? 99999) ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {product.estoque_atual ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">(Mén: {product.estoque_minimo ?? 0} | Méx: {product.estoque_maximo ?? 0})</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={() => confirmarBipe('entrada')} className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition shadow-lg ${
                bipeStatus === 'entrada' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-emerald-500/70 hover:bg-emerald-600 shadow-emerald-500/20'
              }`}>
                <Plus size={18} /> ?? Adicionar (+1)
              </button>
              <button onClick={() => confirmarBipe('saida')} disabled={(product.estoque_atual ?? 0) <= 0} className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition shadow-lg ${
                bipeStatus === 'saida' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30' : 'bg-rose-500/70 hover:bg-rose-600 shadow-rose-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Minus size={18} /> ?? Remover (-1)
              </button>
            </div>
          </div>
        )}

        {bipeStatus === 'nao_encontrado' && !product && (
          <div className="mt-4 rounded-xl border-2 border-blue-500/50 bg-blue-500/10 p-4 text-center transition-all duration-300">
            <AlertTriangle size={24} className="inline mr-2 text-blue-400" />
            <span className="text-blue-400 font-bold">?? Produto não encontrado!</span>
            <p className="text-blue-300/70 text-sm mt-1">Verifique o código digitado</p>
          </div>
        )}
      </div>

      {/* HISTéRICO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><History size={20} /> Histórico de Bipagens</h2>
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-slate-400 hover:text-white transition">
            {showHistory ? 'Ocultar' : 'Ver histórico'}
          </button>
        </div>

        {showHistory && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma bipagem registrada.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${
                  item.tipo === 'entrada' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  item.tipo === 'saida' ? 'border-rose-500/30 bg-rose-500/5' :
                  'border-blue-500/30 bg-blue-500/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.tipo === 'entrada' ? 'bg-emerald-400' : item.tipo === 'saida' ? 'bg-rose-400' : 'bg-blue-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{item.product_name || 'Produto não encontrado'}</p>
                      <p className="text-xs text-slate-400">
                        {item.tipo === 'entrada' ? '?? Entrada' : item.tipo === 'saida' ? '?? Saída' : '?? Não encontrado'}
                        {item.quantidade_anterior !== undefined && ` | ${item.quantidade_anterior} ? ${item.quantidade_nova}`}
                      </p>
                      {item.usuario_nome && (
                        <p className="text-xs text-orange-400">?? {item.usuario_nome}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{formatarData(item.created_at)}</p>
                    {item.product_sku && <p className="text-xs text-slate-500">SKU: {item.product_sku}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* TOAST */}
      {message && (
        <div className={`fixed bottom-4 right-4 z-[9999] px-6 py-4 rounded-xl shadow-2xl border ${
          message.includes('??') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
          message.includes('??') ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' :
          message.includes('??') ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' :
          message.includes('?') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
          'border-rose-500/30 bg-rose-500/10 text-rose-400'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}

