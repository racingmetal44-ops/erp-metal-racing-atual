// Serviço de integração com Bling
export const blingService = {
  async sendOrder(orderData) {
    try {
      // Dados formatados para o Bling
      const blingOrder = {
        numero: orderData.order_number || 'PED-' + Date.now(),
        data: new Date().toISOString().split('T')[0],
        cliente: {
          nome: orderData.client_name || 'Cliente não informado',
          email: orderData.client_email || '',
          telefone: orderData.client_phone || '',
          endereco: orderData.shipping_address || ''
        },
        itens: (orderData.items || []).map(item => ({
          codigo: item.sku || 'SEM-SKU',
          descricao: item.product_name || 'Produto',
          quantidade: item.quantity || 1,
          valor_unitario: item.price || 0
        })),
        observacoes: orderData.observations || ''
      };

      console.log('?? Enviando para Bling:', blingOrder);

      // Simular envio (substituir pela chamada real depois)
      return {
        success: true,
        message: 'Pedido enviado para Bling com sucesso!',
        data: blingOrder
      };
    } catch (error) {
      console.error('Erro ao enviar para Bling:', error);
      throw error;
    }
  }
};
