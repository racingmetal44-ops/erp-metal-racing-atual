import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (!error) {
      setMessage('Login realizado com sucesso.');
      navigate('/dashboard');
    } else {
      setMessage(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-400">ERP Metal Racing</p>
        <h1 className="mt-2 text-3xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-slate-400">Acesse o sistema com suas credenciais do Supabase.</p>

        <label className="mt-6 block text-sm text-slate-400">E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />

        <label className="mt-4 block text-sm text-slate-400">Senha</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />

        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <a href="/register" className="mt-4 block text-center text-sm text-slate-400">Criar conta</a>
      </form>
    </div>
  );
}
