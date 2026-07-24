import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import styles from './PCP.module.css';
import ApontamentoProducao from './components/ApontamentoProducao';

const PCPPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    product_name: '',
    sku: '',
    client: '',
    quantity: 1,
    priority: 'Media',
    setor_inicial: 'Recebido',
    expected_delivery: '',
    observations: ''
  });

  // Lista de setores/etapas da produção
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

  const stageColors = {
    'Recebido': '#6c757d',
    'Corte a Laser': '#0dcaf0',
    'Dobra': '#0d6efd',
    'Solda': '#6610f2',
    'Lixamento': '#d63384',
    'Químico': '#dc3545',
    'Pintura': '#fd7e14',
    'Montagem': '#ffc107',
    'Inspeção de Qualidade': '#198754',
    'Embalagem': '#20c997',
    'Expedição': '#0dcaf0',
    'Entregue': '#28a745'
  };

  const priorityColors = {
    'Baixa': '#6c757d',
    'Media': '#ffc107',
    'Alta': '#fd7e14',
    'Urgente': '#dc3545'
  };

  const stages = [
    'Recebido', 'Corte a Laser', 'Dobra', 'Solda', 'Lixamento',
    'Químico', 'Pintura', 'Montagem', 'Inspeção de Qualidade',
    'Embalagem', 'Expedição', 'Entregue'
  ];

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao buscar ordens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('production_stats')
        .select('*')
        .limit(1);

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const createOrder = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .insert([{
          product_name: newOrder.product_name,
          sku: newOrder.sku,
          client: newOrder.client,
          quantity: newOrder.quantity,
          priority: newOrder.priority,
          current_stage: newOrder.setor_inicial || 'Recebido',
          status: 'Aguardando Produção',
          expected_delivery: newOrder.expected_delivery,
          observations: newOrder.observations,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      setShowModal(false);
      setNewOrder({
        product_name: '',
        sku: '',
        client: '',
        quantity: 1,
        priority: 'Media',
        setor_inicial: 'Recebido',
        expected_delivery: '',
        observations: ''
      });
      
      await fetchOrders();
      await fetchStats();
      alert('Ordem de Produção criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar OP:', error);
      alert('Erro ao criar Ordem de Produção');
    }
  };

  const updateStage = async (orderId, newStage) => {
    try {
      const { error } = await supabase
        .from('production_orders')
        .update({ 
          current_stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      await supabase
        .from('production_movements')
        .insert([{
          order_id: orderId,
          stage: newStage,
          description: 'Movido para: ' + newStage,
          user_name: 'Usuário',
          created_at: new Date().toISOString()
        }]);

      await fetchOrders();
      await fetchStats();
      
    } catch (error) {
      console.error('Erro ao atualizar etapa:', error);
      alert('Erro ao atualizar etapa');
    }
  };

  const advanceStage = async (order) => {
    const currentIndex = stages.indexOf(order.current_stage);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < stages.length) {
      await updateStage(order.id, stages[nextIndex]);
    } else {
      alert('OP já está na etapa final!');
    }
  };

  const previousStage = async (order) => {
    const currentIndex = stages.indexOf(order.current_stage);
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
      await updateStage(order.id, stages[prevIndex]);
    } else {
      alert('OP já está na primeira etapa!');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta Ordem de Produção?')) return;
    
    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      
      await fetchOrders();
      await fetchStats();
      alert('OP excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir OP:', error);
      alert('Erro ao excluir Ordem de Produção');
    }
  };

  const filteredOrders = orders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      (order.order_number?.toString() || '').includes(search) ||
      (order.product_name?.toLowerCase() || '').includes(search) ||
      (order.sku?.toLowerCase() || '').includes(search) ||
      (order.client?.toLowerCase() || '').includes(search)
    );
  });

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, []);

  return (
    <div className={styles.pcpContainer}>
      <div className={styles.pcpHeader}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.headerTitle}>🏭 Controle de Produção (PCP)</h1>
            <p className={styles.headerSubtitle}>Gerencie suas Ordens de Produção em tempo real</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnSuccess} onClick={() => setShowModal(true)}>
              ➕ Nova OP
            </button>
            <button className={styles.btnPrimary} onClick={() => { fetchOrders(); fetchStats(); }}>
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE SETORES - VISÍVEL SEMPRE */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        border: '1px solid #e9ecef'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <h4 style={{ margin: 0, color: '#1a2a3a', fontSize: '16px' }}>
            📍 Setores da Produção
          </h4>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Clique em uma OP para bipar nos setores
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '6px'
        }}>
          {setores.map(setor => (
            <div
              key={setor.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 4px',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '2px solid ' + setor.cor,
                fontSize: '10px',
                fontWeight: '500',
                color: '#333'
              }}
            >
              <span style={{ fontSize: '18px' }}>{setor.icon}</span>
              <span style={{ textAlign: 'center', fontSize: '9px', marginTop: '2px' }}>
                {setor.nome}
              </span>
            </div>
          ))}
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue + ' ' + styles.statBlue}>{stats.total_in_production || 0}</div>
            <div className={styles.statLabel}>📦 Em Produção</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue + ' ' + styles.statRed}>{stats.delayed || 0}</div>
            <div className={styles.statLabel}>⚠️ Atrasados</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue + ' ' + styles.statGreen}>
              {orders.filter(o => o.status === 'Entregue' || o.current_stage === 'Entregue').length}
            </div>
            <div className={styles.statLabel}>✅ Entregues</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue + ' ' + styles.statPurple}>{orders.length}</div>
            <div className={styles.statLabel}>📋 Total de OP</div>
          </div>
        </div>
      )}

      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Buscar por OP, produto, SKU ou cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}>⏳</div>
          <p>Carregando ordens de produção...</p>
        </div>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h3 className={styles.emptyTitle}>Nenhuma ordem encontrada</h3>
              <p className={styles.emptyText}>
                {searchTerm ? 'Tente buscar com outros termos' : 'Clique em "Nova OP" para criar sua primeira Ordem de Produção'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const currentIndex = stages.indexOf(order.current_stage);
              const progress = ((currentIndex + 1) / stages.length) * 100;
              const isDelayed = order.expected_delivery && 
                new Date(order.expected_delivery) < new Date() && 
                order.current_stage !== 'Entregue';

              return (
                <div key={order.id}>
                  <div 
                    className={styles.orderCard}
                    style={{ borderLeftColor: stageColors[order.current_stage] || '#6c757d' }}
                  >
                    <div className={styles.orderHeader}>
                      <div className={styles.orderTitle}>
                        <h3 className={styles.orderNumber}>OP #{order.order_number}</h3>
                        <span 
                          className={styles.badge + ' ' + styles.badgeStage}
                          style={{ background: stageColors[order.current_stage] || '#6c757d' }}
                        >
                          {order.current_stage || 'Recebido'}
                        </span>
                        <span 
                          className={styles.badge}
                          style={{ background: priorityColors[order.priority] || '#6c757d' }}
                        >
                          {order.priority || 'Media'}
                        </span>
                        {isDelayed && (
                          <span className={styles.badge} style={{ background: '#dc3545' }}>⚠️ Atrasado</span>
                        )}
                      </div>
                      <div className={styles.orderActions}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => previousStage(order)}
                          disabled={order.current_stage === 'Recebido' || order.current_stage === 'Entregue'}
                        >
                          ◀ Voltar
                        </button>
                        <button
                          className={styles.btnPrimary}
                          onClick={() => advanceStage(order)}
                          disabled={order.current_stage === 'Entregue'}
                        >
                          ➜ Avançar
                        </button>
                        {order.current_stage !== 'Entregue' && (
                          <button
                            className={styles.btnSuccess}
                            onClick={() => updateStage(order.id, 'Entregue')}
                          >
                            ✅ Entregar
                          </button>
                        )}
                        <button
                          className={styles.btnDanger}
                          onClick={() => deleteOrder(order.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className={styles.orderInfo}>
                      <span><strong>Produto:</strong> {order.product_name || 'N/A'}</span>
                      <span><strong>SKU:</strong> {order.sku || 'N/A'}</span>
                      <span><strong>Cliente:</strong> {order.client || 'N/A'}</span>
                      <span><strong>Qtd:</strong> {order.quantity}</span>
                      <span>
                        <strong>Entrega:</strong> {order.expected_delivery ? 
                          new Date(order.expected_delivery).toLocaleDateString('pt-BR') : 
                          'N/A'}
                      </span>
                      <span><strong>Criado:</strong> {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>

                    {order.observations && (
                      <div className={styles.orderObservations}>
                        <strong>Observações:</strong> {order.observations}
                      </div>
                    )}

                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ width: Math.min(progress, 100) + '%' }}
                        />
                      </div>
                      <div className={styles.progressInfo}>
                        <span>Etapa {currentIndex + 1} de {stages.length}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                    </div>
                  </div>

                  <ApontamentoProducao 
                    orderId={order.id} 
                    onUpdate={() => { fetchOrders(); fetchStats(); }}
                  />
                </div>
              );
            })
          )}
        </>
      )}

      {/* MODAL - Nova Ordem com Setores */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📋 Nova Ordem de Produção</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createOrder}>
              <div className={styles.formGroup}>
                <label>Produto *</label>
                <input
                  type="text"
                  required
                  value={newOrder.product_name}
                  onChange={(e) => setNewOrder({...newOrder, product_name: e.target.value})}
                  placeholder="Nome do produto"
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>SKU</label>
                  <input
                    type="text"
                    value={newOrder.sku}
                    onChange={(e) => setNewOrder({...newOrder, sku: e.target.value})}
                    placeholder="Código SKU"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cliente</label>
                  <input
                    type="text"
                    value={newOrder.client}
                    onChange={(e) => setNewOrder({...newOrder, client: e.target.value})}
                    placeholder="Nome do cliente"
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Quantidade *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder({...newOrder, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Prioridade</label>
                  <select
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder({...newOrder, priority: e.target.value})}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Media">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* SELEÇÃO DE SETOR INICIAL */}
              <div className={styles.formGroup}>
                <label>📍 Setor Inicial *</label>
                <select
                  value={newOrder.setor_inicial}
                  onChange={(e) => setNewOrder({...newOrder, setor_inicial: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  {setores.map(setor => (
                    <option key={setor.id} value={setor.nome} style={{ 
                      color: setor.cor,
                      fontWeight: '500'
                    }}>
                      {setor.icon} {setor.nome}
                    </option>
                  ))}
                </select>
                <small style={{ color: '#6c757d', fontSize: '12px' }}>
                  Escolha em qual setor a produção vai começar
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Data Prevista de Entrega</label>
                <input
                  type="date"
                  value={newOrder.expected_delivery}
                  onChange={(e) => setNewOrder({...newOrder, expected_delivery: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Observações</label>
                <textarea
                  value={newOrder.observations}
                  onChange={(e) => setNewOrder({...newOrder, observations: e.target.value})}
                  placeholder="Observações adicionais"
                  rows="3"
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  ✅ Criar OP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCPPage;
