import { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  Trash2,
  Check,
  Siren,
  Megaphone,
  Flame,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ titulo: '', descricao: '', nivel: 'medio' });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(null);
  const [notificacaoAtiva, setNotificacaoAtiva] = useState(null);

  useEffect(() => {
    loadAvisos();
    
    // Verificar novos avisos a cada 30 segundos
    const interval = setInterval(loadAvisos, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadAvisos() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('avisos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAvisos(data || []);
      
      // Verificar se há avisos críticos não reconhecidos
      const criticosNaoReconhecidos = (data || []).filter(
        a => a.nivel === 'critico' && !a.reconhecido
      );
      
      if (criticosNaoReconhecidos.length > 0) {
        // Mostrar notificação para cada aviso crítico
        criticosNaoReconhecidos.forEach(aviso => {
          mostrarNotificacao(aviso);
        });
      }

    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    } finally {
      setLoading(false);
    }
  }

  function mostrarNotificacao(aviso) {
    // Tocar som de sirene (simulado)
    const cores = {
      critico: 'border-rose-500/50 bg-rose-500/10 text-rose-400',
      urgente: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
      medio: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
      baixo: 'border-blue-500/50 bg-blue-500/10 text-blue-400'
    };

    const icones = {
      critico: <Flame size={24} className="text-rose-400 animate-pulse" />,
      urgente: <Siren size={24} className="text-orange-400 animate-bounce" />,
      medio: <AlertCircle size={24} className="text-yellow-400" />,
      baixo: <Info size={24} className="text-blue-400" />
    };

    setNotificacaoAtiva({
      id: aviso.id,
      titulo: aviso.titulo,
      descricao: aviso.descricao,
      nivel: aviso.nivel,
      cor: cores[aviso.nivel] || cores.baixo,
      icone: icones[aviso.nivel] || icones.baixo
    });

    // Auto-esconder após 10 segundos
    setTimeout(() => {
      setNotificacaoAtiva(null);
    }, 10000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (!form.titulo.trim()) {
      setMessage('⚠️ O título é obrigatório');
      setMessageType('error');
      return;
    }

    try {
      const { error } = await supabase
        .from('avisos')
        .insert({
          titulo: form.titulo,
          descricao: form.descricao,
          nivel: form.nivel
        });

      if (error) throw error;

      setMessage('✅ Aviso criado com sucesso!');
      setMessageType('success');
      setForm({ titulo: '', descricao: '', nivel: 'medio' });
      setMostrarForm(false);
      await loadAvisos();

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`❌ Erro ao criar aviso: ${error.message}`);
      setMessageType('error');
    }
  }

  async function handleReconhecer(id) {
    try {
      const { error } = await supabase
        .from('avisos')
        .update({ 
          reconhecido: true,
          reconhecido_por: 'Usuário',
          reconhecido_em: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      await loadAvisos();
      setNotificacaoAtiva(null);
    } catch (error) {
      console.error('Erro ao reconhecer aviso:', error);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir este aviso?')) return;

    try {
      const { error } = await supabase
        .from('avisos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAvisos();
    } catch (error) {
      console.error('Erro ao excluir aviso:', error);
    }
  }

  function getNivelConfig(nivel) {
    const configs = {
      critico: { 
        label: '🔴 Crítico', 
        cor: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
        icon: Flame,
        bg: 'bg-rose-500/5'
      },
      urgente: { 
        label: '🟠 Urgente', 
        cor: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
        icon: Siren,
        bg: 'bg-orange-500/5'
      },
      medio: { 
        label: '🟡 Médio', 
        cor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        icon: AlertCircle,
        bg: 'bg-yellow-500/5'
      },
      baixo: { 
        label: '🔵 Baixo', 
        cor: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        icon: Info,
        bg: 'bg-blue-500/5'
      }
    };
    return configs[nivel] || configs.baixo;
  }

  const avisosFiltrados = avisos.filter(aviso => {
    const matchFiltro = filtro === 'todos' || 
      (filtro === 'reconhecidos' && aviso.reconhecido) ||
      (filtro === 'nao_reconhecidos' && !aviso.reconhecido) ||
      aviso.nivel === filtro;
    
    const matchBusca = aviso.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (aviso.descricao && aviso.descricao.toLowerCase().includes(busca.toLowerCase()));
    
    return matchFiltro && matchBusca;
  });

  // Notificações pendentes (não reconhecidas)
  const pendentes = avisos.filter(a => !a.reconhecido).length;

  return (
    <div className="space-y-6">
      {/* HEADER COM SINO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-400">Módulo</p>
            <h1 className="mt-2 text-3xl font-semibold flex items-center gap-3">
              <Bell size={28} className="text-orange-400" />
              Avisos
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Centralização dos alertas críticos e pendências.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendentes > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <span className="animate-pulse text-rose-400">●</span>
                <span className="text-sm font-semibold text-rose-400">
                  {pendentes} pendente{pendentes > 1 ? 's' : ''}
                </span>
              </div>
            )}
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              <Plus size={16} />
              Novo alerta
            </button>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO NOVO ALERTA */}
      {mostrarForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🔔 Novo Alerta</h2>
          
          {message && (
            <div className={`mb-4 p-3 rounded-xl border ${
              messageType === 'success' 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Título *</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                placeholder="Digite o título do alerta"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Descrição</label>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none resize-none"
                placeholder="Digite a descrição do alerta"
                rows="3"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Nível de urgência</label>
              <div className="grid grid-cols-4 gap-2">
                {['critico', 'urgente', 'medio', 'baixo'].map((nivel) => {
                  const config = getNivelConfig(nivel);
                  const Icon = config.icon;
                  return (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setForm({ ...form, nivel })}
                      className={`p-3 rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                        form.nivel === nivel
                          ? config.cor
                          : 'border-slate-700 hover:border-slate-500 text-slate-400'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium capitalize">{nivel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 transition"
              >
                Cadastrar
              </button>
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                className="rounded-xl border border-slate-700 px-6 py-3 text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTROS E BUSCA */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltro('todos')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filtro === 'todos'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltro('nao_reconhecidos')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filtro === 'nao_reconhecidos'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ⚠️ Pendentes
            </button>
            <button
              onClick={() => setFiltro('reconhecidos')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filtro === 'reconhecidos'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ✅ Reconhecidos
            </button>
            {['critico', 'urgente', 'medio', 'baixo'].map((nivel) => {
              const config = getNivelConfig(nivel);
              return (
                <button
                  key={nivel}
                  onClick={() => setFiltro(nivel)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filtro === nivel
                      ? config.cor
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar avisos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* LISTA DE AVISOS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        {loading ? (
          <p className="text-center text-slate-400">Carregando avisos...</p>
        ) : avisosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nenhum aviso encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avisosFiltrados.map((aviso) => {
              const config = getNivelConfig(aviso.nivel);
              const Icon = config.icon;
              const isPendente = !aviso.reconhecido;

              return (
                <div
                  key={aviso.id}
                  className={`p-4 rounded-xl border transition ${
                    isPendente
                      ? 'border-orange-500/20 bg-orange-500/5'
                      : 'border-slate-700 bg-slate-950/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <Icon size={20} className={isPendente ? 'animate-pulse' : ''} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">
                          {aviso.titulo}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.cor}`}>
                          {config.label}
                        </span>
                        {!aviso.reconhecido && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            ⚠️ Novo
                          </span>
                        )}
                      </div>
                      
                      {aviso.descricao && (
                        <p className="text-sm text-slate-400 mt-1">{aviso.descricao}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(aviso.created_at).toLocaleString('pt-BR')}
                        </span>
                        {aviso.reconhecido && aviso.reconhecido_por && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Check size={12} />
                            Reconhecido por {aviso.reconhecido_por}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!aviso.reconhecido && (
                        <button
                          onClick={() => handleReconhecer(aviso.id)}
                          className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                          title="Reconhecer aviso"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(aviso.id)}
                        className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                        title="Excluir aviso"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NOTIFICAÇÃO FLUTUANTE COM SIRENE */}
      {notificacaoAtiva && (
        <div className="fixed top-4 right-4 z-[9999] max-w-md w-full">
          <div className={`rounded-2xl border-2 p-6 shadow-2xl animate-slide-in ${notificacaoAtiva.cor}`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {notificacaoAtiva.icone}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white">{notificacaoAtiva.titulo}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                    {notificacaoAtiva.nivel}
                  </span>
                </div>
                {notificacaoAtiva.descricao && (
                  <p className="text-sm text-white/80 mt-1">{notificacaoAtiva.descricao}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleReconhecer(notificacaoAtiva.id)}
                    className="px-4 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30 transition"
                  >
                    Reconhecer
                  </button>
                  <button
                    onClick={() => setNotificacaoAtiva(null)}
                    className="px-4 py-1.5 rounded-lg bg-black/20 text-white/70 text-sm hover:bg-black/30 transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNotificacaoAtiva(null)}
                className="text-white/50 hover:text-white transition"
              >
                <XCircle size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
