import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  return_code: '',
  customer_name: '',
  status: 'pendente',
  notes: '',
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadReturns() {
    setLoading(true);
    const { data, error } = await supabase.from('return_notes').select('*').order('id', { ascending: false });
    if (!error) setReturns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadReturns(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      const { error } = await supabase.from('return_notes').update(form).eq('id', editingId);
      if (!error) {
        setMessage('Devolução atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadReturns();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('return_notes').insert(form);
    if (!error) {
      setMessage('Devolução criada com sucesso.');
      setForm(emptyForm);
      await loadReturns();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({ return_code: item.return_code ?? '', customer_name: item.customer_name ?? '', status: item.status ?? 'pendente', notes: item.notes ?? '' });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('return_notes').delete().eq('id', id);
    if (!error) {
      setMessage('Devolução removida com sucesso.');
      await loadReturns();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = returns.filter((item) => {
    const term = search.toLowerCase();
    return [item.return_code, item.customer_name].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Devoluções</p>
        <h1 className="mt-2 text-3xl font-semibold">Devoluções</h1>
        <p className="mt-2 text-sm text-slate-400">Gerenciamento de devoluções e notas de retorno.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar devolução' : 'Nova devolução'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Código da devolução" value={form.return_code} onChange={(e) => setForm({ ...form, return_code: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Cliente" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
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
          <h2 className="text-lg font-semibold">Devoluções cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código ou cliente" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h2 className="text-lg font-semibold">{item.return_code || 'Devolução'}</h2>
                <p className="mt-2 text-sm text-slate-400">Cliente: {item.customer_name || 'N/D'}</p>
                <p className="mt-2 text-sm text-slate-500">Status: {item.status}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(item)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(item.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

