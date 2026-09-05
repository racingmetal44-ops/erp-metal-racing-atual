import { useEffect, useState } from 'react';
import { Package, ShoppingCart, Factory, Bell, ArrowRight } from 'lucide-react';
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
  { title: 'Produtos', valueKey: 'products', icon: Package, color: 'from-orange-500 to-amber-500' },
  { title: 'Pedidos', valueKey: 'orders', icon: ShoppingCart, color: 'from-sky-500 to-cyan-500' },
  { title: 'Produção', valueKey: 'production', icon: Factory, color: 'from-emerald-500 to-green-500' },
  { title: 'Alertas', valueKey: 'alerts', icon: Bell, color: 'from-rose-500 to-red-500' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, orders: 0, production: 0, alerts: 0 });
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      const [productsRes, ordersRes, productionRes, alertsRes] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('production_orders').select('*', { count: 'exact', head: true }),
        supabase.from('alerts').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        products: productsRes.count ?? 0,
        orders: ordersRes.count ?? 0,
        production: productionRes.count ?? 0,
        alerts: alertsRes.count ?? 0,
      });

      const { data } = await supabase.from('stock_movements').select('*').order('id', { ascending: false }).limit(6);
      setItems(data ?? []);
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
        <p className="text-sm text-orange-400">Visão geral</p>
        <h1 className="mt-2 text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">Painel executivo com métricas principais do ERP.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, valueKey, icon: Icon, color }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/20">
            <div className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-2`}>
              <Icon size={20} />
            </div>
            <p className="mt-4 text-sm text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{stats[valueKey]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Movimentações recentes</h2>
            <button className="text-sm text-orange-400">Ver tudo</button>
          </div>
          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma movimentaééo encontrada.</p>
            ) : (
              items.map((item) => {
                const parsedObservacao = parseObservacao(item.observacao);
                const productName = item.product_name || parsedObservacao?.product_name || parsedObservacao?.product_sku || 'Produto';
                const movementType = item.movement_type || parsedObservacao?.movement_type || 'Movimento';
                const quantity = item.quantity ?? parsedObservacao?.quantity ?? 0;
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                    <div>
                      <p className="font-medium">{productName}</p>
                      <p className="text-sm text-slate-400">{movementType}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{quantity}</p>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
          <h2 className="text-lg font-semibold">Atalhos répidos</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Bipagem', path: '/bipagem' },
              { label: 'Produção', path: '/producao' },
              { label: 'NF-e', path: '/nfe' },
              { label: 'Importaééo', path: '/importacao' },
            ].map((item) => (
              <a key={item.path} href={item.path} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 transition hover:border-orange-500/30 hover:text-orange-300">
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

