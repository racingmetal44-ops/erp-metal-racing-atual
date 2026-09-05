import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function FinancePage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders').select('*').order('id', { ascending: false });
      setOrders(data ?? []);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Finanéas</p>
        <h1 className="mt-2 text-3xl font-semibold">Financeiro</h1>
        <p className="mt-2 text-sm text-slate-400">Visão financeira do fluxo de pedidos e faturamento.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <span className="text-slate-400">Pedidos</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="flex justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <span className="text-slate-400">Status ativos</span>
              <strong>{orders.filter((item) => item.status !== 'entregue').length}</strong>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Últimos pedidos</h2>
          <div className="mt-4 space-y-2">
            {orders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
                <span>{order.customer_name || 'Cliente'}</span>
                <span className="text-slate-400">{order.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

