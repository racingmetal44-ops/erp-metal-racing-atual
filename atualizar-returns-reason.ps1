# Atualizar ReturnsPage com tratamento para reason
$file = ".\src\pages\ReturnsPage.jsx"
$backup = ".\src\pages\ReturnsPage.jsx.bak"

# Backup
Copy-Item $file $backup -Force

$content = @"
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  return_date: '',
  order_number: '',
  customer_name: '',
  product_name: '',
  reason: 'Outros',
  affected: '',
  product_value: '',
  cost: '',
  status: 'pendente',
  notes: '',
  original_nfe_number: '',
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function loadReturns() {
    setLoading(true);
    const { data, error } = await supabase.from('return_notes').select('*').order('id', { ascending: false });
    if (!error) setReturns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadReturns(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    
    const formData = {
      ...form,
      original_nfe_number: form.original_nfe_number || 'SEM_NFE',
      reason: form.reason || 'Outros'
    };
    
    if (editingId) {
      const { error } = await supabase.from('return_notes').update(formData).eq('id', editingId);
      if (!error) {
        setMessage('Devolução atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadReturns();
      } else {
        setMessage(error.message);
      }
      return;
    }

    const { error } = await supabase.from('return_notes').insert(formData);
    if (!error) {
      setMessage('Devolução criada com sucesso.');
      setForm(emptyForm);
      await loadReturns();
    } else {
      setMessage(error.message);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      return_date: item.return_date ?? '',
      order_number: item.order_number ?? '',
      customer_name: item.customer_name ?? '',
      product_name: item.product_name ?? '',
      reason: item.reason ?? 'Outros',
      affected: item.affected ?? '',
      product_value: item.product_value ?? '',
      cost: item.cost ?? '',
      status: item.status ?? 'pendente',
      notes: item.notes ?? '',
      original_nfe_number: item.original_nfe_number ?? '',
    });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('return_notes').delete().eq('id', id);
    if (!error) {
      setMessage('Devolução removida com sucesso.');
      await loadReturns();
    } else {
      setMessage(error.message);
    }
  }

  const filtered = returns.filter((item) => {
    const term = search.toLowerCase();
    return [
      item.return_date || '', 
      item.order_number || '', 
      item.customer_name || '', 
      item.product_name || '',
      item.reason || ''
    ].join(' ').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Devoluções</p>
        <h1 className="mt-2 text-3xl font-semibold">Devoluções</h1>
        <p className="mt-2 text-sm text-slate-400">Gerenciamento de devoluções e notas de retorno.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar devolução' : 'Nova devolução'}</h2>
        {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            type="date"
            placeholder="Data" 
            value={form.return_date} 
            onChange={(e) => setForm({ ...form, return_date: e.target.value })} 
            required 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Número do pedido" 
            value={form.order_number} 
            onChange={(e) => setForm({ ...form, order_number: e.target.value })} 
            required 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Cliente" 
            value={form.customer_name} 
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })} 
            required 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Produto" 
            value={form.product_name} 
            onChange={(e) => setForm({ ...form, product_name: e.target.value })} 
            required 
          />
          <select 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            value={form.reason} 
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          >
            <option value="Defeito">Defeito</option>
            <option value="Arrependimento">Arrependimento</option>
            <option value="Produto diferente">Produto diferente</option>
            <option value="Produto danificado">Produto danificado</option>
            <option value="Entrega atrasada">Entrega atrasada</option>
            <option value="Outros">Outros</option>
          </select>
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Afetou (ex: embalagem, transporte)" 
            value={form.affected} 
            onChange={(e) => setForm({ ...form, affected: e.target.value })} 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            type="number"
            step="0.01"
            placeholder="Valor do produto" 
            value={form.product_value} 
            onChange={(e) => setForm({ ...form, product_value: e.target.value })} 
            required 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            type="number"
            step="0.01"
            placeholder="Custo" 
            value={form.cost} 
            onChange={(e) => setForm({ ...form, cost: e.target.value })} 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Nº Nota Fiscal Original" 
            value={form.original_nfe_number} 
            onChange={(e) => setForm({ ...form, original_nfe_number: e.target.value })} 
          />
          <select 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            value={form.status} 
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
          </select>
          <textarea 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-2 xl:col-span-1" 
            placeholder="Observações" 
            value={form.notes} 
            onChange={(e) => setForm({ ...form, notes: e.target.value })} 
          />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 transition">
              {editingId ? 'Salvar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button 
                type="button" 
                onClick={() => { setEditingId(null); setForm(emptyForm); }} 
                className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Devoluções cadastradas</h2>
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Buscar por data, pedido, cliente, produto ou motivo" 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 w-full md:w-96" 
          />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 col-span-full text-center py-8">
                Nenhuma devolução cadastrada.
              </p>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 hover:border-slate-700 transition">
                  <div className="flex justify-between items-start">
                    <h2 className="text-lg font-semibold">#{item.order_number || 'N/A'}</h2>
                    <span className={'text-xs px-2 py-1 rounded-full ' + (
                      item.status === 'aprovada' ? 'bg-green-500/20 text-green-400' :
                      item.status === 'rejeitada' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Data: {item.return_date || 'N/D'}</p>
                  <p className="mt-1 text-sm text-slate-400">Cliente: {item.customer_name || 'N/D'}</p>
                  <p className="mt-1 text-sm text-slate-400">Produto: {item.product_name || 'N/D'}</p>
                  <p className="mt-1 text-sm text-slate-400">Motivo: {item.reason || 'N/D'}</p>
                  {item.affected && <p className="mt-1 text-sm text-slate-400">Afetou: {item.affected}</p>}
                  {item.original_nfe_number && <p className="mt-1 text-sm text-slate-400">NF-e: {item.original_nfe_number}</p>}
                  <div className="mt-2 flex gap-3 text-sm">
                    <span className="text-slate-400">Valor: R$ {parseFloat(item.product_value || 0).toFixed(2)}</span>
                    {item.cost && <span className="text-slate-400">Custo: R$ {parseFloat(item.cost).toFixed(2)}</span>}
                  </div>
                  {item.notes && <p className="mt-2 text-sm text-slate-500">Obs: {item.notes}</p>}
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleEdit(item)} 
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 transition"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10 transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
"@

# Escreve o novo conteúdo
Set-Content -Path $file -Value $content -Encoding UTF8

Write-Host "✅ Arquivo $file atualizado!"
Write-Host "📋 Backup salvo em: $backup"
Write-Host ""
Write-Host "Agora execute: npm run dev"
