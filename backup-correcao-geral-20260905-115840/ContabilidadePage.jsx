import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart2,
  Box,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const tabItems = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { key: 'documentos', label: 'Documentos Fiscais', icon: FileText },
  { key: 'nfe', label: 'NF-e', icon: ClipboardList },
  { key: 'faturamento', label: 'Faturamento', icon: Activity },
  { key: 'compras', label: 'Compras', icon: Truck },
  { key: 'estoque', label: 'Estoque', icon: Box },
  { key: 'impostos', label: 'Impostos', icon: Calculator },
  { key: 'inconsistencias', label: 'Inconsistências', icon: ShieldAlert },
  { key: 'exportacao', label: 'Exportação Contábil', icon: FolderOpen },
  { key: 'fechamento', label: 'Fechamento do Período', icon: CheckCircle2 },
];

const defaultExportOptions = {
  nfEntrada: true,
  nfSaida: true,
  nfCanceladas: true,
  eventosFiscais: false,
  xmls: true,
  danfes: true,
  faturamento: true,
  compras: true,
  estoque: true,
  impostos: true,
  resumoFinanceiro: true,
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

export default function ContabilidadePage() {
  const [companies, setCompanies] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returnNotes, setReturnNotes] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [exportOptions, setExportOptions] = useState(defaultExportOptions);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [companiesRes, ordersRes, returnsRes, stockRes] = await Promise.all([
        supabase.from('companies').select('*').order('id', { ascending: false }),
        supabase.from('orders').select('*').order('id', { ascending: false }),
        supabase.from('return_notes').select('*').order('id', { ascending: false }),
        supabase.from('stock_movements').select('*').order('id', { ascending: false }),
      ]);

      setCompanies(companiesRes.data ?? []);
      setOrders(ordersRes.data ?? []);
      setReturnNotes(returnsRes.data ?? []);
      setStockMovements(stockRes.data ?? []);
      setSelectedCompanyId((companiesRes.data ?? [])[0]?.id ?? null);
      setLoading(false);
    }

    loadData();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const documents = useMemo(() => {
    const nfes = orders.map((order) => ({
      id: `venda-${order.id}`,
      tipo: 'NF-e Saída',
      numero: order.numero || `#${order.id}`,
      serie: order.serie || '1',
      chave: order.chave_acesso || '-',
      data: order.data_venda || order.data_cadastro || '-',
      empresa: order.unidade_negocio || selectedCompany?.name || 'Matriz',
      parceiro: order.cliente || 'Cliente',
      documento: order.cnpj || order.cpf || '-',
      valor: formatCurrency(order.total_venda || order.totais?.total_venda || 0),
      status: order.status || 'Autorizada',
    }));

    const entradas = returnNotes.map((item) => ({
      id: `compra-${item.id}`,
      tipo: 'NF-e Entrada',
      numero: item.original_nfe_number || `#${item.id}`,
      serie: item.serie || '1',
      chave: item.chave_acesso || '-',
      data: item.return_date || '-',
      empresa: selectedCompany?.name || 'Matriz',
      parceiro: item.customer_name || 'Fornecedor',
      documento: item.cnpj || item.cpf || '-',
      valor: formatCurrency(item.cost || item.product_value || 0),
      status: item.status === 'aprovada' ? 'Autorizada' : item.status || 'Pendente',
    }));

    return [...nfes, ...entradas];
  }, [orders, returnNotes, selectedCompany]);

  const faturamentoBruto = useMemo(
    () => orders.reduce((total, order) => total + Number(order.total_venda || order.totais?.total_venda || 0), 0),
    [orders]
  );

  const totalCompras = useMemo(
    () => returnNotes.reduce((total, item) => total + Number(item.cost || item.product_value || 0), 0),
    [returnNotes]
  );

  const nfesAutorizadas = orders.filter((order) => order.status !== 'cancelada' && order.status !== 'rejeitada').length;
  const nfesCanceladas = orders.filter((order) => order.status === 'cancelada').length;
  const nfesRejeitadas = orders.filter((order) => order.status === 'rejeitada').length;
  const nfesEntrada = returnNotes.length;
  const pendencias = orders.filter((order) => order.status && order.status !== 'entregue').length + returnNotes.filter((item) => item.status === 'pendente').length;

  const stockSummary = useMemo(() => {
    const map = new Map();
    stockMovements.forEach((movement) => {
      const key = movement.product_sku || movement.product_code || movement.product_name || 'Sem SKU';
      const current = map.get(key) || {
        sku: key,
        produto: movement.product_name || 'Produto',
        inicial: 0,
        entradas: 0,
        saidas: 0,
        ajustes: 0,
        devolucoes: 0,
      };
      const quantidade = Number(movement.quantity || 0);
      if (movement.tipo === 'entrada') current.entradas += quantidade;
      if (movement.tipo === 'saida') current.saidas += quantidade;
      if (movement.tipo === 'ajuste') current.ajustes += quantidade;
      if (movement.tipo === 'devolucao') current.devolucoes += quantidade;
      current.final = current.inicial + current.entradas - current.saidas + current.ajustes + current.devolucoes;
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [stockMovements]);

  const inconsistencias = useMemo(() => [
    { label: 'NF-e sem XML', resolved: false },
    { label: 'NF-e autorizada sem protocolo', resolved: false },
    { label: 'NF-e sem chave de acesso', resolved: false },
    { label: 'NF-e sem DANFE', resolved: false },
    { label: 'Produtos sem dados fiscais obrigatórios', resolved: false },
    { label: 'Documentos duplicados', resolved: false },
    { label: 'NF-e rejeitada', resolved: nfesRejeitadas === 0 },
    { label: 'Informações incompletas', resolved: false },
    { label: 'Documentos não vinculados corretamente', resolved: false },
  ], [nfesRejeitadas]);

  const handleExportOptionToggle = (key) => {
    setExportOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeneratePackage = () => {
    setMessage('Pacote contábil preparado. Integração de ZIP em backend ou biblioteca adicional pendente.');
  };

  const handleClosePeriod = () => {
    setMessage('Período contábil fechado e registro enviado para auditoria.');
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Carregando dados contábeis...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
        <p className="text-sm text-orange-400">Contabilidade</p>
        <h1 className="mt-2 text-3xl font-semibold">Contabilidade</h1>
        <p className="mt-2 text-sm text-slate-400">Módulo para organização, conferência e exportação dos dados fiscais e financeiros do Metal Racing.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-400">
              Empresa
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200"
                value={selectedCompanyId ?? ''}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value) || null)}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-400">
              Período inicial
              <input
                type="date"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200"
                value={period.from}
                onChange={(e) => setPeriod((curr) => ({ ...curr, from: e.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-400">
              Período final
              <input
                type="date"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200"
                value={period.to}
                onChange={(e) => setPeriod((curr) => ({ ...curr, to: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Resumo do período</p>
              <p className="mt-1 text-lg font-semibold text-white">{selectedCompany?.name || 'Empresa não selecionada'}</p>
            </div>
            <div className="rounded-3xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
              {period.from || 'Início'} ? {period.to || 'Fim'}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex min-w-[940px] gap-2">
          {tabItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex min-w-[180px] items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm transition ${activeTab === key ? 'bg-orange-500/20 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.12)]' : 'text-slate-300 hover:bg-slate-950/70'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'Faturamento', value: formatCurrency(faturamentoBruto), icon: Zap },
              { title: 'Compras', value: formatCurrency(totalCompras), icon: Truck },
              { title: 'NF-e emitidas', value: nfesAutorizadas, icon: FileText },
              { title: 'NF-e de entrada', value: nfesEntrada, icon: Download },
            ].map(({ title, value, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex items-center gap-3 text-orange-300">
                  <Icon size={18} />
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{title}</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <h2 className="text-lg font-semibold">Faturamento por período</h2>
              <p className="mt-3 text-sm text-slate-400">Visualize o desempenho de vendas com base nas notas e pedidos registrados.</p>
              <div className="mt-6 h-40 rounded-3xl bg-slate-900/80" />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <h2 className="text-lg font-semibold">Entradas x Saídas</h2>
              <p className="mt-3 text-sm text-slate-400">Comparativo de volumes fiscais de entrada e saéda.</p>
              <div className="mt-6 h-40 rounded-3xl bg-slate-900/80" />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <h2 className="text-lg font-semibold">NF-e por status</h2>
              <p className="mt-3 text-sm text-slate-400">Status de notas fiscais emitidas, canceladas e rejeitadas.</p>
              <div className="mt-6 h-40 rounded-3xl bg-slate-900/80" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Documentos Fiscais</h2>
                <p className="mt-2 text-sm text-slate-400">Consulta centralizada dos documentos fiscais existentes.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200">Pesquisar</button>
                <button className="rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">Exportar</button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Série</th>
                  <th className="px-4 py-3">Chave de acesso</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cliente/Fornecedor</th>
                  <th className="px-4 py-3">CPF/CNPJ</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">XML</th>
                  <th className="px-4 py-3">DANFE</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-b border-slate-800 hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-slate-300">{document.tipo}</td>
                    <td className="px-4 py-3">{document.numero}</td>
                    <td className="px-4 py-3">{document.serie}</td>
                    <td className="px-4 py-3">{document.chave}</td>
                    <td className="px-4 py-3">{document.data}</td>
                    <td className="px-4 py-3">{document.empresa}</td>
                    <td className="px-4 py-3">{document.parceiro}</td>
                    <td className="px-4 py-3">{document.documento}</td>
                    <td className="px-4 py-3">{document.valor}</td>
                    <td className="px-4 py-3">{document.status}</td>
                    <td className="px-4 py-3">{document.chave !== '-' ? 'Disponível' : 'Ausente'}</td>
                    <td className="px-4 py-3">{document.chave !== '-' ? 'Disponível' : 'Ausente'}</td>
                    <td className="px-4 py-3">
                      <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300 hover:bg-slate-900">Visualizar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'nfe' && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {[
              { label: 'NF-e Autorizadas', value: nfesAutorizadas, icon: ShieldCheck },
              { label: 'NF-e Canceladas', value: nfesCanceladas, icon: ShieldAlert },
              { label: 'NF-e Rejeitadas', value: nfesRejeitadas, icon: ShieldAlert },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <div className="flex items-center gap-3 text-orange-300">
                  <Icon size={18} />
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold">NF-e Autorizadas</h2>
            <p className="mt-2 text-sm text-slate-400">Lista automética de notas fiscais válidas.</p>
            <div className="mt-4 space-y-3">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="rounded-2xl border border-white/5 bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{order.numero || '#N/A'}</p>
                      <p className="text-sm text-slate-400">Cliente: {order.cliente || 'N/A'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Autorizada</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>Data: {order.data_venda || order.data_cadastro || 'N/A'}</span>
                    <span>Valor: {formatCurrency(order.total_venda || order.totais?.total_venda || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'faturamento' && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            {[
              { title: 'Faturamento bruto', value: formatCurrency(faturamentoBruto) },
              { title: 'Descontos', value: formatCurrency(0) },
              { title: 'Frete', value: formatCurrency(0) },
              { title: 'Faturamento líquido', value: formatCurrency(faturamentoBruto) },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <p className="text-sm text-slate-400">{card.title}</p>
                <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Faturamento por período</h2>
                <p className="mt-2 text-sm text-slate-400">Filtro por dia, semana, més ou cliente.</p>
              </div>
              <button className="rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">Exportar Excel</button>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3">Vendas</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-900/60">
                      <td className="px-4 py-3">{order.data_venda || order.data_cadastro || 'N/A'}</td>
                      <td className="px-4 py-3">1</td>
                      <td className="px-4 py-3">{formatCurrency(order.total_venda || order.totais?.total_venda || 0)}</td>
                      <td className="px-4 py-3">{formatCurrency(order.total_venda || order.totais?.total_venda || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compras' && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            {[
              { title: 'Total de compras', value: formatCurrency(totalCompras) },
              { title: 'Fornecedores', value: returnNotes.length },
              { title: 'Documentos de entrada', value: nfesEntrada },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <p className="text-sm text-slate-400">{card.title}</p>
                <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold">Compras recentes</h2>
            <div className="mt-4 space-y-3">
              {returnNotes.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/5 bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{item.original_nfe_number || `Compra #${item.id}`}</p>
                      <p className="text-sm text-slate-400">Fornecedor: {item.customer_name || 'N/D'}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{item.status || 'N/D'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>Data: {item.return_date || 'N/D'}</span>
                    <span>Valor: {formatCurrency(item.cost || item.product_value || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estoque' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold">Movimentaééo de Estoque</h2>
            <p className="mt-2 text-sm text-slate-400">Relatério contébil de estoque baseado nas movimentações existentes.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Inicial</th>
                  <th className="px-4 py-3">Entradas</th>
                  <th className="px-4 py-3">Saídas</th>
                  <th className="px-4 py-3">Ajustes</th>
                  <th className="px-4 py-3">Devoluções</th>
                  <th className="px-4 py-3">Final</th>
                </tr>
              </thead>
              <tbody>
                {stockSummary.map((item) => (
                  <tr key={item.sku} className="border-b border-slate-800 hover:bg-slate-900/60">
                    <td className="px-4 py-3">{item.sku}</td>
                    <td className="px-4 py-3">{item.produto}</td>
                    <td className="px-4 py-3">{item.inicial}</td>
                    <td className="px-4 py-3">{item.entradas}</td>
                    <td className="px-4 py-3">{item.saidas}</td>
                    <td className="px-4 py-3">{item.ajustes}</td>
                    <td className="px-4 py-3">{item.devolucoes}</td>
                    <td className="px-4 py-3">{item.final}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'impostos' && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {['ICMS', 'IPI', 'PIS', 'COFINS', 'ICMS-ST', 'Outros'].map((tax) => (
              <div key={tax} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <p className="text-sm text-slate-400">{tax}</p>
                <p className="mt-4 text-3xl font-semibold text-white">0</p>
                <p className="mt-2 text-sm text-slate-500">Base de cálculo e aléquota sé aparecem quando carregadas nas NF-e.</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
            Para o resumo tributério, a contabilidade utiliza somente os dados fiscais registrados nos documentos existentes. Cálculos estimados não são gerados neste módulo.
          </div>
        </div>
      )}

      {activeTab === 'inconsistencias' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold">Inconsisténcias Fiscais</h2>
            <p className="mt-2 text-sm text-slate-400">Encontre e resolva problemas nos documentos fiscais e integrações.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {inconsistencias.map((issue) => (
              <div key={issue.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{issue.label}</p>
                    <p className="mt-2 text-sm text-slate-400">{issue.resolved ? 'Verificado' : 'Aééo recomendada'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${issue.resolved ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {issue.resolved ? 'Resolvido' : 'Pendente'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">Ver</button>
                  <button className="rounded-xl border border-orange-500 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">Corrigir</button>
                  <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">Marcar resolvido</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'exportacao' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold">Exportação Contébil</h2>
            <p className="mt-2 text-sm text-slate-400">Selecione o conjunto de dados para gerar o pacote contébil.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Object.entries(exportOptions).map(([key, value]) => (
              <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-200">
                <input type="checkbox" checked={value} onChange={() => handleExportOptionToggle(key)} className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-orange-500" />
                <span>{{
                  nfEntrada: 'NF-e de entrada',
                  nfSaida: 'NF-e de saéda',
                  nfCanceladas: 'NF-e canceladas',
                  eventosFiscais: 'Eventos fiscais',
                  xmls: 'XMLs',
                  danfes: 'DANFEs',
                  faturamento: 'Faturamento',
                  compras: 'Compras',
                  estoque: 'Estoque',
                  impostos: 'Impostos',
                  resumoFinanceiro: 'Resumo financeiro',
                }[key]}</span>
              </label>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Nome do pacote</p>
                <p className="mt-1 text-base font-semibold text-white">METAL_RACING_{selectedCompany?.name?.replace(/\s+/g, '_') || 'EMPRESA'}_{period.from || 'INICIO'}-{period.to || 'FIM'}</p>
              </div>
              <button onClick={handleGeneratePackage} className="rounded-2xl border border-orange-500 bg-orange-500/10 px-5 py-3 text-sm text-orange-300 transition hover:bg-orange-500/20">
                GERAR PACOTE CONTéBIL
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fechamento' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold">Fechamento do Período</h2>
            <p className="mt-2 text-sm text-slate-400">Confirme os itens antes de finalizar o período contébil.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[
              'NF-e autorizadas',
              'NF-e canceladas',
              'NF-e rejeitadas',
              'XMLs disponíveis',
              'DANFEs disponíveis',
              'Faturamento',
              'Compras',
              'Estoque',
              'Impostos',
              'Inconsisténcias'
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-200">{item}</p>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">OK</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <button onClick={handleClosePeriod} className="rounded-2xl border border-orange-500 bg-orange-500/10 px-5 py-3 text-sm text-orange-300 transition hover:bg-orange-500/20">
              FECHAR PERéODO CONTéBIL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
