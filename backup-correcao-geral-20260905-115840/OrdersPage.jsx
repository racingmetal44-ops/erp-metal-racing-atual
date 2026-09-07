import { useEffect, useState } from 'react';
import { 
  ShoppingBag, Search, Printer, Download, 
  ChevronDown, ChevronRight, Package, Truck,
  DollarSign, Calendar, User, Store,
  CreditCard, MapPin, Tag, Percent
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  // === VALORES FIXOS ===
  const FIXOS = {
    cest: '01.026.00',
    ncm: '8302.30.00',
    origem: '0 - Nacional',
    csosn: '102 - Tributada sem permissão de crédito',
    cfop: '6107',
    taxaMarketplace: 17.00,
    taxaFretePercent: 13.53
  };

  const MARKETPLACE_META = {
    shopee: {
      label: 'Shopee',
      icon: '???',
      badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300'
    },
    mercadoLivre: {
      label: 'Mercado Livre',
      icon: '????',
      badge: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
    },
    tiktok: {
      label: 'TikTok',
      icon: '??',
      badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300'
    }
  };

  function getMarketplaceSource(order) {
    const sourceText = `${order.origem_canal || ''} ${order.loja || ''} ${order.tipo_integracao || ''}`.toLowerCase();
    if (sourceText.includes('shopee')) return 'shopee';
    if (sourceText.includes('mercado livre') || sourceText.includes('mercado')) return 'mercadoLivre';
    if (sourceText.includes('tiktok') || sourceText.includes('tik tok')) return 'tiktok';
    return null;
  }

  function getMarketplaceBadge(order) {
    const source = getMarketplaceSource(order);
    return source ? MARKETPLACE_META[source] : null;
  }

  function parseOrderDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && value.includes('/')) {
      const [datePart, timePart] = value.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hour = '00', minute = '00', second = '00'] = (timePart || '00:00:00').split(':');
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isNewOrder(order) {
    const parsed = parseOrderDate(order.data_cadastro || order.created_at || order.data_venda);
    if (!parsed) return false;
    const diffMs = Date.now() - parsed.getTime();
    return diffMs <= 24 * 60 * 60 * 1000;
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      setOrders(getExampleOrders());
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }

  function getExampleOrders() {
    const baseOrder = {
      numero_loja_virtual: '2000014301017385',
      cliente: 'Erinton Luis Machado (erin_geo)',
      vendedor: 'Loja',
      unidade_negocio: 'Matriz',
      data_cadastro: '07/08/2026 08:56:21',
      data_venda: '07/08/2026',
      data_saida: '07/08/2026',
      data_prevista: '09/08/2026',
      items: [{
        id: 1,
        descricao: 'Soleira Aço Inox Premium Ram Dakota Inox Natural',
        codigo: 'S-2286',
        unidade: 'UN',
        quantidade: 1.00000000,
        preco_lista: 153.39000000,
        desconto: 0.00,
        preco_unitario: 153.39000000,
        preco_total: 153.39
      }],
      totais: {
        n_itens: 1,
        soma_quantidades: 1.00,
        desconto: 0.00,
        prazo_entrega: 0,
        outras_despesas: 0.00,
        desconto_total_venda: 0.00,
        total_comissoes: 0.00,
        desconto_total_itens: 0.00,
        total_itens: 153.39,
        total_venda: 153.39
      },
      marketplace: {
        valor_base: 153.39,
        taxa_marketplace: 26.08,
        taxa_marketplace_percent: 17.00,
        custo_frete: 20.75,
        custo_frete_percent: 13.53,
        total_comissoes_percent: 30.53,
        valor_liquido: 106.56
      },
      pagamento: {
        condicao: '30',
        valor: 153.39,
        data_vencimento: '31/08/2026',
        metodo: 'pix'
      },
      transportador: {
        nome: 'Logística Mercado Envios - 01',
        frete_por_conta: '0 - Contratação do Frete por conta do Remetente (CIF)',
        quantidade: 1,
        peso_bruto: 0.000,
        frete: 0.00,
        id_servico: '100009_206016134',
        tracking: 'N/A'
      },
      endereco_entrega: {
        nome: 'Erinton Luís Machado',
        cep: '84500011',
        uf: 'PR',
        cidade: 'Irati',
        bairro: 'Centro',
        endereco: 'Rua Professor Vitor Ferreira Do Amaral',
        numero: '32',
        complemento: 'Casa Referencia: Clinica Odonto Life'
      }
    };

    return [
      {
        ...baseOrder,
        id: 75267,
        numero: '75267',
        loja: 'XCOMPETITION - Mercado Livre',
        tipo_integracao: 'MercadoLivre',
        origem_canal: 'Mercado Livre'
      },
      {
        ...baseOrder,
        id: 75268,
        numero: '75268',
        cliente: 'Maria Silva (maria.s)',
        numero_loja_virtual: '2000014301017386',
        loja: 'XCOMPETITION - Shopee',
        tipo_integracao: 'Shopee',
        origem_canal: 'Shopee',
        data_cadastro: '07/08/2026 10:12:45',
        data_venda: '07/08/2026',
        data_saida: '07/08/2026',
        data_prevista: '09/08/2026',
        transportador: {
          ...baseOrder.transportador,
          nome: 'Shopee Xpress'
        }
      },
      {
        ...baseOrder,
        id: 75269,
        numero: '75269',
        cliente: 'João Pereira (joao)',
        numero_loja_virtual: '2000014301017387',
        loja: 'XCOMPETITION - TikTok',
        tipo_integracao: 'TikTok',
        origem_canal: 'TikTok',
        data_cadastro: '07/08/2026 11:45:10',
        data_venda: '07/08/2026',
        data_saida: '07/08/2026',
        data_prevista: '10/08/2026',
        transportador: {
          ...baseOrder.transportador,
          nome: 'TikTok Logistics'
        }
      }
    ];
  }

  const filteredOrders = orders.filter(function(order) {
    var term = search.toLowerCase();
    return (
      order.numero?.toLowerCase().includes(term) ||
      order.cliente?.toLowerCase().includes(term) ||
      order.numero_loja_virtual?.includes(term)
    );
  });

  const newOrdersBySource = orders.reduce(function(acc, order) {
    const source = getMarketplaceSource(order);
    if (source && isNewOrder(order)) {
      acc[source] = (acc[source] || 0) + 1;
    }
    return acc;
  }, { shopee: 0, mercadoLivre: 0, tiktok: 0 });

  function toggleExpand(id) {
    var newSet = new Set(expandedOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedOrders(newSet);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  function formatNumber(value, decimals) {
    return Number(value || 0).toFixed(decimals || 2);
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Vendas</p>
        <h1 className="mt-2 text-3xl font-semibold">Pedidos de Venda</h1>
        <p className="mt-2 text-sm text-slate-400">Consulta e visualização de pedidos de venda integrados.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { key: 'shopee', label: 'Shopee', icon: '???', count: newOrdersBySource.shopee },
            { key: 'mercadoLivre', label: 'Mercado Livre', icon: '????', count: newOrdersBySource.mercadoLivre },
            { key: 'tiktok', label: 'TikTok', icon: '??', count: newOrdersBySource.tiktok }
          ].map(function(item) {
            return (
              <div key={item.key} className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
                <span className="mr-2">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 rounded-full bg-slate-950/70 px-2 py-0.5 text-xs text-white">
                  {item.count} novo{item.count === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Busca */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Buscar por pedido, cliente ou NF..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800">
              <Printer size={16} className="inline mr-2" />
              Imprimir
            </button>
            <button className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800">
              <Download size={16} className="inline mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">
            Carregando pedidos...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">
            Nenhum pedido encontrado.
          </div>
        ) : (
          filteredOrders.map(function(order) {
            return (
              <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                {/* Resumo do Pedido */}
                <div 
                  className="flex cursor-pointer items-center justify-between p-6 transition hover:bg-slate-800/30"
                  onClick={function() { toggleExpand(order.id); }}
                >
                  <div className="flex items-center gap-4">
                    <ShoppingBag size={24} className="text-orange-400" />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-white">
                          Pedido {order.numero}
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                          #{order.numero_loja_virtual}
                        </span>
                        <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-300">
                          {order.tipo_integracao}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {order.cliente} . {order.data_venda} . {formatCurrency(order.totais.total_venda)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getMarketplaceBadge(order) && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${getMarketplaceBadge(order).badge}`}>
                        <span>{getMarketplaceBadge(order).icon}</span>
                        <span>{getMarketplaceBadge(order).label}</span>
                      </span>
                    )}
                    {isNewOrder(order) && (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                        Novo
                      </span>
                    )}
                    <button 
                      className="rounded-xl border border-slate-700 p-2 transition hover:border-orange-500/60"
                      onClick={function(e) { e.stopPropagation(); }}
                    >
                      <Printer size={16} className="text-slate-400" />
                    </button>
                    <button 
                      className="rounded-xl border border-slate-700 p-2 transition hover:border-orange-500/60"
                      onClick={function(e) { e.stopPropagation(); }}
                    >
                      <Download size={16} className="text-slate-400" />
                    </button>
                    {expandedOrders.has(order.id) ? (
                      <ChevronDown size={20} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Detalhes Expandidos */}
                {expandedOrders.has(order.id) && (
                  <div className="border-t border-slate-800 p-6 space-y-6">

                    {/* Dados do Cliente */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Cliente</p>
                        <p className="text-sm text-white">{order.cliente}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Vendedor</p>
                        <p className="text-sm text-white">{order.vendedor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Loja</p>
                        <p className="text-sm text-white">{order.loja}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Unidade de Negécio</p>
                        <p className="text-sm text-white">{order.unidade_negocio}</p>
                      </div>
                    </div>

                    {/* Itens do Pedido */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Itens do Pedido</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                              <th className="pb-2">Descrição</th>
                              <th className="pb-2">Código</th>
                              <th className="pb-2">UN</th>
                              <th className="pb-2 text-right">Quantidade</th>
                              <th className="pb-2 text-right">Preéo Lista</th>
                              <th className="pb-2 text-right">Desc %</th>
                              <th className="pb-2 text-right">Preéo Un</th>
                              <th className="pb-2 text-right">Preéo Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(function(item, index) {
                              return (
                                <tr key={item.id || index} className="border-b border-slate-800/50">
                                  <td className="py-3 text-white">{item.descricao}</td>
                                  <td className="py-3 text-white">{item.codigo}</td>
                                  <td className="py-3 text-white">{item.unidade}</td>
                                  <td className="py-3 text-right text-white">{formatNumber(item.quantidade, 8)}</td>
                                  <td className="py-3 text-right text-white">{formatNumber(item.preco_lista, 8)}</td>
                                  <td className="py-3 text-right text-white">{formatNumber(item.desconto, 2)}</td>
                                  <td className="py-3 text-right text-white">{formatNumber(item.preco_unitario, 8)}</td>
                                  <td className="py-3 text-right text-white">{formatCurrency(item.preco_total)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Totais */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Totais</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-500">Nº de Itens</p>
                          <p className="text-sm text-white">{order.totais.n_itens}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Soma das Quantidades</p>
                          <p className="text-sm text-white">{formatNumber(order.totais.soma_quantidades, 2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Desconto</p>
                          <p className="text-sm text-white">{formatCurrency(order.totais.desconto)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total dos Itens</p>
                          <p className="text-sm text-white">{formatCurrency(order.totais.total_itens)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Outras Despesas</p>
                          <p className="text-sm text-white">{formatCurrency(order.totais.outras_despesas)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Desconto Total Venda</p>
                          <p className="text-sm text-white">{formatCurrency(order.totais.desconto_total_venda)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total de Comissées</p>
                          <p className="text-sm text-white">{formatCurrency(order.totais.total_comissoes)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total da Venda</p>
                          <p className="text-sm font-semibold text-orange-400">{formatCurrency(order.totais.total_venda)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Totais Marketplace */}
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Totais Marketplace</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-xs text-slate-500">Valor Base</p>
                          <p className="text-sm text-white">{formatCurrency(order.marketplace.valor_base)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Taxa Marketplace</p>
                          <p className="text-sm text-white">{formatCurrency(order.marketplace.taxa_marketplace)}</p>
                          <p className="text-xs text-rose-400">{order.marketplace.taxa_marketplace_percent}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Custo Frete</p>
                          <p className="text-sm text-white">{formatCurrency(order.marketplace.custo_frete)}</p>
                          <p className="text-xs text-rose-400">{order.marketplace.custo_frete_percent}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total Comissées</p>
                          <p className="text-sm text-rose-400">{order.marketplace.total_comissoes_percent}%</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Valor Total Líquido a Receber</p>
                          <p className="text-lg font-bold text-emerald-400">{formatCurrency(order.marketplace.valor_liquido)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detalhes da Venda */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Cadastrada em</p>
                        <p className="text-sm text-white">{order.data_cadastro}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Número do Pedido</p>
                        <p className="text-sm text-white">{order.numero}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Data da Venda</p>
                        <p className="text-sm text-white">{order.data_venda}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Data Saída</p>
                        <p className="text-sm text-white">{order.data_saida}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Data Prevista</p>
                        <p className="text-sm text-white">{order.data_prevista}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Nº Loja Virtual</p>
                        <p className="text-sm text-white">{order.numero_loja_virtual}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tipo Integração</p>
                        <p className="text-sm text-white">{order.tipo_integracao}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Origem Canal</p>
                        <p className="text-sm text-white">{order.origem_canal}</p>
                      </div>
                    </div>

                    {/* Pagamento */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Pagamento</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-500">Condiééo</p>
                          <p className="text-sm text-white">{order.pagamento.condicao} dias</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Valor</p>
                          <p className="text-sm text-white">{formatCurrency(order.pagamento.valor)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Data Vencimento</p>
                          <p className="text-sm text-white">{order.pagamento.data_vencimento}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Método</p>
                          <p className="text-sm text-white uppercase">{order.pagamento.metodo}</p>
                        </div>
                      </div>
                    </div>

                    {/* Transportador */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Transportador</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Nome</p>
                          <p className="text-sm text-white">{order.transportador.nome}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Frete por Conta</p>
                          <p className="text-sm text-white">{order.transportador.frete_por_conta}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Frete</p>
                          <p className="text-sm text-white">{formatCurrency(order.transportador.frete)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">ID Serviço</p>
                          <p className="text-sm text-white">{order.transportador.id_servico}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tracking</p>
                          <p className="text-sm text-white">{order.transportador.tracking}</p>
                        </div>
                      </div>
                    </div>

                    {/* Endereço de Entrega */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-orange-400">Endereço de Entrega</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Nome</p>
                          <p className="text-sm text-white">{order.endereco_entrega.nome}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">CEP</p>
                          <p className="text-sm text-white">{order.endereco_entrega.cep}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">UF</p>
                          <p className="text-sm text-white">{order.endereco_entrega.uf}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Cidade</p>
                          <p className="text-sm text-white">{order.endereco_entrega.cidade}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Bairro</p>
                          <p className="text-sm text-white">{order.endereco_entrega.bairro}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Endereço</p>
                          <p className="text-sm text-white">
                            {order.endereco_entrega.endereco}, {order.endereco_entrega.numero}
                            {order.endereco_entrega.complemento ? ' - ' + order.endereco_entrega.complemento : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
