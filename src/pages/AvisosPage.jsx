import { useState, useEffect } from 'react';

export default function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [form, setForm] = useState({ titulo: '', descricao: '', nivel: 'medio' });
  const [message, setMessage] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { loadAvisos(); }, []);

  async function loadAvisos() {
    try {
      const r = await fetch('/api/alertas');
      const data = await r.json();
      setAvisos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar avisos:', e);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo) { setMessage('⚠️ Título obrigatório'); return; }
    setCarregando(true);
    setMessage('');
    try {
      const r = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage(`❌ Erro: ${data.error || 'Erro desconhecido'}`);
      } else {
        setMessage('✅ Aviso criado! A sirene vai tocar em todos os computadores em até 1 minuto.');
        setForm({ titulo: '', descricao: '', nivel: 'medio' });
        loadAvisos();
      }
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  }

  async function toggleAtivo(aviso) {
    try {
      const novoStatus = aviso.lido ? 0 : 1;
      await fetch(`/api/alertas/${aviso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lido: novoStatus })
      });
      setMessage(novoStatus ? `🔕 Aviso "${aviso.titulo}" desativado.` : `🔔 Aviso "${aviso.titulo}" reativado!`);
      loadAvisos();
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    }
  }

  async function deletarAviso(aviso) {
    if (!window.confirm(`⚠️ Deletar o aviso "${aviso.titulo}"?\n\nEssa ação não pode ser desfeita.`)) return;
    try {
      await fetch(`/api/alertas/${aviso.id}`, { method: 'DELETE' });
      setMessage(`🗑️ Aviso deletado.`);
      loadAvisos();
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    }
  }

  const ativos = avisos.filter(a => !a.lido);
  const inativos = avisos.filter(a => a.lido);

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold">🔔 Avisos</h1>
      <p className="text-slate-400 mt-2">Central de alertas</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 max-w-md">
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Título *"
          value={form.titulo}
          onChange={(e) => setForm({...form, titulo: e.target.value})}
          required
        />
        <textarea
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          placeholder="Descrição"
          rows="3"
          value={form.descricao}
          onChange={(e) => setForm({...form, descricao: e.target.value})}
        />
        <select
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          value={form.nivel}
          onChange={(e) => setForm({...form, nivel: e.target.value})}
        >
          <option value="critico">🚨 Crítico</option>
          <option value="urgente">⚠️ Urgente</option>
          <option value="medio">🔔 Médio</option>
          <option value="baixo">📦 Baixo</option>
        </select>
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-orange-500 py-3 rounded-xl text-white font-semibold hover:bg-orange-600 disabled:opacity-50"
        >
          {carregando ? 'Cadastrando...' : 'Cadastrar'}
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.startsWith('✅') || message.startsWith('🔔') ? 'text-emerald-400' : message.startsWith('⚠️') ? 'text-yellow-400' : 'text-rose-400'}`}>
            {message}
          </p>
        )}
      </form>

      {/* AVISOS ATIVOS */}
      <div className="mt-6 space-y-2 max-w-2xl">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Avisos Ativos ({ativos.length})
        </h2>
        {ativos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum aviso ativo no momento.</p>
        ) : (
          ativos.map(a => (
            <div key={a.id} className="bg-slate-800 p-3 rounded-lg border-l-4 border-orange-500 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{a.titulo}</h3>
                {a.descricao && <p className="text-slate-400 text-sm">{a.descricao}</p>}
                <span className="text-xs text-slate-500 uppercase">{a.nivel}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleAtivo(a)}
                  className="rounded px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
                  title="Desativar aviso (para de tocar a sirene)"
                >
                  🔕 Desativar
                </button>
                <button
                  onClick={() => deletarAviso(a)}
                  className="rounded px-2 py-1.5 text-xs font-bold bg-slate-700 hover:bg-red-900 text-white"
                  title="Deletar aviso permanentemente"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AVISOS DESATIVADOS */}
      {inativos.length > 0 && (
        <div className="mt-6 space-y-2 max-w-2xl">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-600"></span>
            Desativados ({inativos.length})
          </h2>
          {inativos.map(a => (
            <div key={a.id} className="bg-slate-900/50 p-3 rounded-lg border-l-4 border-slate-700 flex items-start gap-3 opacity-60">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate line-through text-slate-500">{a.titulo}</h3>
                {a.descricao && <p className="text-slate-600 text-sm line-through">{a.descricao}</p>}
                <span className="text-xs text-slate-600 uppercase">{a.nivel}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleAtivo(a)}
                  className="rounded px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                  title="Reativar aviso (volta a tocar a sirene)"
                >
                  🔔 Reativar
                </button>
                <button
                  onClick={() => deletarAviso(a)}
                  className="rounded px-2 py-1.5 text-xs font-bold bg-slate-800 hover:bg-red-900 text-white"
                  title="Deletar aviso permanentemente"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
