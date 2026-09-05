import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pcpService } from '../services/pcpService';
import { useToast } from '../../hooks/useToast';

const PCPContext = createContext();

export const usePCPContext = () => {
  const context = useContext(PCPContext);
  if (!context) {
    throw new Error('usePCPContext must be used within PCPProvider');
  }
  return context;
};

export const PCPProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [stages, setStages] = useState([
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
  ]);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        pcpService.getOrders(),
        pcpService.getStats()
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (error) {
      showToast('Erro ao carregar dados do PCP', 'error');
      console.error('PCP load error:', error);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const refreshData = useCallback(() => {
    loadData();
  }, [loadData]);

  const createOrder = useCallback(async (orderData) => {
    setLoading(true);
    try {
      const newOrder = await pcpService.createOrder(orderData);
      setOrders(prev => [newOrder, ...prev]);
      showToast('Ordem de Produção criada com sucesso!', 'success');
      refreshData();
      return newOrder;
    } catch (error) {
      showToast('Erro ao criar OP', 'error');
      console.error('Create order error:', error);
    } finally {
      setLoading(false);
    }
  }, [showToast, refreshData]);

  const updateOrder = useCallback(async (orderId, updateData) => {
    setLoading(true);
    try {
      const updated = await pcpService.updateOrder(orderId, updateData);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      showToast('OP atualizada com sucesso!', 'success');
      refreshData();
      return updated;
    } catch (error) {
      showToast('Erro ao atualizar OP', 'error');
      console.error('Update order error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrder, showToast, refreshData]);

  const advanceStage = useCallback(async (orderId, stage) => {
    setLoading(true);
    try {
      const updated = await pcpService.advanceStage(orderId, stage);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      showToast(Etapa "" finalizada com sucesso!, 'success');
      refreshData();
      return updated;
    } catch (error) {
      showToast('Erro ao avançar etapa', 'error');
      console.error('Advance stage error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrder, showToast, refreshData]);

  const updateStageConfig = useCallback(async (newStages) => {
    setLoading(true);
    try {
      await pcpService.updateStageConfig(newStages);
      setStages(newStages);
      showToast('Etapas atualizadas com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao atualizar etapas', 'error');
      console.error('Update stages error:', error);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const value = {
    orders,
    selectedOrder,
    setSelectedOrder,
    loading,
    stats,
    stages,
    refreshData,
    createOrder,
    updateOrder,
    advanceStage,
    updateStageConfig
  };

  return (
    <PCPContext.Provider value={value}>
      {children}
    </PCPContext.Provider>
  );
};
