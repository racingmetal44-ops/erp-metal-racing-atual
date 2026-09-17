const API = '/api/pcp';

const DEFAULT_STAGES = [
  'Recebido',
  'Corte a Laser',
  'Dobra',
  'Solda',
  'Lixamento',
  'QuÃ­mico',
  'Pintura',
  'Montagem',
  'InspeÃ§Ã£o de Qualidade',
  'Embalagem',
  'ExpediÃ§Ã£o',
  'Entregue'
];

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error ||
      data.message ||
      data.xMotivo ||
      `Erro HTTP ${response.status}`
    );
  }

  return data;
}

export const pcpService = {

  stages: DEFAULT_STAGES,

  async getOrders() {
    const data = await request('/orders');
    return data.orders || data.data || [];
  },

  async getStats() {
    const data = await request('/stats');
    return data.stats || data.data || data || {};
  },

  async getStages() {
    try {
      const data = await request('/stages');
      const stages = data.stages || data.data || [];

      if (Array.isArray(stages) && stages.length > 0) {
        this.stages = stages;
        return stages;
      }
    } catch (error) {
      console.warn('NÃ£o foi possÃ­vel carregar etapas:', error.message);
    }

    return this.stages;
  },

  async createOrder(orderData) {
    const payload = {
      ...orderData,
      product_name:
        orderData.product_name ||
        orderData.productName ||
        orderData.produto_nome ||
        '',
      sku:
        orderData.sku ||
        '',
      client:
        orderData.client ||
        '',
      quantity:
        Number(
          orderData.quantity ??
          orderData.quantidade ??
          0
        ),
      priority:
        orderData.priority ||
        orderData.prioridade ||
        'Media',
      current_stage:
        orderData.current_stage ||
        orderData.currentStage ||
        orderData.setor_inicial ||
        this.stages[0],
      expected_delivery:
        orderData.expected_delivery ||
        orderData.expectedDelivery ||
        orderData.data_prevista ||
        null,
      observations:
        orderData.observations ??
        orderData.observacao ??
        orderData.observacoes ??
        '',
      product_id:
        orderData.product_id ||
        orderData.productId ||
        orderData.produto_id ||
        null
    };

    const data = await request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return data.order || data.data || data;
  },

  async updateOrder(orderId, updateData) {
    const data = await request(`/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    return data.order || data.data || data;
  },

  async updateStage(orderId, stage) {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}/stage`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          stage,
          current_stage: stage
        })
      }
    );

    return data.order || data.data || data;
  },

  async advanceStage(orderId, stage) {
    const index = this.stages.indexOf(stage);

    if (index < 0) {
      throw new Error(`Etapa invÃ¡lida: ${stage}`);
    }

    const nextStage =
      this.stages[index + 1] ||
      'Entregue';

    return this.updateStage(orderId, nextStage);
  },

  async addMovement(orderId, stage, description) {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}/movements`,
      {
        method: 'POST',
        body: JSON.stringify({
          stage,
          description
        })
      }
    );

    return data.movement || data.data || data;
  },

  async getMovements(orderId) {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}/movements`
    );

    return data.movements || data.data || [];
  },

  async getApontamentos(orderId) {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}/apontamentos`
    );

    return data.apontamentos || data.data || [];
  },

  async addApontamento(apontamento) {
    const data = await request('/apontamentos', {
      method: 'POST',
      body: JSON.stringify(apontamento)
    });

    return data.apontamento || data.data || data;
  },

  async updateApontamento(id, payload) {
    const data = await request(
      `/apontamentos/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );

    return data.apontamento || data.data || data;
  },

  async deleteOrder(orderId) {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'DELETE'
      }
    );

    return data;
  },

  async getOperators() {
    const data = await request('/operadores');
    return data.operadores || data.operators || data.data || [];
  },
  // ============================================================
  // CRUD DE SETORES - METAL RACING
  // ============================================================

  async getStagesFull() {
    const data = await request('/stages/full');
    return data.stages || data.data || [];
  },

  async criarSetor({ nome, cor, ordem, icone }) {
    const data = await request('/stages', {
      method: 'POST',
      body: JSON.stringify({ nome, cor, ordem, icone })
    });
    return data.stage || data.data || data;
  },

  async editarSetor(id, { nome, cor, ordem, icone, ativo }) {
    const data = await request(`/stages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ nome, cor, ordem, icone, ativo })
    });
    return data.stage || data.data || data;
  },

  async excluirSetor(id) {
    const data = await request(`/stages/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return data;
  },

  // ============================================================
  // FIM CRUD DE SETORES
  // ============================================================
};

export default pcpService;
