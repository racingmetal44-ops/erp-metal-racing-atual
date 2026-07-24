import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  name: '',
  document: '',
  status: 'ativo',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadCompanies() {
    setLoading(true);
    const { data, error } = await supabase.from('companies').select('*').order('id', { ascending: false });
    if (!error) setCompanies(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadCompanies(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      const { error } = await supabase.from('companies').update(form).eq('id', editingId);
      if (!error) {
        setMessage('Empresa atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadCompanies();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('companies').insert(form);
    if (!error) {
      setMessage('Empresa criada com sucesso.');
      setForm(emptyForm);
      await loadCompanies();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(company) {
    setEditingId(company.id);
    setForm({ name: company.name ?? '', document: company.document ?? '', status: company.status ?? 'ativo' });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (!error) {
      setMessage('Empresa removida com sucesso.');
      await loadCompanies();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = companies.filter((company) => {
    const term = search.toLowerCase();
    return [company.name, company.document].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Empresas</p>
        <h1 className="mt-2 text-3xl font-semibold">Empresas</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastro e relacionamento com estruturas do grupo.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar empresa' : 'Nova empresa'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Empresas cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou documento" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((company) => (
              <div key={company.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="mt-2 text-sm text-slate-400">{company.document || 'Documento não informado'}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(company)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(company.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

