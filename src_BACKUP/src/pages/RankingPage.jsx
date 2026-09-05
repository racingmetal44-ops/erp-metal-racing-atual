import { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Users,
  TrendingUp,
  Search,
  Calendar,
  Filter,
  User,
  Award,
  Star,
  Crown,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_usuarios: 0, total_bipagens: 0 });
  const [periodo, setPeriodo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [filteredRanking, setFilteredRanking] = useState([]);

  useEffect(() => {
    loadRanking();
  }, [periodo]);

  async function loadRanking() {
    setLoading(true);
    try {
      let query = supabase
        .from('bipagem_history')
        .select('usuario_nome, tipo, created_at');

      if (periodo === 'hoje') {
        const hoje = new Date().toISOString().split('T')[0];
        query = query.gte('created_at', hoje);
      } else if (periodo === 'semana') {
        const semana = new Date();
        semana.setDate(semana.getDate() - 7);
        query = query.gte('created_at', semana.toISOString());
      } else if (periodo === 'mes') {
        const mes = new Date();
        mes.setMonth(mes.getMonth() - 1);
        query = query.gte('created_at', mes.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const usuariosMap = new Map();
      
      data.forEach(item => {
        const nome = item.usuario_nome || 'Sistema';
        if (!usuariosMap.has(nome)) {
          usuariosMap.set(nome, { nome, total: 0, entradas: 0, saidas: 0 });
        }
        const usuario = usuariosMap.get(nome);
        usuario.total++;
        if (item.tipo === 'entrada') usuario.entradas++;
        if (item.tipo === 'saida') usuario.saidas++;
      });

      const rankingArray = Array.from(usuariosMap.values())
        .sort((a, b) => b.total - a.total);

      setRanking(rankingArray);
      setFilteredRanking(rankingArray);
      setStats({
        total_usuarios: rankingArray.length,
        total_bipagens: data.length
      });

    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (busca.trim() === '') {
      setFilteredRanking(ranking);
    } else {
      const filtrado = ranking.filter(item =>
        item.nome.toLowerCase().includes(busca.toLowerCase())
      );
      setFilteredRanking(filtrado);
    }
  }, [busca, ranking]);

  function getMedal(position) {
    switch (position) {
      case 0: return '??';
      case 1: return '??';
      case 2: return '??';
      default: return `${position + 1}é`;
    }
  }

  function getMedalColor(position) {
    switch (position) {
      case 0: return 'text-amber-400';
      case 1: return 'text-slate-300';
      case 2: return 'text-amber-600';
      default: return 'text-slate-500';
    }
  }

  function getPositionBadge(position) {
    switch (position) {
      case 0: return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
      case 1: return 'bg-slate-400/20 border-slate-400/50 text-slate-300';
      case 2: return 'bg-amber-600/20 border-amber-600/50 text-amber-500';
      default: return 'bg-slate-700/50 border-slate-600 text-slate-400';
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold flex items-center gap-3">
          ?? Ranking de Bipagens
        </h1>
        <p className="mt-2 text-sm text-slate-400">Os colaboradores mais ativos</p>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <Users size={18} />
            <span className="text-sm">Participantes</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total_usuarios}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp size={18} />
            <span className="text-sm">Total bipagens</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.total_bipagens}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Zap size={18} />
            <span className="text-sm">Média por usuário</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {stats.total_usuarios > 0 ? Math.round(stats.total_bipagens / stats.total_usuarios) : 0}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Target size={18} />
            <span className="text-sm">Maior pontuação</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-400">
            {ranking.length > 0 ? ranking[0].total : 0}
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm text-slate-400">Período</span>
            <div className="flex gap-2">
              {['todos', 'hoje', 'semana', 'mes'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    periodo === p
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {p === 'todos' ? 'Todos' :
                   p === 'hoje' ? 'Hoje' :
                   p === 'semana' ? 'Semana' : 'Més'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Digite o nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>
      </div>

      {/* RANKING */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        {loading ? (
          <p className="text-center text-slate-400">Carregando ranking...</p>
        ) : filteredRanking.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nenhuma bipagem registrada ainda.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PÓDIO (Top 3) */}
            {filteredRanking.length >= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {filteredRanking.slice(0, 3).map((item, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;
                  
                  return (
                    <div
                      key={item.nome}
                      className={`relative rounded-2xl p-6 text-center border-2 transition-all hover:scale-105 ${
                        isFirst 
                          ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/20 to-transparent shadow-lg shadow-amber-500/20' 
                          : isSecond 
                          ? 'border-slate-400/30 bg-gradient-to-b from-slate-400/10 to-transparent'
                          : 'border-amber-600/30 bg-gradient-to-b from-amber-600/10 to-transparent'
                      }`}
                    >
                      {isFirst && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Crown size={32} className="text-amber-400" />
                        </div>
                      )}
                      <div className="text-4xl mb-2">{getMedal(index)}</div>
                      <div className="flex items-center justify-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <h3 className="text-lg font-semibold text-white">{item.nome}</h3>
                      </div>
                      <p className={`text-3xl font-bold mt-2 ${
                        isFirst ? 'text-amber-400' : 
                        isSecond ? 'text-slate-300' : 
                        'text-amber-500'
                      }`}>
                        {item.total}
                      </p>
                      <p className="text-sm text-slate-400">bipagens</p>
                      <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        isFirst ? 'bg-amber-500/20 text-amber-400' :
                        isSecond ? 'bg-slate-400/20 text-slate-300' :
                        'bg-amber-600/20 text-amber-500'
                      }`}>
                        {isFirst ? '?? 1º LUGAR' : 
                         isSecond ? '?? 2º LUGAR' : 
                         '?? 3º LUGAR'}
                      </div>
                      <div className="flex justify-center gap-4 mt-3 text-xs text-slate-400">
                        <span>?? +{item.entradas}</span>
                        <span>?? -{item.saidas}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LISTA COMPLETA */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                <BarChart3 size={16} />
                Classificação Geral
              </h3>
              <div className="space-y-2">
                {filteredRanking.slice(3).map((item, index) => {
                  const position = index + 3;
                  return (
                    <div
                      key={item.nome}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-950/50 hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 text-center font-bold ${getMedalColor(position)}`}>
                          {position + 1}é
                        </span>
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-slate-400" />
                          <span className="text-white font-medium">{item.nome}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex gap-3 text-xs text-slate-400">
                          <span className="text-emerald-400">+{item.entradas}</span>
                          <span className="text-rose-400">-{item.saidas}</span>
                        </div>
                        <span className="text-lg font-bold text-white min-w-[50px] text-right">
                          {item.total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
