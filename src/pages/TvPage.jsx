import { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, Package, CheckCircle2, Truck, TrendingUp, Clock, Target, Trophy, AlertTriangle, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ============ BANDEIRAS ============
const BANDEIRAS = {
  brasil:    '/bandeiras/brasil.png',
  eua:       '/bandeiras/eua.png',
  argentina: '/bandeiras/argentina.png',
  china:     '/bandeiras/china.png',
};

// ============ CORES POR ORIGEM ============
function corOrigem(origem) {
  const o = (origem || '').toLowerCase();
  if (o.includes('coleta'))       return 'bg-blue-600';
  if (o.includes('agencia') || o.includes('agência')) return 'bg-blue-500';
  if (o.includes('shopee'))       return 'bg-orange-500';
  if (o.includes('tiktok'))       return 'bg-sky-500';
  if (o.includes('correios'))     return 'bg-yellow-500';
  if (o.includes('site'))         return 'bg-cyan-500';
  if (o.includes('personaliz'))   return 'bg-indigo-500';
  if (o.includes('garantia'))     return 'bg-emerald-500';
  if (o.includes('mercado') || o.includes('ml')) return 'bg-yellow-400';
  return 'bg-slate-700';
}

// ============ FILTRO POR PERÍODO ============
function filtrarPorPeriodo(produtos, periodo) {
  const agora = new Date();
  const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return produtos.filter(p => {
    if (!p.CreatedAt) return false;
    const data = new Date(p.CreatedAt);
    if (periodo === 'hoje') return data >= hojeInicio;
    if (periodo === 'semana') {
      const semanaAtras = new Date(hojeInicio);
      semanaAtras.setDate(semanaAtras.getDate() - 7);
      return data >= semanaAtras;
    }
    if (periodo === 'mes') {
      const mesAtras = new Date(hojeInicio);
      mesAtras.setMonth(mesAtras.getMonth() - 1);
      return data >= mesAtras;
    }
    return true;
  });
}

const DAILY_PRODUCTION_GOAL = 500;
const LATE_ORDER_HOURS = 48;

const ORDER_STATUS = {
  novo: ['novo', 'pendente', 'aguardando'],
  separando: ['separando', 'em_separacao', 'em separação'],
  pronto: ['pronto', 'pronto_coleta', 'aguardando_coleta'],
  enviado: ['enviado', 'despachado', 'concluido'],
};

const PRODUCTION_STATUS_ACTIVE = ['em_producao', 'produzindo', 'em produção', 'ativo'];

function statusMatches(status, group) {
  const normalized = (status || '').toString().trim().toLowerCase();
  return group.includes(normalized);
}

function isToday(dateString) {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function StatCard({ icon: Icon, label, value, colorClass, sublabel }) {
  return (
    <div className={`rounded-2xl border p-5 ${colorClass.border} ${colorClass.bg}`}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${colorClass.text}`}>
          <Icon size={16} />
          {label}
        </div>
        <span className={`text-2xl font-bold ${colorClass.text}`}>{value}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{sublabel}</p>
    </div>
  );
}

export default function TvPage() {
  const [orders, setOrders] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [gradeProdutos, setGradeProdutos] = useState([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const [ordersRes, productionRes, productsRes, alertsRes, companiesRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_date', { ascending: false }),
      supabase.from('production_orders').select('*').order('created_date', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('alerts').select('*').eq('acknowledged', false),
      supabase.from('companies').select('*'),
    ]);

    setOrders(ordersRes.data ?? []);
    setProductionOrders(productionRes.data ?? []);
    setProducts(productsRes.data ?? []);
    setAlerts(alertsRes.data ?? []);
    setCompanies(companiesRes.data ?? []);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    const carregarGrade = async () => {
      try {
        const r = await fetch('/tv_dados.json?v=' + Date.now());
        const lista = await r.json();
        setGradeProdutos(Array.isArray(lista) ? lista : [lista]);
      } catch (e) {
        console.error('Erro ao carregar grade:', e);
      }
    };
    carregarGrade();
    const interval = setInterval(carregarGrade, 5000);
    return () => clearInterval(interval);
  }, []);

  const novosPedidos = orders.filter((o) => statusMatches(o.status, ORDER_STATUS.novo));
  const emSeparacao = orders.filter((o) => statusMatches(o.status, ORDER_STATUS.separando));
  const prontosColeta = orders.filter((o) => statusMatches(o.status, ORDER_STATUS.pronto));
  const enviadosHoje = orders.filter((o) => statusMatches(o.status, ORDER_STATUS.enviado) && isToday(o.updated_date));

  const pedidosAtrasados = orders.filter((o) => {
    if (statusMatches(o.status, ORDER_STATUS.enviado)) return false;
    if (!o.created_date) return false;
    const hoursSinceCreated = (Date.now() - new Date(o.created_date).getTime()) / 36e5;
    return hoursSinceCreated > LATE_ORDER_HOURS;
  });

  const shopeeHoje = orders.filter((o) => (o.marketplace || '').toLowerCase().includes('shopee') && isToday(o.created_date));
  const mlHoje = orders.filter((o) => {
    const m = (o.marketplace || '').toLowerCase();
    return (m.includes('mercado') || m === 'ml') && isToday(o.created_date);
  });

  const producaoAtiva = productionOrders.filter((p) => statusMatches(p.status, PRODUCTION_STATUS_ACTIVE));
  const producaoHoje = productionOrders.filter((p) => isToday(p.start_date) || isToday(p.updated_date));
  const produzidoHoje = producaoHoje.reduce((sum, p) => sum + Number(p.produced_quantity || 0), 0);
  const metaAtingida = Math.min(100, Math.round((produzidoHoje / DAILY_PRODUCTION_GOAL) * 100));

  const rankingMap = {};
  producaoHoje.forEach((p) => {
    const name = p.assigned_to_name || 'Sem operador';
    rankingMap[name] = (rankingMap[name] || 0) + Number(p.produced_quantity || 0);
  });
  const ranking = Object.entries(rankingMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const estoqueCritico = products
    .filter((p) => Number(p.current_stock ?? 0) <= Number(p.min_stock ?? 0))
    .filter((p) => !search.trim() || (p.name || '').toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 12);

  const alertasCriticos = alerts.filter((a) => (a.severity || '').toLowerCase() === 'critica' || (a.severity || '').toLowerCase() === 'critico');

  const produtosFiltrados = filtrarPorPeriodo(gradeProdutos, filtroPeriodo);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="appearance-none rounded-xl border border-slate-700 bg-slate-950 py-2 pl-4 pr-9 text-sm text-slate-200"
          >
            <option value="">Selecionar empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produtos..."
              className="rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-4 text-sm text-slate-200"
            />
          </div>
          <span className="text-xs text-slate-500">Atualizado: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Novos pedidos" value={novosPedidos.length} sublabel={novosPedidos.length === 0 ? 'Sem novos pedidos' : `${novosPedidos.length} aguardando início`} colorClass={{ border: 'border-sky-500/40', bg: 'bg-slate-950/60', text: 'text-sky-300' }} />
        <StatCard icon={Package} label="Em separação" value={emSeparacao.length} sublabel={emSeparacao.length === 0 ? 'Nenhum em separação' : `${emSeparacao.length} em andamento`} colorClass={{ border: 'border-amber-500/40', bg: 'bg-slate-950/60', text: 'text-amber-300' }} />
        <StatCard icon={CheckCircle2} label="Prontos p/ coleta" value={prontosColeta.length} sublabel={prontosColeta.length === 0 ? 'Nenhum pronto' : `${prontosColeta.length} aguardando coleta`} colorClass={{ border: 'border-emerald-500/40', bg: 'bg-slate-950/60', text: 'text-emerald-300' }} />
        <StatCard icon={Truck} label="Enviados hoje" value={enviadosHoje.length} sublabel={enviadosHoje.length === 0 ? 'Nenhum enviado hoje' : `${enviadosHoje.length} despachados`} colorClass={{ border: 'border-cyan-500/40', bg: 'bg-slate-950/60', text: 'text-cyan-300' }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-violet-500/40 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-300">
              <TrendingUp size={16} />
              Em produção
            </div>
            <span className="text-2xl font-bold text-violet-300">{producaoAtiva.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {producaoAtiva.length === 0 && <p className="text-sm text-slate-500">Nenhuma ordem em produção agora.</p>}
            {producaoAtiva.slice(0, 4).map((p) => {
              const pct = p.planned_quantity ? Math.min(100, Math.round((Number(p.produced_quantity || 0) / Number(p.planned_quantity)) * 100)) : 0;
              return (
                <div key={p.id} className="rounded-xl bg-violet-500/10 px-4 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-100">{p.order_number}</p>
                      <p className="text-slate-400">{p.product_name}</p>
                    </div>
                    <span className="font-semibold text-violet-300">{p.produced_quantity ?? 0}/{p.planned_quantity ?? 0}<span className="ml-2 text-xs text-slate-500">{pct}%</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/40 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-rose-300">
              <Clock size={16} />
              Pedidos atrasados
            </div>
            <span className="text-2xl font-bold text-rose-300">{pedidosAtrasados.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {pedidosAtrasados.length === 0 ? (
              <p className="text-sm text-slate-500">Sem atrasos</p>
            ) : (
              pedidosAtrasados.slice(0, 4).map((o) => (
                <div key={o.id} className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm">
                  <p className="font-semibold text-slate-100">{o.order_number}</p>
                  <p className="text-slate-400">{o.customer_name}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ====== GRADE DE PRODUTOS DO QUADRO ====== */}
      <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/60 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
            <Package size={16} />
            Produção no Quadro
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
            <button
              onClick={() => setFiltroPeriodo('hoje')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                filtroPeriodo === 'hoje' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setFiltroPeriodo('semana')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                filtroPeriodo === 'semana' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setFiltroPeriodo('mes')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                filtroPeriodo === 'mes' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Este Mês
            </button>
          </div>

          <span className="text-xs font-normal text-slate-500">{produtosFiltrados.length} itens</span>
        </div>

        {produtosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto no período selecionado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {produtosFiltrados.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                <div className="aspect-square w-full overflow-hidden bg-white">
                  <img src={p.Foto} alt={p.Produto || p.Numero} className="h-full w-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div className={`flex items-center justify-center gap-2 py-1.5 px-2 ${corOrigem(p.Origem)}`}>
                  <img src={BANDEIRAS[p.Bandeira] || BANDEIRAS.brasil} alt={p.Bandeira} className="h-3.5 w-5 rounded-sm border border-white/40" onError={(e) => { e.target.style.display = 'none'; }} />
                  <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow">{(p.Origem || 'SHOPEE').toUpperCase()}</span>
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-xs font-bold text-slate-100">#{p.Numero}</p>
                  <p className="truncate text-[10px] text-slate-400">{p.Setor}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-orange-500/40 bg-slate-950/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-300">
            <Target size={16} />
            Meta de produção hoje
          </div>
          <div className="mt-4 grid grid-cols-3 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-300">{produzidoHoje}</p>
              <p className="text-xs text-slate-500">Produzido</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-200">{DAILY_PRODUCTION_GOAL}</p>
              <p className="text-xs text-slate-500">Meta</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-300">{metaAtingida}%</p>
              <p className="text-xs text-slate-500">Atingido</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500" style={{ width: `${metaAtingida}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-violet-500/40 bg-slate-950/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-300">
            <Trophy size={16} />
            Ranking operadores
          </div>
          <div className="mt-4 space-y-2">
            {ranking.length === 0 ? (
              <p className="text-sm text-slate-500">Sem produção registrada hoje.</p>
            ) : (
              ranking.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between rounded-xl bg-violet-500/10 px-4 py-2 text-sm">
                  <span className="font-semibold text-slate-100">{i + 1}º {r.name}</span>
                  <span className="font-semibold text-violet-300">{r.qty} peças</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/60 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
          <AlertTriangle size={16} />
          Estoque crítico - produzir com urgência
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {estoqueCritico.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">Nenhum item em estoque crítico.</p>
          ) : (
            estoqueCritico.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-500/20 bg-slate-900/80 p-4 text-center">
                <p className="truncate text-sm font-semibold text-slate-200">{p.name}</p>
                <p className="mt-1 text-2xl font-bold text-rose-400">{p.current_stock ?? 0}</p>
                <p className="text-xs text-slate-500">min: {p.min_stock ?? 0}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
          <p className="text-2xl font-bold text-amber-300">{shopeeHoje.length}</p>
          <p className="text-sm text-slate-400">Shopee Hoje</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
          <p className="text-2xl font-bold text-amber-300">{mlHoje.length}</p>
          <p className="text-sm text-slate-400">ML Hoje</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-300">{enviadosHoje.length}</p>
          <p className="text-sm text-slate-400">Total Enviados Hoje</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
          <p className="text-2xl font-bold text-rose-300">{alertasCriticos.length}</p>
          <p className="text-sm text-slate-400">Alertas Críticos</p>
        </div>
      </div>

      <button
        onClick={loadAll}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400"
        title="Atualizar agora"
      >
        <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
