import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  Factory,
  Bell,
  FileText,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function parseObservacao(observacao) {
  if (!observacao) return null;
  if (typeof observacao === 'object') return observacao;

  try {
    return JSON.parse(observacao);
  } catch {
    return null;
  }
}

const cards = [
  {
    title: 'Produtos',
    valueKey: 'products',
    icon: Package,
    color: 'from-orange-500 to-amber-500'
  },
  {
    title: 'Pedidos',
    valueKey: 'orders',
    icon: ShoppingCart,
    color: 'from-sky-500 to-cyan-500'
  },
  {
    title: 'Produção',
    valueKey: 'production',
    icon: Factory,
    color: 'from-emerald-500 to-green-500'
  },
  {
    title: 'Alertas',
    valueKey: 'alerts',
    icon: Bell,
    color: 'from-rose-500 to-red-500'
  },
  {
    title: 'NF-e de entrada',
    valueKey: 'nfeEntradas',
    icon: FileText,
    color: 'from-violet-500 to-indigo-500'
  },
  {
    title: 'Devoluções',
    valueKey: 'returns',
    icon: RotateCcw,
    color: 'from-amber-500 to-orange-500'
  }
];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    production: 0,
    alerts: 0,
    nfeEntradas: 0,
    returns: 0
  });

  const [items, setItems] = useState([]);

  useEffect(() => {
    let ativo = true;

    async function load() {
      try {
        const [
          productsRes,
          ordersRes,
          productionRes,
          alertsRes,
          nfeRes,
          returnsRes
        ] = await Promise.all([
          fetch('/api/produtos')
            .then((response) =>
              response.ok ? response.json() : { data: [] }
            )
            .catch(() => ({ data: [] })),

          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true }),

          supabase
            .from('production_orders')
            .select('*', { count: 'exact', head: true }),

          supabase
            .from('alerts')
            .select('*', { count: 'exact', head: true }),

          fetch('/api/nfe-entradas')
            .then((response) =>
              response.ok ? response.json() : { entradas: [] }
            )
            .catch(() => ({ entradas: [] })),

          fetch('/api/devolucoes')
            .then((response) =>
              response.ok ? response.json() : { data: [] }
            )
            .catch(() => ({ data: [] }))
        ]);

        if (!ativo) return;

        const entradas = Array.isArray(nfeRes?.entradas)
          ? nfeRes.entradas
          : [];

        const devolucoes = Array.isArray(returnsRes?.data)
          ? returnsRes.data
          : [];

        setStats({
          products: Array.isArray(productsRes?.data)
            ? productsRes.data.length
            : 0,

          orders: ordersRes?.count ?? 0,

          production: productionRes?.count ?? 0,

          alerts: alertsRes?.count ?? 0,

          nfeEntradas: entradas.filter(
            (entrada) =>
              String(entrada.status || '').toUpperCase() === 'CONFIRMADA'
          ).length,

          returns: devolucoes.length
        });

        const { data } = await supabase
          .from('stock_movements')
          .select('*')
          .order('id', { ascending: false })
          .limit(6);

        if (ativo) {
          setItems(data ?? []);
        }
      } catch (error) {
        console.error('[DASHBOARD] Erro ao atualizar:', error);
      }
    }

    load();

    const intervalo = setInterval(load, 10000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
        <p className="text-sm text-orange-400">Visão geral</p>

        <h1 className="mt-2 text-3xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Painel executivo com métricas principais do ERP.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {cards.map(({ title, valueKey, icon: Icon, color }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/20"
          >
            <div className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-2`}>
              <Icon size={20} />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <p className="text-sm text-slate-400">
                {title}
              </p>

              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            </div>

            <p className="mt-1 text-[10px] text-slate-500">
              Em tempo real
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {stats[valueKey]}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Movimentações recentes
            </h2>

            <button className="text-sm text-orange-400">
              Ver tudo
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma movimentação encontrada.
              </p>
            ) : (
              items.map((item) => {
                const parsedObservacao = parseObservacao(item.observacao);

                const productName =
                  item.product_name ||
                  parsedObservacao?.product_name ||
                  parsedObservacao?.product_sku ||
                  'Produto';

                const movementType =
                  item.movement_type ||
                  parsedObservacao?.movement_type ||
                  'Movimento';

                const quantity =
                  item.quantity ??
                  parsedObservacao?.quantity ??
                  0;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {productName}
                      </p>

                      <p className="text-sm text-slate-400">
                        {movementType}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {quantity}
                      </p>

                      <p className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
          <h2 className="text-lg font-semibold">
            Atalhos rápidos
          </h2>

          <div className="mt-4 space-y-3">
            {[
              { label: 'Bipagem', path: '/bipagem' },
              { label: 'Produção', path: '/producao' },
              { label: 'NF-e', path: '/nfe' },
              { label: 'Estoque', path: '/estoque' },
              { label: 'Ranking', path: '/ranking' },
              { label: 'Devoluções', path: '/devolucoes' }
            ].map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 transition hover:border-orange-500/30 hover:text-orange-300"
              >
                <span>{item.label}</span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}