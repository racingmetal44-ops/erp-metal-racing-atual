import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: email.split('@')[0],
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível criar a conta.');
      }

      setMessage('Conta criada com sucesso. Faça login para acessar o ERP.');
      navigate('/login');
    } catch (error) {
      console.error('[AUTH] Erro no cadastro:', error);
      setMessage(error.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-400">ERP Metal Racing</p>
        <h1 className="mt-2 text-3xl font-semibold">Criar conta</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastre-se para acessar o ERP.</p>

        <label className="mt-6 block text-sm text-slate-400">E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />

        <label className="mt-4 block text-sm text-slate-400">Senha</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />

        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}

