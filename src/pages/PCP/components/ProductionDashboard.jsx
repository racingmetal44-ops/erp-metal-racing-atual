import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Clock, AlertTriangle, CheckCircle, Package, User, Truck, Image as ImageIcon, Plus, Search, Filter, X, Save, Edit2, Trash2 } from 'lucide-react';

export default function ProductionDashboard() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [horarioCorte, setHorarioCorte] = useState('14:00');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(null);

  const [form, setForm] = useState({
    sku: '',
    nome_produto: '',
    quantidade: 1,
    plataforma: 'Shopee',
    status: 'pendente',
    foto_url: '',
    recebido_por: '',
    trouxe_expedicao: '',
    levou_coleta: ''
  });

  const plataformas = ['Shopee', 'Mercado Livre', 'Bling', 'Loja Fésica', 'WhatsApp'];

  useEffect(() => {
    loadPedidos();
    loadHorarioCorte();
  }, []);

  async function loadPedidos() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quadro_producao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHorarioCorte() {
    try {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'horario_corte')
        .single();

      if (data) setHorarioCorte(data.valor);
    } catch (error) {
      console.log('Horário padrão: 14:00');
    }
  }

  async function salvarHorarioCorte() {
    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          chave: 'horario_corte',
          valor: horarioCorte
        });

      if (error) throw error;
      setMessage('? Horário de corte salvo!');
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`? Erro: ${error.message}`);
      setMessageType('error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    try {
      if (editing) {
        const { error } = await supabase
          .from('quadro_producao')
          .update(form)
          .eq('id', editing);

        if (error) throw error;
        setMessage('? Pedido atualizado!');
      } else {
        const { error } = await supabase
          .from('quadro_producao')
          .insert(form);

        if (error) throw error;
        setMessage('? Pedido criado!');
      }

      setMessageType('success');
      setShowModal(false);
      resetForm();
      loadPedidos();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`? Erro: ${error.message}`);
      setMessageType('error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;

    try {
      const { error } = await supabase
        .from('quadro_producao')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage('??? Pedido removido!');
      loadPedidos();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`? Erro: ${error.message}`);
    }
  }

  function resetForm() {
    setForm({
      sku: '',
      nome_produto: '',
      quantidade: 1,
      plataforma: 'Shopee',
      status: 'pendente',
      foto_url: '',
      recebido_por: '',
      trouxe_expedicao: '',
      levou_coleta: ''
    });
    setEditing(null);
  }

  function handleEdit(pedido) {
    setEditing(pedido.id);
    setForm({
      sku: pedido.sku || '',
      nome_produto: pedido.nome_produto || '',
      quantidade: pedido.quantidade || 1,
      plataforma: pedido.plataforma || 'Shopee',
      status: pedido.status || 'pendente',
      foto_url: pedido.foto_url || '',
      recebido_por: pedido.recebido_por || '',
      trouxe_expedicao: pedido.trouxe_expedicao || '',
      levou_coleta: pedido.levou_coleta || ''
    });
    setShowModal(true);
  }

  function getStatusConfig(status) {
    const configs = {
      pendente: { label: '? Pendente', cor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      produzido: { label: '? Produzido', cor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      atrasado: { label: '?? Atrasado', cor: 'bg-rose-500/20 text-rose-400 border-rose-500/30' }
    };
    return configs[status] || configs.pendente;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'produzido': return CheckCircle;
      case 'atrasado': return AlertTriangle;
      default: return Clock;
    }
  }

  const filteredPedidos = quadro_producao.filter(p => {
    const matchSearch = p.nome_produto?.toLowerCase().includes(search.toLowerCase()) ||
                        p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'todos' || p.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold">?? Quadro de Produção</h1>
        <p className="mt-2 text-sm text-slate-400">
          Pedidos novos de Shopee, Mercado Livre e Bling, com a foto do produto puxada pelo SKU do estoque.
        </p>
      </div>

      {/* HORéRIO DE CORTE */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center gap-2 text-amber-400 mb-2">
          <Clock size={18} />
          <span className="font-semibold">Horário de corte</span>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Pedidos que passarem desse horário sem serem marcados como produzidos entram como "Atrasado".
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="time"
            value={horarioCorte}
            onChange={(e) => setHorarioCorte(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={salvarHorarioCorte}
            className="bg-orange-500 px-6 py-3 rounded-xl text-white font-semibold hover:bg-orange-600 transition flex items-center gap-2"
          >
            <Save size={18} />
            Salvar horário
          </button>
          <span className="text-sm text-slate-400">Atual: {horarioCorte}</span>
        </div>
      </div>

      {/* BOTéO NOVO PEDIDO E FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-orange-500 px-6 py-3 rounded-xl text-white font-semibold hover:bg-orange-600 transition flex items-center gap-2"
        >
          <Plus size={18} />
          Novo Pedido
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por SKU ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
          >
            <option value="todos">?? Todos</option>
            <option value="pendente">? Pendentes</option>
            <option value="produzido">? Produzidos</option>
            <option value="atrasado">?? Atrasados</option>
          </select>
        </div>
      </div>

      {/* MENSAGEM */}
      {message && (
        <div className={`p-4 rounded-xl border ${
          messageType === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
          messageType === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' :
          'border-blue-500/30 bg-blue-500/10 text-blue-400'
        }`}>
          {message}
        </div>
      )}

      {/* LISTA DE PEDIDOS */}
      {loading ? (
        <p className="text-slate-400">Carregando quadro_producao...</p>
      ) : filteredquadro_producao.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">
          <Package size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">Nenhum pedido encontrado</p>
          <p className="text-slate-500 text-sm">Clique em "Novo Pedido" para comeéar</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredquadro_producao.map((pedido) => {
            const statusConfig = getStatusConfig(pedido.status);
            const StatusIcon = getStatusIcon(pedido.status);

            return (
              <div
                key={pedido.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg hover:shadow-slate-950/30 transition"
              >
                {/* FOTO DO PRODUTO */}
                <div className="relative rounded-xl bg-slate-900 overflow-hidden h-40 mb-3">
                  {pedido.foto_url ? (
                    <img
                      src={pedido.foto_url}
                      alt={pedido.nome_produto}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <Package size={40} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.cor}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* INFORMAÇÕES */}
                <div>
                  <h3 className="text-lg font-semibold text-white">{pedido.nome_produto || 'Sem nome'}</h3>
                  <p className="text-sm text-slate-400">SKU: {pedido.sku || '---'}</p>
                  <p className="text-sm text-slate-400">?? {pedido.plataforma}</p>
                  <p className="text-sm text-slate-400">Qtd: {pedido.quantidade}</p>

                  {/* CAMPOS DE RECEBIMENTO */}
                  <div className="mt-3 space-y-1 text-sm">
                    {pedido.recebido_por && (
                      <p className="text-slate-300 flex items-center gap-2">
                        <User size={14} className="text-emerald-400" />
                        Recebido por: {pedido.recebido_por}
                      </p>
                    )}
                    {pedido.trouxe_expedicao && (
                      <p className="text-slate-300 flex items-center gap-2">
                        <Truck size={14} className="text-orange-400" />
                        Trouxe: {pedido.trouxe_expedicao}
                      </p>
                    )}
                    {pedido.levou_coleta && (
                      <p className="text-slate-300 flex items-center gap-2">
                        <Truck size={14} className="text-blue-400" />
                        Coleta: {pedido.levou_coleta}
                      </p>
                    )}
                  </div>

                  {/* DATA */}
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(pedido.created_at).toLocaleString('pt-BR')}
                  </p>

                  {/* BOTéES */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleEdit(pedido)}
                      className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(pedido.id)}
                      className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                    {pedido.status === 'pendente' && (
                      <button
                        onClick={async () => {
                          await supabase
                            .from('quadro_producao')
                            .update({ status: 'produzido' })
                            .eq('id', pedido.id);
                          loadPedidos();
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-600 transition"
                      >
                        ? Produzir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CRIAééO/EDIééO */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold text-white mb-6">
              {editing ? '?? Editar Pedido' : '?? Novo Pedido'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">SKU do produto *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    placeholder="Ex: FR-001"
                    value={form.sku}
                    onChange={(e) => setForm({...form, sku: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nome do produto</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    placeholder="Ex: Pastilha de Freio"
                    value={form.nome_produto}
                    onChange={(e) => setForm({...form, nome_produto: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Quantidade</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    value={form.quantidade}
                    onChange={(e) => setForm({...form, quantidade: parseInt(e.target.value) || 1})}
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Plataforma</label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    value={form.plataforma}
                    onChange={(e) => setForm({...form, plataforma: e.target.value})}
                  >
                    {plataformas.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Status</label>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                  value={form.status}
                  onChange={(e) => setForm({...form, status: e.target.value})}
                >
                  <option value="pendente">? Pendente</option>
                  <option value="produzido">? Produzido</option>
                  <option value="atrasado">?? Atrasado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">URL da foto do produto</label>
                <input
                  type="url"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                  placeholder="https://..."
                  value={form.foto_url}
                  onChange={(e) => setForm({...form, foto_url: e.target.value})}
                />
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm font-semibold text-slate-300 mb-3">?? Controle de Recebimento</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Recebido por</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="Nome de quem recebeu"
                      value={form.recebido_por}
                      onChange={(e) => setForm({...form, recebido_por: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Trouxe até expedição</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="Nome de quem trouxe"
                      value={form.trouxe_expedicao}
                      onChange={(e) => setForm({...form, trouxe_expedicao: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Levou para coleta</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                      placeholder="Nome de quem levou"
                      value={form.levou_coleta}
                      onChange={(e) => setForm({...form, levou_coleta: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 px-6 py-3 rounded-xl text-white font-semibold hover:bg-orange-600 transition"
                >
                  {editing ? '?? Atualizar' : '? Cadastrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

