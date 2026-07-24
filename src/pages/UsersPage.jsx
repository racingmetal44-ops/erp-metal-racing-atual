import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para contextos sem crypto.randomUUID (ex.: acesso via IP em http, não localhost)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const roleOptions = [
  { value: 'operador', label: 'Operador' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'estoquista', label: 'Estoquista' },
  { value: 'producao', label: 'Produção' },
  { value: 'expedicao', label: 'Expedição' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'auxiliar_producao', label: 'Auxiliar de Produção' },
];

// Mesma lista de páginas do menu lateral (src/components/layout/Layout.jsx).
// Se adicionar uma página nova lá, adicione aqui também para poder liberar o acesso.
const pageOptions = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/estoque', label: 'Estoque' },
  { path: '/bipagem', label: 'Bipagem' },
  { path: '/producao', label: 'Produção' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/nfe', label: 'NF-e' },
  { path: '/financeiro', label: 'Financeiro' },
  { path: '/ranking', label: 'Ranking' },
  { path: '/avisos', label: 'Avisos' },
  { path: '/usuarios', label: 'Usuários' },
  { path: '/etiquetas', label: 'Etiquetas' },
  { path: '/expedicao', label: 'Expedição' },
  { path: '/tv', label: 'TV Operacional' },
  { path: '/configuracoes', label: 'Configurações' },
  { path: '/ia', label: 'IA Executiva' },
  { path: '/planilhas', label: 'Planilhas' },
  { path: '/mapa-estoque', label: 'Mapa de Estoque' },
  { path: '/empresas', label: 'Empresas' },
  { path: '/devolucoes', label: 'Devoluções' },
  { path: '/sugestoes', label: 'Sugestões' },
  { path: '/auditoria', label: 'Auditoria' },
  { path: '/importacao', label: 'Importação' },
];

const emptyForm = {
  full_name: '',
  email: '',
  role_profile: 'operador',
  status: 'ativo',
  permissions: [],
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from('user_profiles').select('*').order('id', { ascending: false });
    if (!error) setUsers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function togglePermission(path) {
    setForm((current) => {
      const has = current.permissions.includes(path);
      return {
        ...current,
        permissions: has
          ? current.permissions.filter((p) => p !== path)
          : [...current.permissions, path],
      };
    });
  }

  function toggleAllPermissions() {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.length === pageOptions.length
        ? []
        : pageOptions.map((p) => p.path),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (editingId) {
      const { error } = await supabase.from('user_profiles').update(form).eq('id', editingId);
      if (!error) {
        setMessage('Usuário atualizado com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadUsers();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('user_profiles').insert({
      ...form,
      user_id: generateId(),
    });
    if (!error) {
      setMessage('Usuário criado com sucesso.');
      setForm(emptyForm);
      await loadUsers();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(user) {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      role_profile: user.role_profile ?? 'operador',
      status: user.status ?? 'ativo',
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('user_profiles').delete().eq('id', id);
    if (!error) {
      setMessage('Usuário removido com sucesso.');
      await loadUsers();
    } else {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Cadastros</p>
        <h1 className="mt-2 text-3xl font-semibold">Usuários</h1>
        <p className="mt-2 text-sm text-slate-400">Gestão de perfis e acesso ao sistema.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar usuário' : 'Novo usuário'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.role_profile} onChange={(e) => setForm({ ...form, role_profile: e.target.value })}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>

          <div className="md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm text-slate-400">Páginas que este usuário pode acessar</label>
              <button
                type="button"
                onClick={toggleAllPermissions}
                className="text-xs font-semibold text-orange-400 hover:text-orange-300"
              >
                {form.permissions.length === pageOptions.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>
            <div className="mt-2 grid gap-2 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {pageOptions.map((page) => (
                <label key={page.path} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(page.path)}
                    onChange={() => togglePermission(page.path)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                  />
                  {page.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h2 className="text-lg font-semibold">{user.full_name || user.email}</h2>
                <p className="mt-2 text-sm text-slate-400">{user.email}</p>
                <p className="mt-2 text-sm text-slate-500">Função: {user.role_profile || 'usuário'}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {Array.isArray(user.permissions) && user.permissions.length > 0
                    ? `Acesso a ${user.permissions.length} página(s)`
                    : 'Nenhuma página liberada ainda'}
                </p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(user)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => handleDelete(user.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
