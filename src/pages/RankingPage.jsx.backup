import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Users, TrendingUp, Calendar, Search } from 'lucide-react';

export default function RankingPage() {
  const [rankedUsers, setRankedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    carregarRanking();
    const interval = setInterval(carregarRanking, 30000);
    return () => clearInterval(interval);
  }, [periodo]);

  const carregarRanking = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bipagens')
        .select('operador, quantidade, tipo, data_hora');

      if (periodo === 'today') {
        const hoje = new Date().toISOString().split('T')[0];
        query = query.gte('data_hora', hoje);
      } else if (periodo === 'week') {
        const semana = new Date();
        semana.setDate(semana.getDate() - 7);
        query = query.gte('data_hora', semana.toISOString());
      } else if (periodo === 'month') {
        const mes = new Date();
        mes.setDate(mes.getDate() - 30);
        query = query.gte('data_hora', mes.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const usuariosMap = {};
      data.forEach(item => {
        // ==========================================
        // FILTRAR "Sistema" E OPERADORES INVÁLIDOS
        // ==========================================
        const nome = item.operador || '';
        if (!nome || nome === 'Sistema' || nome === 'Desconhecido' || nome.trim() === '') {
          return; // PULAR este registro
        }

        if (!usuariosMap[nome]) {
          usuariosMap[nome] = {
            nome: nome,
            total: 0,
            entradas: 0,
            saidas: 0,
            ultima_atividade: item.data_hora
          };
        }
        const qtd = item.quantidade || 1;
        usuariosMap[nome].total += qtd;
        if (item.tipo === 'entrada') {
          usuariosMap[nome].entradas += qtd;
        } else if (item.tipo === 'saida') {
          usuariosMap[nome].saidas += qtd;
        }
        if (new Date(item.data_hora) > new Date(usuariosMap[nome].ultima_atividade)) {
          usuariosMap[nome].ultima_atividade = item.data_hora;
        }
      });

      const rankingArray = Object.values(usuariosMap)
        .sort((a, b) => b.total - a.total);

      setRankedUsers(rankingArray);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPremio = (posicao) => {
    const premios = {
      1: { icone: '🥇', label: '1º LUGAR' },
      2: { icone: '🥈', label: '2º LUGAR' },
      3: { icone: '🥉', label: '3º LUGAR' },
      4: { icone: '4️⃣', label: '4º LUGAR' },
      5: { icone: '5️⃣', label: '5º LUGAR' },
      6: { icone: '6️⃣', label: '6º LUGAR' },
      7: { icone: '7️⃣', label: '7º LUGAR' },
      8: { icone: '8️⃣', label: '8º LUGAR' },
      9: { icone: '9️⃣', label: '9º LUGAR' },
    };
    return premios[posicao] || { icone: '🔟', label: `${posicao}º LUGAR` };
  };

  const filteredUsers = rankedUsers.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const top3 = filteredUsers.slice(0, 3);
  const restantes = filteredUsers.slice(3, 9);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f2f5' }}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Trophy className="w-10 h-10 text-yellow-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">🏆 Ranking de Bipagens</h1>
                <p className="text-gray-500">Os colaboradores mais ativos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">📅 Todos</option>
                <option value="today">📆 Hoje</option>
                <option value="week">📆 Esta semana</option>
                <option value="month">📆 Este mês</option>
              </select>
              <button
                onClick={carregarRanking}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-5 h-5" />
              <span>Participantes</span>
            </div>
            <p className="text-2xl font-bold text-gray-800 mt-2">{rankedUsers.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <TrendingUp className="w-5 h-5" />
              <span>Total bipagens</span>
            </div>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {rankedUsers.reduce((acc, user) => acc + user.total, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-5 h-5" />
              <span>Período</span>
            </div>
            <p className="text-sm font-medium text-gray-800 mt-2 capitalize">
              {periodo === 'all' ? 'Todos' : periodo}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Search className="w-5 h-5" />
              <span>Buscar</span>
            </div>
            <input
              type="text"
              placeholder="Digite o nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full mt-2 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-12">
              <p className="text-gray-500">Nenhum operador encontrado</p>
              <p className="text-sm text-gray-400 mt-2">Faça bipagens para aparecer no ranking!</p>
            </div>
          ) : (
            <div>
              <div className="bg-gray-50 p-6">
                <h3 className="text-center text-lg font-bold text-gray-700 mb-6">🥇 Pódio</h3>
                <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                  {top3.map((user, index) => {
                    const premio = getPremio(index + 1);
                    return (
                      <div key={user.nome} className="text-center">
                        <div className="bg-white rounded-t-xl p-4 h-32 flex flex-col items-center justify-end shadow-sm">
                          <div className="text-4xl mb-2">{premio.icone}</div>
                          <div className="text-sm font-bold text-gray-800">{user.nome}</div>
                        </div>
                        <div className="bg-white rounded-b-xl shadow-md p-3 border-t-4 border-yellow-400">
                          <p className="text-2xl font-bold text-gray-800">{user.total}</p>
                          <p className="text-xs text-gray-500">bipagens</p>
                          <span className="text-xs font-bold text-yellow-600">{premio.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {restantes.length > 0 && (
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-3">📋 Classificação geral</h4>
                  <div className="space-y-2">
                    {restantes.map((user, index) => {
                      const posicao = index + 4;
                      const premio = getPremio(posicao);
                      return (
                        <div key={user.nome} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-gray-700 bg-white shadow-sm">
                              {premio.icone}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{user.nome}</p>
                              <p className="text-xs text-gray-500">📥 {user.entradas} • 📤 {user.saidas}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-800">{user.total}</p>
                            <p className="text-xs text-gray-400">bipagens</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredUsers.length > 9 && (
                <div className="p-4 border-t">
                  <details>
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                      📋 Ver mais {filteredUsers.length - 9} participantes
                    </summary>
                    <div className="mt-3 space-y-2">
                      {filteredUsers.slice(9).map((user, index) => {
                        const posicao = index + 10;
                        return (
                          <div key={user.nome} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-4">
                              <span className="w-8 text-center text-gray-400 font-bold">{posicao}º</span>
                              <p className="font-medium text-gray-700">{user.nome}</p>
                            </div>
                            <p className="font-bold text-gray-600">{user.total}</p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}