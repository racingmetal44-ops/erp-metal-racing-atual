// Serviço de integração com Mercado Livre
export const mercadoLivreService = {
  async sendOrder(orderData) {
    try {
      const mlOrder = {
        order_id: orderData.order_number || 'PED-' + Date.now(),
        buyer: {
          name: orderData.client_name || 'Cliente não informado',
          email: orderData.client_email || '',
          phone: orderData.client_phone || '',
          address: orderData.shipping_address || ''
        },
        items: (orderData.items || []).map(item => ({
          id: item.sku || 'SEM-SKU',
          title: item.product_name || 'Produto',
          quantity: item.quantity || 1,
          unit_price: item.price || 0
        })),
        observations: orderData.observations || ''
      };

      console.log('?? Enviando para Mercado Livre:', mlOrder);

      return {
        success: true,
        message: 'Pedido enviado para Mercado Livre com sucesso!',
        data: mlOrder
      };
    } catch (error) {
      console.error('Erro ao enviar para Mercado Livre:', error);
      throw error;
    }
  }
};
