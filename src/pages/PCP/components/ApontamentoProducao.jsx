import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const ApontamentoProducao = ({ orderId, onUpdate }) => {
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operadores, setOperadores] = useState([]);
  const [selectedOperador, setSelectedOperador] = useState('');
  const [observacao, setObservacao] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Lista de setores/etapas da produção em ordem
  const setores = [
    { id: 1, nome: 'Recebido', cor: '#6c757d', icon: '📥' },
    { id: 2, nome: 'Corte a Laser', cor: '#0dcaf0', icon: '✂️' },
    { id: 3, nome: 'Dobra', cor: '#0d6efd', icon: '🔧' },
    { id: 4, nome: 'Solda', cor: '#6610f2', icon: '⚡' },
    { id: 5, nome: 'Lixamento', cor: '#d63384', icon: '🔨' },
    { id: 6, nome: 'Químico', cor: '#dc3545', icon: '🧪' },
    { id: 7, nome: 'Pintura', cor: '#fd7e14', icon: '🎨' },
    { id: 8, nome: 'Montagem', cor: '#ffc107', icon: '🔩' },
    { id: 9, nome: 'Inspeção de Qualidade', cor: '#198754', icon: '✅' },
    { id: 10, nome: 'Embalagem', cor: '#20c997', icon: '📦' },
    { id: 11, nome: 'Expedição', cor: '#0dcaf0', icon: '🚚' },
    { id: 12, nome: 'Entregue', cor: '#28a745', icon: '🏁' }
  ];

  // Mapear cores e ícones por nome do setor
  const setorColors = {};
  const setorIcons = {};
  setores.forEach(s => {
    setorColors[s.nome] = s.cor;
    setorIcons[s.nome] = s.icon;
  });

  // Buscar apontamentos da OP
  const fetchApontamentos = async () => {
    if (!orderId) return;
    
    try {
      const { data, error } = await supabase
        .from('production_apontamentos')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApontamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar apontamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar operadores
  const fetchOperadores = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email');

      if (error) throw error;
      setOperadores(data || []);
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
    }
  };

  // BIPAR - Iniciar apontamento em um setor
  const biparInicio = async (setor) => {
    if (!selectedOperador) {
      alert('Selecione um operador primeiro!');
      return;
    }

    // Verificar se já existe apontamento ativo para este setor
    const existeAtivo = apontamentos.some(a => a.setor === setor && a.status === 'Em Andamento');
    if (existeAtivo) {
      alert('Já existe um apontamento ativo para o setor: ' + setor);
      return;
    }

    // Verificar se há outro setor ativo
    const outroAtivo = apontamentos.some(a => a.status === 'Em Andamento' && a.setor !== setor);
    if (outroAtivo) {
      alert('Existe um apontamento ativo em outro setor. Finalize-o primeiro!');
      return;
    }

    try {
      const operador = operadores.find(op => op.id === selectedOperador);
      
      const { data, error } = await supabase
        .from('production_apontamentos')
        .insert([{
          order_id: orderId,
          operador_id: selectedOperador,
          operador_nome: operador?.name || 'Operador',
          setor: setor,
          data_inicio: new Date().toISOString(),
          observacao: observacao || 'Início do setor: ' + setor,
          status: 'Em Andamento'
        }])
        .select();

      if (error) throw error;

      setObservacao('');
      setShowForm(false);
      await fetchApontamentos();
      if (onUpdate) onUpdate();
      
      alert('✅ Peça bipada com sucesso no setor: ' + setor);
    } catch (error) {
      console.error('Erro ao bipar:', error);
      alert('Erro ao bipar a peça');
    }
  };

  // BIPAR - Finalizar apontamento
  const biparFim = async (apontamentoId) => {
    if (!window.confirm('Deseja finalizar este apontamento e liberar a peça para o próximo setor?')) return;

    try {
      const { error } = await supabase
        .from('production_apontamentos')
        .update({
          data_fim: new Date().toISOString(),
          status: 'Finalizado'
        })
        .eq('id', apontamentoId);

      if (error) throw error;

      await fetchApontamentos();
      if (onUpdate) onUpdate();
      
      alert('✅ Peça finalizada no setor! Próximo setor pode começar.');
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar apontamento');
    }
  };

  // Calcular tempo gasto
  const calcularTempo = (dataInicio, dataFim) => {
    if (!dataFim) return '⏳ Em andamento...';
    
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diffMs = fim - inicio;
    const diffMin = Math.floor(diffMs / 60000);
    const horas = Math.floor(diffMin / 60);
    const minutos = diffMin % 60;
    
    if (horas > 0) {
      return horas + 'h ' + minutos + 'min';
    }
    return minutos + 'min';
  };

  // Formatar data
  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleString('pt-BR');
  };

  // Verificar se um setor já foi concluído
  const setorConcluido = (setor) => {
    return apontamentos.some(a => a.setor === setor && a.status === 'Finalizado');
  };

  // Verificar se um setor está ativo
  const setorAtivo = (setor) => {
    return apontamentos.some(a => a.setor === setor && a.status === 'Em Andamento');
  };

  // Verificar se todos os setores foram concluídos
  const todosConcluidos = () => {
    return setores.every(s => setorConcluido(s.nome));
  };

  // Buscar o último apontamento ativo
  const getApontamentoAtivo = () => {
    return apontamentos.find(a => a.status === 'Em Andamento');
  };

  useEffect(() => {
    if (orderId) {
      fetchApontamentos();
      fetchOperadores();
    }
  }, [orderId]);

  if (!orderId) return null;

  const apontamentoAtivo = getApontamentoAtivo();

  return (
    <div style={{ 
      marginTop: '20px',
      padding: '16px',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <h4 style={{ margin: 0, color: '#1a2a3a' }}>
            🔄 Bipagem por Setor
          </h4>
          {apontamentoAtivo && (
            <span style={{ 
              fontSize: '12px', 
              color: '#856404',
              background: '#fff3cd',
              padding: '2px 10px',
              borderRadius: '12px',
              marginTop: '4px',
              display: 'inline-block'
            }}>
              🟢 Setor ativo: {apontamentoAtivo.setor}
            </span>
          )}
          {todosConcluidos() && (
            <span style={{ 
              fontSize: '12px', 
              color: '#155724',
              background: '#d4edda',
              padding: '2px 10px',
              borderRadius: '12px',
              marginTop: '4px',
              display: 'inline-block'
            }}>
              ✅ Todos os setores concluídos!
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!apontamentoAtivo && !todosConcluidos() && (
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                padding: '6px 16px',
                background: showForm ? '#dc3545' : '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showForm ? '✕ Cancelar Bipagem' : '📱 Bipar Peça'}
            </button>
          )}
          {apontamentoAtivo && (
            <button
              onClick={() => biparFim(apontamentoAtivo.id)}
              style={{
                padding: '6px 16px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⏹️ Finalizar Setor
            </button>
          )}
        </div>
      </div>

      {/* Formulário de Bipagem */}
      {showForm && (
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '2px solid #0ea5e9'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                👤 Operador *
              </label>
              <select
                value={selectedOperador}
                onChange={(e) => setSelectedOperador(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Selecione um operador...</option>
                {operadores.map(op => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                📝 Observação
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Iniciando corte"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Botões dos Setores */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              📍 Selecione o Setor para Bipar:
            </label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
              gap: '8px'
            }}>
              {setores.map(setor => {
                const concluido = setorConcluido(setor.nome);
                const ativo = setorAtivo(setor.nome);
                const isDisabled = concluido || ativo || !selectedOperador;
                
                return (
                  <button
                    key={setor.id}
                    onClick={() => biparInicio(setor.nome)}
                    disabled={isDisabled}
                    style={{
                      padding: '10px',
                      background: concluido ? '#28a745' : ativo ? '#ffc107' : 'white',
                      color: concluido ? 'white' : ativo ? '#856404' : '#333',
                      border: concluido ? '2px solid #28a745' : ativo ? '2px solid #ffc107' : '2px solid ' + setor.cor,
                      borderRadius: '6px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.6 : 1,
                      fontSize: '12px',
                      fontWeight: '500',
                      textAlign: 'center',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ fontSize: '20px' }}>{setor.icon}</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>{setor.nome}</div>
                    {concluido && <div style={{ fontSize: '10px' }}>✅ Concluído</div>}
                    {ativo && <div style={{ fontSize: '10px' }}>🟢 Em andamento</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Apontamentos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>⏳ Carregando...</div>
      ) : (
        <>
          {apontamentos.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              color: '#6c757d' 
            }}>
              Nenhum apontamento registrado para esta OP
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {apontamentos.map(ap => {
                const isAtivo = ap.status === 'Em Andamento';
                const corSetor = setorColors[ap.setor] || '#6c757d';
                const iconSetor = setorIcons[ap.setor] || '🔹';
                
                return (
                  <div
                    key={ap.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isAtivo ? '1fr auto' : '1fr',
                      padding: '12px',
                      background: isAtivo ? '#fff3cd' : 'white',
                      borderRadius: '6px',
                      border: isAtivo ? '2px solid #ffc107' : '1px solid #e9ecef',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            background: corSetor,
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {iconSetor} {ap.setor || 'Setor não definido'}
                          </span>
                        </span>
                        <span>
                          <strong>Operador:</strong> {ap.operador_nome || 'N/A'}
                        </span>
                        <span>
                          <strong>Início:</strong> {formatarData(ap.data_inicio)}
                        </span>
                        {ap.data_fim && (
                          <span>
                            <strong>Fim:</strong> {formatarData(ap.data_fim)}
                          </span>
                        )}
                        <span>
                          <strong>Tempo:</strong> {calcularTempo(ap.data_inicio, ap.data_fim)}
                        </span>
                        {ap.observacao && (
                          <span style={{ color: '#6c757d' }}>
                            <strong>Obs:</strong> {ap.observacao}
                          </span>
                        )}
                      </div>
                      {isAtivo && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ color: '#856404', fontWeight: '500' }}>🟢 Em Andamento</span>
                        </div>
                      )}
                      {!isAtivo && ap.data_fim && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ color: '#28a745', fontWeight: '500' }}>✅ Finalizado</span>
                        </div>
                      )}
                    </div>
                    {isAtivo && (
                      <button
                        onClick={() => biparFim(ap.id)}
                        style={{
                          padding: '6px 16px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ⏹️ Finalizar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Barra de Progresso dos Setores */}
      {apontamentos.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <span>Progresso dos Setores</span>
            <span>
              {setores.filter(s => setorConcluido(s.nome)).length} / {setores.length} concluídos
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(' + setores.length + ', 1fr)',
            gap: '2px',
            height: '8px'
          }}>
            {setores.map(setor => {
              const concluido = setorConcluido(setor.nome);
              const ativo = setorAtivo(setor.nome);
              return (
                <div
                  key={setor.id}
                  style={{
                    height: '100%',
                    background: concluido ? '#28a745' : ativo ? '#ffc107' : '#e9ecef',
                    borderRadius: '2px',
                    transition: 'all 0.5s ease'
                  }}
                  title={setor.nome + (concluido ? ' ✅' : ativo ? ' 🟢' : ' ⬜')}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApontamentoProducao;
