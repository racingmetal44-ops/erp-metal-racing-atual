import { useState } from 'react';
import {
  UserPlus,
  User,
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ClipboardCheck,
  Package,
  QrCode
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function UsersPage() {
  const [form, setForm] = useState({
    nome_completo: '',
    cargo: 'Estoquista',
    pin: '',
    permissoes: {
      movimentacoes: true,
      consultar_estoque: true,
      bipagem: true,
    }
  });

  const [mostrarPin, setMostrarPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(null);

  const cargos = [
    'Estoquista',
    'Supervisor',
    'Administrador',
    'Gerente',
    'Operador'
  ];

  const permissoesLista = [
    { id: 'movimentacoes', label: 'Registrar movimentações', icon: ClipboardCheck },
    { id: 'consultar_estoque', label: 'Consultar estoque', icon: Package },
    { id: 'bipagem', label: 'Bipagem', icon: QrCode },
  ];

  function handlePermissaoChange(id) {
    setForm(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [id]: !prev.permissoes[id]
      }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      setMessage('⚠️ O PIN deve ter exatamente 4 dígitos');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        nome_completo: form.nome_completo,
        cargo: form.cargo,
        pin: form.pin || null,
        permissoes: form.permissoes,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .insert(payload);

      if (error) throw error;

      setMessage('✅ Perfil criado com sucesso!');
      setMessageType('success');

      setForm({
        nome_completo: '',
        cargo: 'Estoquista',
        pin: '',
        permissoes: {
          movimentacoes: true,
          consultar_estoque: true,
          bipagem: true,
        }
      });

    } catch (error) {
      setMessage(`❌ Erro ao criar perfil: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold">👤 Usuários</h1>
        <p className="mt-2 text-sm text-slate-400">Criação e gerenciamento de perfis de usuário.</p>
      </div>

      {/* FORMULÁRIO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Novo Perfil de Usuário</h2>

        {message && (
          <div className={`mb-4 p-4 rounded-xl border ${
            messageType === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome Completo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nome completo <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Digite o nome completo do usuário"
                value={form.nome_completo}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
              />
            </div>
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Cargo <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-3 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              >
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo}>{cargo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PIN */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-slate-300">
                PIN de 4 dígitos <span className="text-slate-500">(opcional)</span>
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              ⚠️ O PIN protege a identidade do operador na bipagem
            </p>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={mostrarPin ? 'text' : 'password'}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-12 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Digite um PIN de 4 dígitos (opcional)"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                maxLength={4}
                pattern="\d{4}"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
                onClick={() => setMostrarPin(!mostrarPin)}
              >
                {mostrarPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.pin && form.pin.length > 0 && form.pin.length !== 4 && (
              <p className="mt-1 text-xs text-amber-400">⚠️ O PIN deve ter exatamente 4 dígitos</p>
            )}
          </div>

          {/* Permissões */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <p className="text-sm font-medium text-slate-300 mb-3">
              Permissões do perfil selecionado:
            </p>
            <div className="space-y-2">
              {permissoesLista.map((permissao) => {
                const Icon = permissao.icon;
                const isChecked = form.permissoes[permissao.id];
                return (
                  <label
                    key={permissao.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                      isChecked
                        ? 'bg-orange-500/10 border border-orange-500/30'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`p-1 rounded ${isChecked ? 'text-orange-400' : 'text-slate-500'}`}>
                      <Icon size={18} />
                    </div>
                    <span className={`flex-1 text-sm ${isChecked ? 'text-slate-200' : 'text-slate-400'}`}>
                      {permissao.label}
                    </span>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        isChecked
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-slate-600 hover:border-slate-400'
                      }`}
                      onClick={() => handlePermissaoChange(permissao.id)}
                    >
                      {isChecked && <CheckCircle size={14} className="text-white" />}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
          >
            {loading ? (
              <span className="animate-pulse">Criando...</span>
            ) : (
              <>
                <UserPlus size={20} />
                Criar Perfil
              </>
            )}
          </button>
        </form>
      </div>

      {/* TOAST */}
      {message && messageType === 'success' && (
        <div className="fixed bottom-4 right-4 z-[9999] px-6 py-4 rounded-xl shadow-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          {message}
        </div>
      )}
    </div>
  );
}

