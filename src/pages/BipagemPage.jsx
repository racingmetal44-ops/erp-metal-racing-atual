import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function BipagemPage() {
  const [codigo, setCodigo] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [tipo, setTipo] = useState('entrada');
  const [destino, setDestino] = useState('');
  const [operador, setOperador] = useState('');
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [ultimasBipagens, setUltimasBipagens] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    entradas: 0,
    saidas: 0,
    operadores: 0
  });

  useEffect(() => {
    carregarUsuarios();
    carregarUltimasBipagens();
  }, []);

  const carregarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      let listaOperadores = [];

      if (profiles && profiles.length > 0) {
        profiles.forEach(profile => {
          const nome = profile.full_name || profile.email || 'Usuário';
          listaOperadores.push({
            id: profile.user_id || profile.id,
            nome: nome,
            email: profile.email || '',
            role: profile.role_profile || 'user',
            funcao: profile.role_profile || 'Operador'
          });
        });
      }

      if (listaOperadores.length === 0) {
        const { data: users, error: usersError } = await supabase
          .from('auth.users')
          .select('id, email, raw_user_meta_data');

        if (usersError) throw usersError;

        if (users && users.length > 0) {
          users.forEach(user => {
            const nome = user.raw_user_meta_data?.full_name || user.email || 'Usuário';
            listaOperadores.push({
              id: user.id,
              nome: nome,
              email: user.email,
              role: 'user',
              funcao: 'Usuário'
            });
          });
        }
      }

      setOperadores(listaOperadores);

      if (listaOperadores.length > 0) {
        setOperador(listaOperadores[0].id);
      } else {
        setOperadores([
          { id: 'lucas', nome: 'Lucas - Auxiliar de Produção', funcao: 'expedicao' },
          { id: 'piscia', nome: 'Piscia - Operadora Montagem', funcao: 'operadora' },
          { id: 'renan', nome: 'Renan - Supervisor Expedição', funcao: 'supervisor' },
          { id: 'giovana', nome: 'Giovana - Qualidade Acabamento', funcao: 'qualidade' }
        ]);
        setOperador('lucas');
      }

    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const carregarUltimasBipagens = async () => {
    try {
      const { data, error } = await supabase
        .from('bipagens')
        .select('*')
        .order('data_hora', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUltimasBipagens(data || []);

      const total = data?.length || 0;
      const entradas = data?.filter(b => b.tipo === 'entrada').length || 0;
      const saidas = data?.filter(b => b.tipo === 'saida').length || 0;
      const operadoresUnicos = new Set(data?.map(b => b.operador).filter(Boolean)).size || 0;

      setStats({ total, entradas, saidas, operadores: operadoresUnicos });

    } catch (error) {
      console.error('❌ Erro ao carregar bipagens:', error);
    }
  };

  // ==========================================
  // BUSCAR PRODUTO PELO CÓDIGO
  // ==========================================
  const buscarProduto = async (codigoBuscado) => {
    try {
      console.log('🔍 Buscando produto:', codigoBuscado);
      
      // Buscar por SKU
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('sku', codigoBuscado)
        .maybeSingle();

      if (data) {
        console.log('✅ Produto encontrado por SKU:', data);
        return data;
      }

      // Buscar por código de barras
      const { data: barcodeData, error: barcodeError } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', codigoBuscado)
        .maybeSingle();

      if (barcodeData) {
        console.log('✅ Produto encontrado por código de barras:', barcodeData);
        return barcodeData;
      }

      // Buscar por nome (parcial)
      const { data: nameData, error: nameError } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${codigoBuscado}%`)
        .limit(1)
        .maybeSingle();

      if (nameData) {
        console.log('✅ Produto encontrado por nome:', nameData);
        return nameData;
      }

      console.log('❌ Produto não encontrado:', codigoBuscado);
      return null;

    } catch (error) {
      console.error('❌ Erro ao buscar produto:', error);
      return null;
    }
  };

  // ==========================================
  // ATUALIZAR ESTOQUE DO PRODUTO
  // ==========================================
  const atualizarEstoque = async (produtoId, novaQuantidade) => {
    try {
      console.log('📦 Atualizando estoque:', { produtoId, novaQuantidade });
      
      const { data, error } = await supabase
        .from('products')
        .update({ current_stock: novaQuantidade })
        .eq('id', produtoId)
        .select();

      if (error) {
        console.error('❌ Erro ao atualizar estoque:', error);
        throw error;
      }

      console.log('✅ Estoque atualizado:', data);
      return data;

    } catch (error) {
      console.error('❌ Erro ao atualizar estoque:', error);
      throw error;
    }
  };

  // ==========================================
  // REGISTRAR BIPAGEM (VERSÃO SIMPLIFICADA)
  // ==========================================
  const handleBipar = async () => {
    console.log('🚀 INICIANDO BIPAGEM...');
    
    if (!codigo.trim()) {
      setMensagem('❌ Digite ou escaneie o código!');
      return;
    }

    if (!operador) {
      setMensagem('❌ Selecione um operador!');
      return;
    }

    setLoading(true);
    setMensagem('⏳ Buscando produto...');

    try {
      // 1. BUSCAR O PRODUTO
      const produto = await buscarProduto(codigo.trim());
      
      if (!produto) {
        setMensagem(`❌ Produto não encontrado: "${codigo.trim()}"`);
        setLoading(false);
        return;
      }

      const operadorSelecionado = operadores.find(op => op.id === operador);
      const nomeOperador = operadorSelecionado?.nome || operador;

      // 2. CALCULAR NOVA QUANTIDADE
      const estoqueAtual = produto.current_stock || 0;
      let novaQuantidade = estoqueAtual;

      if (tipo === 'entrada') {
        novaQuantidade = estoqueAtual + quantidade;
      } else if (tipo === 'saida') {
        if (estoqueAtual < quantidade) {
          setMensagem(`❌ Estoque insuficiente! Disponível: ${estoqueAtual}, Solicitado: ${quantidade}`);
          setLoading(false);
          return;
        }
        novaQuantidade = estoqueAtual - quantidade;
      }

      console.log(`📊 Estoque: ${estoqueAtual} → ${novaQuantidade}`);

      // 3. ATUALIZAR ESTOQUE
      await atualizarEstoque(produto.id, novaQuantidade);

      // 4. REGISTRAR A BIPAGEM (SEM COLUNAS EXTRAS)
      const dados = {
        codigo: codigo.trim(),
        quantidade: quantidade,
        tipo: tipo,
        destino: destino || 'Estoque Geral',
        operador: nomeOperador,
        usuario_id: operador,
        data_hora: new Date().toISOString()
      };

      console.log('📦 Registrando bipagem:', dados);

      const { data, error } = await supabase
        .from('bipagens')
        .insert([dados])
        .select();

      if (error) {
        console.error('❌ Erro ao registrar bipagem:', error);
        setMensagem(`❌ Erro ao registrar: ${error.message}`);
        return;
      }

      console.log('✅ Bipagem registrada:', data);

      setMensagem(`✅ ${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada! ${produto.name} (${quantidade}x) → Estoque: ${novaQuantidade}`);
      setCodigo('');
      setQuantidade(1);
      setDestino('');
      
      await carregarUltimasBipagens();
      document.getElementById('codigoInput')?.focus();

    } catch (error) {
      console.error('❌ Erro geral:', error);
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBipar();
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f2f5' }}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">📡 Bipagem</h2>
              
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {operadores.find(op => op.id === operador)?.nome?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Operador atual</p>
                    <select
                      value={operador}
                      onChange={(e) => setOperador(e.target.value)}
                      className="w-full font-bold text-lg text-gray-800 bg-transparent border-2 border-blue-200 rounded-lg px-3 py-1 focus:border-blue-500 focus:outline-none"
                      disabled={loadingUsuarios}
                    >
                      {loadingUsuarios ? (
                        <option value="">Carregando usuários...</option>
                      ) : operadores.length === 0 ? (
                        <option value="">Nenhum usuário encontrado</option>
                      ) : (
                        operadores.map(op => (
                          <option key={op.id} value={op.id}>
                            {op.nome} {op.funcao ? `(${op.funcao})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">
                      {operadores.length} usuários
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de bipagem
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTipo('entrada')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                        tipo === 'entrada'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      📥 Entrada (+ estoque)
                    </button>
                    <button
                      onClick={() => setTipo('saida')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                        tipo === 'saida'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      📤 Saída (- estoque)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código (SKU / Código de barras / Nome)
                  </label>
                  <input
                    id="codigoInput"
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite SKU, código de barras ou nome do produto"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={quantidade}
                      onChange={(e) => setQuantidade(Number(e.target.value))}
                      min="1"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destino/Origem
                    </label>
                    <input
                      type="text"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      placeholder="Ex: Estoque A1"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleBipar}
                  disabled={loading || loadingUsuarios}
                  className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? '⏳ Processando...' : '✅ Registrar bipagem agora'}
                </button>

                {mensagem && (
                  <div className={`p-4 rounded-lg ${
                    mensagem.includes('✅') ? 'bg-green-100 text-green-700' : 
                    mensagem.includes('⚠️') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {mensagem}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-700 mb-4">📊 Resumo da sessão</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bipagens</span>
                  <span className="font-bold text-2xl text-blue-600">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Entradas</span>
                  <span className="font-bold text-green-600">{stats.entradas}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Saídas</span>
                  <span className="font-bold text-red-600">{stats.saidas}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Operadores</span>
                  <span className="font-bold text-purple-600">{stats.operadores}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-700 mb-4">🔄 Atividade recente</h3>
              {ultimasBipagens.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Nenhuma bipagem registrada</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {ultimasBipagens.map((bip, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          bip.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {bip.tipo === 'entrada' ? '📥' : '📤'}
                        </span>
                        <span className="font-mono text-sm">{bip.codigo}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-600">{bip.operador || 'Sem operador'}</span>
                        <span className="text-gray-400">×{bip.quantidade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}