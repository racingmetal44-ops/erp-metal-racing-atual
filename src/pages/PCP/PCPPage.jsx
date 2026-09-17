import React, { useEffect, useMemo, useState } from 'react';
import { pcpService } from './services/pcpService';

const PRIORIDADES = ['Todas', 'Baixa', 'Media', 'Alta', 'Urgente'];

const ETAPAS_PADRAO = [
  'Recebido',
  'Corte a Laser',
  'Dobra',
  'Solda',
  'Lixamento',
  'Químico',
  'Pintura',
  'Montagem',
  'Inspeção de Qualidade',
  'Embalagem',
  'Expedição',
  'Entregue'
];

const prioridadeClass = (prioridade) => {
  const p = String(prioridade || '').toLowerCase();

  if (p === 'urgente') return 'urgent';
  if (p === 'alta') return 'high';
  if (p === 'media' || p === 'média') return 'medium';
  return 'low';
};

export default function PCPPage() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    total_orders: 0,
    total_quantity: 0,
    produced_quantity: 0
  });
  const [stages, setStages] = useState(ETAPAS_PADRAO);
  const [priority, setPriority] = useState('Todas');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageForm, setStageForm] = useState({ nome: '', cor: '#3b82f6', ordem: 0 });
  const [stagesFull, setStagesFull] = useState([]);
  const [zoomImage, setZoomImage] = useState(null);

  const [form, setForm] = useState({
    product_name: '',
    sku: '',
    client: '',
    quantity: 1,
    priority: 'Media',
    current_stage: 'Recebido',
    expected_delivery: '',
    observations: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [ordersResponse, statsResponse, stagesResponse] =
        await Promise.all([
          pcpService.getOrders(),
          pcpService.getStats(),
          pcpService.getStages()
        ]);

      const ordersData =
        ordersResponse?.data ||
        ordersResponse?.orders ||
        ordersResponse ||
        [];

      const statsData =
        statsResponse?.data ||
        statsResponse?.stats ||
        statsResponse ||
        {};

      const stagesData =
        stagesResponse?.data ||
        stagesResponse?.stages ||
        stagesResponse ||
        [];

      setOrders(Array.isArray(ordersData) ? ordersData : []);

      setStats({
        total_orders: Number(statsData.total_orders || 0),
        total_quantity: Number(statsData.total_quantity || 0),
        produced_quantity: Number(statsData.produced_quantity || 0)
      });

      if (Array.isArray(stagesData) && stagesData.length > 0) {
        const nomes = stagesData.map((s) =>
          typeof s === 'string' ? s : (s.name || s.nome || s.stage)
        ).filter(Boolean);

        if (nomes.length > 0) {
          setStages(nomes);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar PCP:', err);
      setError(err.message || 'Erro ao carregar quadro de produção.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    if (priority === 'Todas') return orders;

    return orders.filter((order) => {
      const p = String(
        order.priority || order.prioridade || ''
      ).toLowerCase();

      return p === priority.toLowerCase();
    });
  }, [orders, priority]);

  const ordersByStage = (stage) =>
    filteredOrders.filter(
      (order) =>
        String(order.current_stage || 'Recebido') === String(stage)
    );

  const moveOrder = async (order, direction) => {
    try {
      setSaving(true);
      setError('');

      const currentStage =
        order.current_stage || order.stage || 'Recebido';

      const index = stages.indexOf(currentStage);
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= stages.length) {
        return;
      }

      const nextStage = stages[nextIndex];

      await pcpService.updateStage(order.id, nextStage);
      await loadData();
    } catch (err) {
      console.error('Erro ao mover ordem:', err);
      setError(err.message || 'Não foi possível mover a ordem.');
    } finally {
      setSaving(false);
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');

      await pcpService.createOrder({
        product_name: form.product_name,
        sku: form.sku,
        client: form.client,
        quantity: Number(form.quantity),
        priority: form.priority,
        current_stage: form.current_stage,
        expected_delivery: form.expected_delivery || null,
        observations: form.observations
      });

      setShowModal(false);

      setForm({
        product_name: '',
        sku: '',
        client: '',
        quantity: 1,
        priority: 'Media',
        current_stage: 'Recebido',
        expected_delivery: '',
        observations: ''
      });

      await loadData();
    } catch (err) {
      console.error('Erro ao criar ordem:', err);
      setError(err.message || 'Não foi possível criar a ordem.');
    } finally {
      setSaving(false);
    }
  };

  const deleteOrder = async (order) => {
    const numero = order.order_number || order.numero || order.id;

    if (!window.confirm(`Excluir a ordem ${numero}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      await pcpService.deleteOrder(order.id);
      await loadData();
    } catch (err) {
      console.error('Erro ao excluir ordem:', err);
      setError(err.message || 'Não foi possível excluir a ordem.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CRUD DE SETORES
  // ============================================================
  const abrirModalNovoSetor = () => {
    setEditingStage(null);
    setStageForm({ nome: '', cor: '#3b82f6', ordem: (stagesFull?.length || stages?.length || 0) + 1 });
    setShowStageModal(true);
  };

  const abrirModalEditarSetor = (setor) => {
    setEditingStage(setor);
    setStageForm({ nome: setor.nome, cor: setor.cor || '#3b82f6', ordem: setor.ordem || 0 });
    setShowStageModal(true);
  };

  const salvarSetor = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      if (editingStage) {
        await pcpService.editarSetor(editingStage.id, stageForm);
      } else {
        await pcpService.criarSetor(stageForm);
      }
      setShowStageModal(false);
      await loadData();
    } catch (err) {
      console.error('Erro ao salvar setor:', err);
      setError(err.message || 'Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  const excluirSetor = async (setor) => {
    if (!window.confirm('Desativar o setor ' + setor.nome + '?')) return;
    try {
      setSaving(true);
      setError('');
      await pcpService.excluirSetor(setor.id);
      setShowStageModal(false);
      await loadData();
    } catch (err) {
      console.error('Erro ao excluir setor:', err);
      setError(err.message || 'Erro ao excluir setor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.system}>Sistema ERP</div>
          <h1 style={styles.title}>Metal Racing</h1>
          <div style={styles.creator}>Desenvolvido e criado por LD</div>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.secondaryButton}
            onClick={loadData}
            disabled={loading || saving}
          >
            ↻ Atualizar
          </button>

                    <button
            style={styles.setorButton}
            onClick={abrirModalNovoSetor}
            disabled={loading || saving}
          >
            ⚙ Gerenciar Setores
          </button>
<button
            style={styles.primaryButton}
            onClick={() => setShowModal(true)}
          >
            + Nova ordem
          </button>
        </div>
      </div>

      <div style={styles.moduleTitle}>
        <h2>Quadro de Produção</h2>
        <p>Acompanhe e mova as ordens entre as etapas da produção.</p>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span>Ordens</span>
          <strong>{stats.total_orders}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Quantidade</span>
          <strong>{stats.total_quantity}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Produzido</span>
          <strong>{stats.produced_quantity}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Etapas</span>
          <strong>{stages.length}</strong>
        </div>
      </div>

      <div style={styles.filters}>
        <span style={styles.filterLabel}>Prioridade:</span>

        {PRIORIDADES.map((item) => (
          <button
            key={item}
            onClick={() => setPriority(item)}
            style={{
              ...styles.filterButton,
              ...(priority === item ? styles.filterActive : {})
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>
          Carregando quadro de produção...
        </div>
      ) : (
        <div style={styles.board}>
          {stages.map((stage, stageIndex) => {
            const stageOrders = ordersByStage(stage);

            return (
              <div style={styles.column} key={stage}>
                <div style={styles.columnHeader}>
                  <div>
                    <strong>{stage}</strong>
                    <small>
                      {stageOrders.length} ordem
                      {stageOrders.length !== 1 ? 's' : ''}
                    </small>
                  </div>

                  <span style={styles.count}>
                    {stageOrders.length}
                  </span>
                </div>

                <div style={styles.cards}>
                  {stageOrders.length === 0 && (
                    <div style={styles.empty}>
                      Nenhuma ordem
                    </div>
                  )}

                  {stageOrders.map((order) => {
                    const numero =
                      order.order_number ||
                      order.numero ||
                      order.id;

                    const quantidade =
                      Number(
                        order.quantity ??
                        order.quantidade ??
                        0
                      );

                    const produzido =
                      Number(
                        order.produced_quantity ??
                        order.quantidade_produzida ??
                        0
                      );

                    const p =
                      order.priority ||
                      order.prioridade ||
                      'Media';

                    return (
                      <div style={styles.card} key={order.id}>
                        <div style={styles.cardTop}>
                          <strong>OP #{numero}</strong>

                          <span
                            style={{
                              ...styles.priority,
                              ...(priorityStyles[prioridadeClass(p)] ||
                                {})
                            }}
                          >
                            {p}
                          </span>
                        </div>

                        <div style={styles.product}>
                          {order.product_name ||
                            order.produto ||
                            'Produto não informado'}
                        </div>

                        {order.sku && (
                          <div style={styles.info}>
                            SKU: {order.sku}
                          </div>
                        )}

                        {order.client && (
                          <div style={styles.info}>
                            Cliente: {order.client}
                          </div>
                        )}

                        <div style={styles.quantity}>
                          <span>Quantidade</span>
                          <strong>{quantidade}</strong>
                        </div>

                        <div style={styles.progress}>
                          <div
                            style={{
                              ...styles.progressBar,
                              width: `${
                                quantidade > 0
                                  ? Math.min(
                                      100,
                                      (produzido / quantidade) * 100
                                    )
                                  : 0
                              }%`
                            }}
                          />
                        </div>

                        <div style={styles.progressText}>
                          Produzido: {produzido} / {quantidade}
                        </div>

                        <div style={styles.cardActions}>
                          <button
                            style={styles.smallButton}
                            disabled={stageIndex === 0 || saving}
                            onClick={() =>
                              moveOrder(order, -1)
                            }
                            title="Etapa anterior"
                          >
                            ←
                          </button>

                          <button
                            style={styles.deleteButton}
                            disabled={saving}
                            onClick={() => deleteOrder(order)}
                            title="Excluir ordem"
                          >
                            Excluir
                          </button>

                          <button
                            style={styles.smallButton}
                            disabled={
                              stageIndex === stages.length - 1 ||
                              saving
                            }
                            onClick={() =>
                              moveOrder(order, 1)
                            }
                            title="Próxima etapa"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2>Nova ordem de produção</h2>

              <button
                style={styles.closeButton}
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={createOrder}>
              <label style={styles.label}>
                Produto
                <input
                  style={styles.input}
                  value={form.product_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      product_name: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label style={styles.label}>
                SKU
                <input
                  style={styles.input}
                  value={form.sku}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sku: e.target.value
                    })
                  }
                />
              </label>

              <label style={styles.label}>
                Cliente
                <input
                  style={styles.input}
                  value={form.client}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      client: e.target.value
                    })
                  }
                />
              </label>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    style={styles.input}
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quantity: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <label style={styles.label}>
                  Prioridade
                  <select
                    style={styles.input}
                    value={form.priority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priority: e.target.value
                      })
                    }
                  >
                    <option>Baixa</option>
                    <option>Media</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </label>
              </div>

              <label style={styles.label}>
                Etapa inicial
                <select
                  style={styles.input}
                  value={form.current_stage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      current_stage: e.target.value
                    })
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Entrega prevista
                <input
                  type="date"
                  style={styles.input}
                  value={form.expected_delivery}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      expected_delivery: e.target.value
                    })
                  }
                />
              </label>

              <label style={styles.label}>
                Observações
                <textarea
                  style={{
                    ...styles.input,
                    minHeight: 90,
                    resize: 'vertical'
                  }}
                  value={form.observations}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      observations: e.target.value
                    })
                  }
                />
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Criar ordem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showStageModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2>{editingStage ? 'Editar Setor' : 'Novo Setor'}</h2>
              <button
                style={styles.closeButton}
                onClick={() => setShowStageModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={salvarSetor}>
              <label style={styles.label}>
                Nome do setor
                <input
                  style={styles.input}
                  value={stageForm.nome}
                  onChange={(e) =>
                    setStageForm({ ...stageForm, nome: e.target.value })
                  }
                  required
                  autoFocus
                />
              </label>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Cor
                  <input
                    type="color"
                    style={{ ...styles.input, height: 45, padding: 4 }}
                    value={stageForm.cor}
                    onChange={(e) =>
                      setStageForm({ ...stageForm, cor: e.target.value })
                    }
                  />
                </label>

                <label style={styles.label}>
                  Ordem
                  <input
                    type="number"
                    min="1"
                    style={styles.input}
                    value={stageForm.ordem}
                    onChange={(e) =>
                      setStageForm({ ...stageForm, ordem: Number(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div style={styles.modalActions}>
                {editingStage && (
                  <button
                    type="button"
                    style={{ ...styles.secondaryButton, marginRight: 'auto', color: '#dc2626', borderColor: '#dc2626' }}
                    onClick={() => {
                      setShowStageModal(false);
                      excluirSetor(editingStage);
                    }}
                    disabled={saving}
                  >
                    Desativar Setor
                  </button>
                )}
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setShowStageModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : (editingStage ? 'Salvar' : 'Criar Setor')}
                </button>
              </div>
            </form>

            {stagesFull.length > 0 && (
              <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                  Setores existentes ({stagesFull.filter(s => s.ativo).length} ativos):
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stagesFull.filter(s => s.ativo).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => abrirModalEditarSetor(s)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid ' + (s.cor || '#cbd5e1'),
                        background: (s.cor || '#cbd5e1') + '20',
                        color: '#0f172a',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                      title="Clique para editar"
                    >
                      {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          style={{ ...styles.overlay, zIndex: 1000, cursor: 'zoom-out' }}
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoom"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  setorButton: {
    padding: '9px 16px',
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer'
  },
  cardImageWrapper: {
    width: '100%',
    height: 120,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    cursor: 'zoom-in',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  page: {
    minHeight: '100vh',
    padding: '24px',
    background: '#f4f6f8',
    color: '#1f2937',
    boxSizing: 'border-box'
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 28
  },

  system: {
    fontSize: 13,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1
  },

  title: {
    margin: '3px 0',
    fontSize: 30
  },

  creator: {
    color: '#64748b',
    fontSize: 13
  },

  headerActions: {
    display: 'flex',
    gap: 10
  },

  moduleTitle: {
    marginBottom: 22
  },

  moduleTitleH2: {
    margin: 0
  },

  primaryButton: {
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },

  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '10px 16px',
    background: '#fff',
    color: '#334155',
    fontWeight: 700,
    cursor: 'pointer'
  },

  error: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
    gap: 14,
    marginBottom: 20
  },

  statCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,.05)'
  },

  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 18
  },

  filterLabel: {
    fontWeight: 700,
    marginRight: 4
  },

  filterButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: 20,
    padding: '7px 13px',
    cursor: 'pointer'
  },

  filterActive: {
    background: '#1e293b',
    color: '#fff',
    borderColor: '#1e293b'
  },

  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(270px, 1fr))',
    gap: 12,
    overflowX: 'auto',
    alignItems: 'start',
    paddingBottom: 16
  },

  column: {
    background: '#e9eef3',
    borderRadius: 10,
    minHeight: 420,
    padding: 10
  },

  columnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 6px 12px'
  },

  count: {
    minWidth: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    background: '#fff',
    fontWeight: 700
  },

  cards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },

  card: {
    background: '#fff',
    borderRadius: 9,
    padding: 13,
    border: '1px solid #dbe3ea',
    boxShadow: '0 2px 5px rgba(0,0,0,.05)'
  },

  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center'
  },

  priority: {
    fontSize: 11,
    padding: '4px 7px',
    borderRadius: 10,
    fontWeight: 700
  },

  product: {
    marginTop: 10,
    fontWeight: 700,
    minHeight: 38
  },

  info: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },

  quantity: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 12,
    fontSize: 12
  },

  progress: {
    height: 6,
    background: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 7
  },

  progressBar: {
    height: '100%',
    background: '#2563eb',
    transition: 'width .2s'
  },

  progressText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 5
  },

  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12
  },

  smallButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: 6,
    padding: '5px 10px',
    cursor: 'pointer',
    fontWeight: 700
  },

  deleteButton: {
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    borderRadius: 6,
    padding: '5px 9px',
    cursor: 'pointer'
  },

  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 20,
    fontSize: 12
  },

  loading: {
    background: '#fff',
    borderRadius: 10,
    padding: 40,
    textAlign: 'center'
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 9999
  },

  modal: {
    background: '#fff',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 12,
    padding: 22
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },

  closeButton: {
    border: 0,
    background: 'transparent',
    fontSize: 28,
    cursor: 'pointer'
  },

  label: {
    display: 'block',
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 12
  },

  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 5,
    padding: 10,
    border: '1px solid #cbd5e1',
    borderRadius: 7,
    fontSize: 14
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20
  }
};

const priorityStyles = {
  urgent: {
    background: '#fee2e2',
    color: '#b91c1c'
  },
  high: {
    background: '#ffedd5',
    color: '#c2410c'
  },
  medium: {
    background: '#fef3c7',
    color: '#92400e'
  },
  low: {
    background: '#dcfce7',
    color: '#166534'
  }
};




