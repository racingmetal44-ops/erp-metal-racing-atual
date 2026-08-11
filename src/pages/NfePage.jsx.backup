import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  nfe_number: '',
  customer_name: '',
  total_value: 0,
  status: 'emitida',
};

export default function NfePage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadInvoices() {
    setLoading(true);
    const { data, error } = await supabase.from('invoices').select('*').order('id', { ascending: false });
    if (!error) setInvoices(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadInvoices(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    const payload = { ...form, total_value: Number(form.total_value) };
    if (editingId) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', editingId);
      if (!error) {
        setMessage('NF-e atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadInvoices();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('invoices').insert(payload);
    if (!error) {
      setMessage('NF-e criada com sucesso.');
      setForm(emptyForm);
      await loadInvoices();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(invoice) {
    setEditingId(invoice.id);
    setForm({ nfe_number: invoice.nfe_number ?? '', customer_name: invoice.customer_name ?? '', total_value: invoice.total_value ?? 0, status: invoice.status ?? 'emitida' });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (!error) {
      setMessage('NF-e removida com sucesso.');
      await loadInvoices();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = invoices.filter((invoice) => {
    const term = search.toLowerCase();
    return [invoice.nfe_number, invoice.customer_name].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Documentos fiscais</p>
        <h1 className="mt-2 text-3xl font-semibold">NF-e</h1>
        <p className="mt-2 text-sm text-slate-400">Gestão de notas e integração com o fluxo de faturamento.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar NF-e' : 'Nova NF-e'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Número da NF-e" value={form.nfe_number} onChange={(e) => setForm({ ...form, nfe_number: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Cliente" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Valor total" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="emitida">Emitida</option>
            <option value="pendente">Pendente</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">NF-e cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número ou cliente" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">{invoice.nfe_number || 'NF-e'}</p>
                <h2 className="mt-2 text-lg font-semibold">{invoice.customer_name || 'Cliente'}</h2>
                <p className="mt-2 text-sm text-slate-500">Valor: {invoice.total_value}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(invoice)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(invoice.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

