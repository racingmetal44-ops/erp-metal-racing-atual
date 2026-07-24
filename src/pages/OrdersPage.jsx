import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { blingService } from './Orders/services/blingService';
import { shopeeService } from './Orders/services/shopeeService';
import { mercadoLivreService } from './Orders/services/mercadoLivreService';
import styles from './Orders/Orders.module.css';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    order_number: '',
    client_name: '',
    marketplace: '',
    observations: '',
    items: [{ product_name: '', sku: '', quantity: 1, price: 0 }]
  });

  // Buscar pedidos
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Criar pedido
  const createOrder = async (e) => {
    e.preventDefault();
    try {
      const orderToCreate = {
        ...newOrder,
        order_number: newOrder.order_number || 'PED-' + Date.now(),
        status: 'Pendente',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([orderToCreate])
        .select();

      if (error) throw error;

      setShowModal(false);
      setNewOrder({
        order_number: '',
        client_name: '',
        marketplace: '',
        observations: '',
        items: [{ product_name: '', sku: '', quantity: 1, price: 0 }]
      });
      
      fetchOrders();
      alert('✅ Pedido criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      alert('❌ Erro ao criar pedido');
    }
  };

  // Integrar com Bling
  const integrarBling = async (order) => {
    try {
      const result = await blingService.sendOrder(order);
      if (result.success) {
        await supabase
          .from('orders')
          .update({ 
            bling_integrated: true,
            status: 'Enviado para Bling'
          })
          .eq('id', order.id);
        
        fetchOrders();
        alert('✅ Pedido integrado com Bling com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao integrar com Bling:', error);
      alert('❌ Erro ao integrar com Bling');
    }
  };

  // Integrar com Shopee
  const integrarShopee = async (order) => {
    try {
      const result = await shopeeService.sendOrder(order);
      if (result.success) {
        await supabase
          .from('orders')
          .update({ 
            shopee_integrated: true,
            status: 'Enviado para Shopee'
          })
          .eq('id', order.id);
        
        fetchOrders();
        alert('✅ Pedido integrado com Shopee com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao integrar com Shopee:', error);
      alert('❌ Erro ao integrar com Shopee');
    }
  };

  // Integrar com Mercado Livre
  const integrarMercadoLivre = async (order) => {
    try {
      const result = await mercadoLivreService.sendOrder(order);
      if (result.success) {
        await supabase
          .from('orders')
          .update({ 
            ml_integrated: true,
            status: 'Enviado para Mercado Livre'
          })
          .eq('id', order.id);
        
        fetchOrders();
        alert('✅ Pedido integrado com Mercado Livre com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao integrar com Mercado Livre:', error);
      alert('❌ Erro ao integrar com Mercado Livre');
    }
  };

  // Verificar integrações
  const getIntegrations = (order) => {
    const integrations = [];
    if (order.bling_integrated) integrations.push({ name: 'Bling', color: '#0d6efd' });
    if (order.shopee_integrated) integrations.push({ name: 'Shopee', color: '#ee4d2d' });
    if (order.ml_integrated) integrations.push({ name: 'Mercado Livre', color: '#ffe600' });
    return integrations;
  };

  // Filtrar pedidos
  const filteredOrders = orders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      (order.order_number?.toString() || '').includes(search) ||
      (order.client_name?.toLowerCase() || '').includes(search) ||
      (order.marketplace?.toLowerCase() || '').includes(search)
    );
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const statusColors = {
    'Pendente': '#ffc107',
    'Enviado para Bling': '#0d6efd',
    'Enviado para Shopee': '#ee4d2d',
    'Enviado para Mercado Livre': '#ffe600',
    'Entregue': '#28a745',
    'Cancelado': '#dc3545'
  };

  return (
    <div className={styles.ordersContainer}>
      <div className={styles.ordersHeader}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.headerTitle}>📦 Pedidos</h1>
            <p className={styles.headerSubtitle}>Gerencie seus pedidos e integrações com marketplaces</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
              ➕ Novo Pedido
            </button>
            <button className={styles.btnRefresh} onClick={fetchOrders}>
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Buscar por pedido, cliente ou marketplace..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}>⏳</div>
          <p>Carregando pedidos...</p>
        </div>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h3 className={styles.emptyTitle}>Nenhum pedido encontrado</h3>
              <p className={styles.emptyText}>
                {searchTerm ? 'Tente buscar com outros termos' : 'Clique em "Novo Pedido" para criar seu primeiro pedido'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className={styles.orderCard} style={{ borderLeftColor: statusColors[order.status] || '#6c757d' }}>
                <div className={styles.orderHeader}>
                  <div>
                    <h3 className={styles.orderNumber}># {order.order_number}</h3>
                    <span className={styles.badge} style={{ background: statusColors[order.status] || '#6c757d' }}>
                      {order.status || 'Pendente'}
                    </span>
                    {order.marketplace && (
                      <span style={{ marginLeft: '8px', fontSize: '14px', color: '#64748b' }}>
                        📱 {order.marketplace}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <div className={styles.orderInfo}>
                  <span>👤 <strong>Cliente:</strong> {order.client_name}</span>
                  <span>📧 {order.client_email}</span>
                  <span>📞 {order.client_phone}</span>
                  <span>📍 {order.shipping_address}</span>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className={styles.orderItems}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className={styles.orderItem}>
                        <span>{item.quantity}x {item.product_name}</span>
                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {getIntegrations(order).map((integ, idx) => (
                    <span key={idx} className={styles.integrationBadge} style={{ background: integ.color }}>
                      {integ.name}
                    </span>
                  ))}
                </div>

                <div className={styles.orderActions}>
                  <button className={styles.btnBling} onClick={() => integrarBling(order)}>
                    🔵 Bling
                  </button>
                  <button className={styles.btnShopee} onClick={() => integrarShopee(order)}>
                    🟠 Shopee
                  </button>
                  <button className={styles.btnML} onClick={() => integrarMercadoLivre(order)}>
                    🟡 Mercado Livre
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Modal Novo Pedido */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📝 Novo Pedido</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createOrder}>
              <div className={styles.formGroup}>
                <label>Número do Pedido</label>
                <input
                  type="text"
                  value={newOrder.order_number}
                  onChange={(e) => setNewOrder({...newOrder, order_number: e.target.value})}
                  placeholder="Ex: PED-001"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Cliente *</label>
                <input
                  type="text"
                  required
                  value={newOrder.client_name}
                  onChange={(e) => setNewOrder({...newOrder, client_name: e.target.value})}
                  placeholder="Nome do cliente"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Marketplace</label>
                <select
                  value={newOrder.marketplace}
                  onChange={(e) => setNewOrder({...newOrder, marketplace: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Selecione...</option>
                  <option value="Bling">🔵 Bling</option>
                  <option value="Shopee">🟠 Shopee</option>
                  <option value="Mercado Livre">🟡 Mercado Livre</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Observações</label>
                <textarea
                  value={newOrder.observations}
                  onChange={(e) => setNewOrder({...newOrder, observations: e.target.value})}
                  placeholder="Observações adicionais"
                  rows="3"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  ✅ Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
