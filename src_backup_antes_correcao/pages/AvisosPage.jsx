import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [form, setForm] = useState({ titulo: '', descricao: '', nivel: 'medio' });
  const [message, setMessage] = useState('');

  useEffect(() => { loadAvisos(); }, []);

  async function loadAvisos() {
    const { data } = await supabase.from('avisos').select('*').order('created_at', { ascending: false });
    setAvisos(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo) { setMessage('?? Título obrigatório'); return; }
    const { error } = await supabase.from('avisos').insert(form);
    if (error) setMessage(`? Erro: ${error.message}`);
    else { setMessage('? Aviso criado!'); setForm({ titulo: '', descricao: '', nivel: 'medio' }); loadAvisos(); }
  }

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold">?? Avisos</h1>
      <p className="text-slate-400 mt-2">Central de alertas</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 max-w-md">
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Título *" value={form.titulo} onChange={(e) => setForm({...form, titulo: e.target.value})} required />
        <textarea className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Descrição" rows="3" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} />
        <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={form.nivel} onChange={(e) => setForm({...form, nivel: e.target.value})}>
          <option value="critico">?? Crético</option><option value="urgente">?? Urgente</option><option value="medio">?? Médio</option><option value="baixo">?? Baixo</option>
        </select>
        <button type="submit" className="w-full bg-orange-500 py-3 rounded-xl text-white font-semibold">Cadastrar</button>
        {message && <p className="mt-2">{message}</p>}
      </form>
      <div className="mt-6 space-y-2">
        {avisos.map(a => (
          <div key={a.id} className="bg-slate-800 p-3 rounded-lg">
            <h3 className="font-bold">{a.titulo}</h3>
            {a.descricao && <p className="text-slate-400 text-sm">{a.descricao}</p>}
            <span className="text-xs text-slate-500">{a.nivel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
