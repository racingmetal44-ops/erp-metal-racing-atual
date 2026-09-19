import { useEffect, useState } from 'react';
import { UserPlus, Pencil, Trash2, Users as UsersIcon, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const API = '/api/auth/usuarios';

export default function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    email: '',
    password: '',
    perfil: 'USUARIO',
    ativo: 1,
  });

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch(API);
      const j = await r.json();
      if (j.success) setUsuarios(j.data || j.usuarios || []);
    } catch (e) {
      console.error(e);
      setMessage('Erro ao carregar usuários.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: '', email: '', password: '', perfil: 'USUARIO', ativo: 1 });
    setShowModal(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({
      nome: u.nome || '',
      email: u.email || '',
      password: '',
      perfil: u.perfil || 'USUARIO',
      ativo: Number(u.ativo) === 1 ? 1 : 0,
    });
    setShowModal(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setMessage('Informe o nome.');
      setMessageType('error');
      return;
    }

    setSalvando(true);
    try {
      const url = editando ? API + '/' + editando.id : API;
      const method = editando ? 'PUT' : 'POST';

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();

      if (!j.success) throw new Error(j.error || 'Erro ao salvar');

      setMessage(editando ? 'Usuário atualizado!' : 'Usuário criado!');
      setMessageType('success');
      setShowModal(false);
      await carregar();
    } catch (e) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(u) {
    if (!confirm('Desativar o usuário "' + u.nome + '"?')) return;
    try {
      const r = await fetch(API + '/' + u.id, { method: 'DELETE' });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      setMessage('Usuário desativado.');
      setMessageType('success');
      await carregar();
    } catch (e) {
      setMessage(e.message);
      setMessageType('error');
    }
  }

  async function reativar(u) {
    try {
      const r = await fetch(API + '/' + u.id + '/reativar', { method: 'PATCH' });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      setMessage('Usuário reativado.');
      setMessageType('success');
      await carregar();
    } catch (e) {
      setMessage(e.message);
      setMessageType('error');
    }
  }

  return (
    <div className="p-6 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-orange-500 font-bold">Equipe</div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <UsersIcon size={28}/> Usuários
          </h1>
          <p className="text-sm text-slate-400">Cadastre operadores que aparecerão no Quadro de Produção.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={carregar}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw size={16}/> Atualizar
          </button>
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600"
          >
            <UserPlus size={16}/> Novo usuário
          </button>
        </div>
      </div>

      {message && (
        <div className={
          'mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold ' +
          (messageType === 'success'
            ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
            : messageType === 'error'
              ? 'border-red-700 bg-red-950 text-red-300'
              : 'border-slate-700 bg-slate-900 text-slate-300')
        }>
          {messageType === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {message}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-[#091117] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum usuário cadastrado. Clique em "Novo usuário" para começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-xs font-black text-slate-400">
              <tr>
                <th className="px-4 py-3">NOME</th>
                <th className="px-4 py-3">E-MAIL</th>
                <th className="px-4 py-3">PERFIL</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-bold text-slate-100">{u.nome}</td>
                  <td className="px-4 py-3 text-slate-300">{u.email || <span className="text-slate-500">—</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{u.perfil || 'USUARIO'}</td>
                  <td className="px-4 py-3">
                    {Number(u.ativo) === 1 ? (
                      <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-[10px] font-black text-emerald-300">ATIVO</span>
                    ) : (
                      <span className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] font-black text-red-300">INATIVO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(u)}
                      className="mr-2 rounded p-1.5 text-blue-400 hover:bg-slate-800"
                      title="Editar"
                    >
                      <Pencil size={14}/>
                    </button>
                    {Number(u.ativo) === 1 ? (
                      <button
                        onClick={() => desativar(u)}
                        className="rounded p-1.5 text-red-400 hover:bg-red-950"
                        title="Desativar"
                      >
                        <Trash2 size={14}/>
                      </button>
                    ) : (
                      <button
                        onClick={() => reativar(u)}
                        className="rounded p-1.5 text-emerald-400 hover:bg-emerald-950"
                        title="Reativar"
                      >
                        <CheckCircle size={14}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowModal(false)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={salvar}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">
                {editando ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">E-mail (opcional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">
                  Senha (opcional)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={editando ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Perfil</label>
                <select
                  value={form.perfil}
                  onChange={e => setForm({ ...form, perfil: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                >
                  <option value="USUARIO">Usuário</option>
                  <option value="OPERADOR">Operador</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              {editando && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={Number(form.ativo) === 1}
                    onChange={e => setForm({ ...form, ativo: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="ativo" className="text-sm text-slate-300">Ativo</label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
