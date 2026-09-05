import { supabase } from '../../lib/supabase';

export const pcpService = {
  // Buscar todas as OP
  async getOrders() {
    const { data, error } = await supabase
      .from('production_orders')
      .select(
        *,
        product:product_id (*),
        stages:production_stages (*),
        movements:production_movements (*)
      )
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Buscar estatésticas
  async getStats() {
    const { data, error } = await supabase
      .from('production_stats')
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar nova OP
  async createOrder(orderData) {
    // Gerar número da OP automaticamente
    const { data: lastOrder } = await supabase
      .from('production_orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1);
    
    const nextNumber = lastOrder && lastOrder.length > 0 
      ? parseInt(lastOrder[0].order_number) + 1 
      : 1000;
    
    const newOrder = {
      ...orderData,
      order_number: nextNumber.toString(),
      status: 'Aguardando Produção',
      current_stage: 'Recebido',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('production_orders')
      .insert([newOrder])
      .select()
      .single();
    
    if (error) throw error;
    
    // Registrar movimento inicial
    await this.addMovement(data.id, 'Recebido', 'Início da produção');
    
    return data;
  },

  // Atualizar OP
  async updateOrder(orderId, updateData) {
    const { data, error } = await supabase
      .from('production_orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Avançar etapa
  async advanceStage(orderId, stage) {
    const { data: order } = await supabase
      .from('production_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    const stageIndex = this.stages.indexOf(stage);
    const nextStage = this.stages[stageIndex + 1];
    
    // Registrar movimento
    await this.addMovement(orderId, stage, Finalizado: );
    
    // Atualizar ordem
    const updateData = {
      current_stage: nextStage || 'Finalizado',
      status: nextStage ? 'Em Produção' : 'Finalizado',
      updated_at: new Date().toISOString()
    };
    
    if (!nextStage) {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('production_orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Adicionar movimento
  async addMovement(orderId, stage, description) {
    const movement = {
      order_id: orderId,
      stage,
      description,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('production_movements')
      .insert([movement]);
    
    if (error) throw error;
  },

  // Atualizar configuração de etapas
  async updateStageConfig(newStages) {
    const { error } = await supabase
      .from('system_config')
      .update({ value: newStages })
      .eq('key', 'production_stages');
    
    if (error) throw error;
  },

  // Buscar etapas
  async getStages() {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'production_stages')
      .single();
    
    if (error) return [
      'Recebido', 'Corte a Laser', 'Dobra', 'Solda', 'Lixamento',
      'Químico', 'Pintura', 'Montagem', 'Inspeção de Qualidade',
      'Embalagem', 'Expedição', 'Entregue'
    ];
    
    return data?.value || [];
  }
};

// Constante de etapas padrão
pcpService.stages = [
  'Recebido', 'Corte a Laser', 'Dobra', 'Solda', 'Lixamento',
  'Químico', 'Pintura', 'Montagem', 'Inspeção de Qualidade',
  'Embalagem', 'Expedição', 'Entregue'
];
