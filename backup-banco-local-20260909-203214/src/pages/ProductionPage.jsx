import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  order_number: '',
  product_name: '',
  quantity: 0,
  status: 'em_producao',
  notes: '',
};

export default function ProductionPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase.from('production_orders').select('*').order('id', { ascending: false });
    if (!error) setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    const payload = {
      ...form,
      quantity: Number(form.quantity),
    };

    if (editingId) {
      const { error } = await supabase.from('production_orders').update(payload).eq('id', editingId);
      if (!error) {
        setMessage('Ordem atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadOrders();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('production_orders').insert(payload);
    if (!error) {
      setMessage('Ordem criada com sucesso.');
      setForm(emptyForm);
      await loadOrders();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(order) {
    setEditingId(order.id);
    setForm({
      order_number: order.order_number ?? '',
      product_name: order.product_name ?? '',
      quantity: order.quantity ?? 0,
      status: order.status ?? 'em_producao',
      notes: order.notes ?? '',
    });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (!error) {
      setMessage('Ordem removida com sucesso.');
      await loadOrders();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = orders.filter((order) => {
    const term = search.toLowerCase();
    return [order.order_number, order.product_name].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Centro de operações</p>
        <h1 className="mt-2 text-3xl font-semibold">Produção</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastro e acompanhamento de ordens de produção com busca e status real.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar ordem' : 'Nova ordem'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Número da ordem" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Produto" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Quantidade" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="em_producao">Em produção</option>
            <option value="parada">Parada</option>
            <option value="concluida">Concluída</option>
          </select>
          <textarea className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-2 xl:col-span-1" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Ordens cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ordem ou produto" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-400">{order.order_number || 'Ordem'}</p>
                <h2 className="mt-2 text-xl font-semibold">{order.product_name || 'Produto'}</h2>
                <p className="mt-3 text-sm text-slate-400">Status: {order.status}</p>
                <p className="mt-2 text-sm text-slate-500">Quantidade: {order.quantity}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(order)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(order.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

