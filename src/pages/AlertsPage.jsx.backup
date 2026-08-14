import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  title: '',
  message: '',
  severity: 'media',
  acknowledged: false,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadAlerts() {
    setLoading(true);
    const { data, error } = await supabase.from('alerts').select('*').order('id', { ascending: false });
    if (!error) setAlerts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAlerts(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      const { error } = await supabase.from('alerts').update(form).eq('id', editingId);
      if (!error) {
        setMessage('Alerta atualizado com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadAlerts();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('alerts').insert(form);
    if (!error) {
      setMessage('Alerta criado com sucesso.');
      setForm(emptyForm);
      await loadAlerts();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(alert) {
    setEditingId(alert.id);
    setForm({ title: alert.title ?? '', message: alert.message ?? '', severity: alert.severity ?? 'media', acknowledged: Boolean(alert.acknowledged) });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('alerts').delete().eq('id', id);
    if (!error) {
      setMessage('Alerta removido com sucesso.');
      await loadAlerts();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = alerts.filter((alert) => {
    const term = search.toLowerCase();
    return [alert.title, alert.message].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Monitoramento</p>
        <h1 className="mt-2 text-3xl font-semibold">Avisos</h1>
        <p className="mt-2 text-sm text-slate-400">Centralização dos alertas críticos e pendências.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar alerta' : 'Novo alerta'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critico">Crítico</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={form.acknowledged} onChange={(e) => setForm({ ...form, acknowledged: e.target.checked })} />
            Reconhecido
          </label>
          <textarea className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-2 xl:col-span-1" placeholder="Descrição" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Alertas cadastrados</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou descrição" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{alert.title}</h2>
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-sm text-rose-300">{alert.severity}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{alert.message}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(alert)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(alert.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

