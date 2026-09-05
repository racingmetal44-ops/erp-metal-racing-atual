// Serviço de integração com Shopee
export const shopeeService = {
  async sendOrder(orderData) {
    try {
      const shopeeOrder = {
        order_id: orderData.order_number || 'PED-' + Date.now(),
        recipient: {
          name: orderData.client_name || 'Cliente não informado',
          address: orderData.shipping_address || '',
          phone: orderData.client_phone || '',
          email: orderData.client_email || ''
        },
        items: (orderData.items || []).map(item => ({
          item_id: item.sku || 'SEM-SKU',
          item_name: item.product_name || 'Produto',
          quantity: item.quantity || 1,
          price: item.price || 0
        })),
        notes: orderData.observations || ''
      };

      console.log('?? Enviando para Shopee:', shopeeOrder);

      return {
        success: true,
        message: 'Pedido enviado para Shopee com sucesso!',
        data: shopeeOrder
      };
    } catch (error) {
      console.error('Erro ao enviar para Shopee:', error);
      throw error;
    }
  }
};
