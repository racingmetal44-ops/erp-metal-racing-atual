import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  title: '',
  description: '',
  status: 'pendente',
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadSuggestions() {
    setLoading(true);
    const { data, error } = await supabase.from('suggestions').select('*').order('id', { ascending: false });
    if (!error) setSuggestions(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadSuggestions(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      const { error } = await supabase.from('suggestions').update(form).eq('id', editingId);
      if (!error) {
        setMessage('Sugestão atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadSuggestions();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('suggestions').insert(form);
    if (!error) {
      setMessage('Sugestão criada com sucesso.');
      setForm(emptyForm);
      await loadSuggestions();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(suggestion) {
    setEditingId(suggestion.id);
    setForm({ title: suggestion.title ?? '', description: suggestion.description ?? '', status: suggestion.status ?? 'pendente' });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (!error) {
      setMessage('Sugestão removida com sucesso.');
      await loadSuggestions();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = suggestions.filter((suggestion) => {
    const term = search.toLowerCase();
    return [suggestion.title, suggestion.description].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Sugestões</p>
        <h1 className="mt-2 text-3xl font-semibold">Sugestões</h1>
        <p className="mt-2 text-sm text-slate-400">Solicitações e ideias para melhoria do processo.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar sugestão' : 'Nova sugestão'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
          </select>
          <textarea className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-2 xl:col-span-1" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Sugestões cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou descrição" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="space-y-3">
            {filtered.map((suggestion) => (
              <div key={suggestion.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h2 className="font-semibold">{suggestion.title || 'Sugestão'}</h2>
                <p className="mt-2 text-sm text-slate-400">{suggestion.description}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(suggestion)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(suggestion.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

