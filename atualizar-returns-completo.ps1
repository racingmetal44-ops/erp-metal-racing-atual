# Atualizar ReturnsPage com todos os campos
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
  reason: '',
  reason_notes: '',
  total_value: '',
  cost: '',
  status: 'rascunho',
  company_name: '',
  original_access_key: '',
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
      return_date: form.return_date || null,
      order_number: form.order_number || '',
      customer_name: form.customer_name || '',
      reason: form.reason || '',
      reason_notes: form.reason_notes || '',
      total_value: parseFloat(form.total_value) || 0,
      cost: parseFloat(form.cost) || 0,
      status: form.status || 'rascunho',
      company_name: form.company_name || '',
      original_access_key: form.original_access_key || '',
      original_nfe_number: form.original_nfe_number || 'SEM_NFE',
    };
    
    if (editingId) {
      const { error } = await supabase.from('return_notes').update(formData).eq('id', editingId);
      if (!error) {
        setMessage('Devolução atualizada com sucesso.');
        setEditingId(null);
        setForm(emptyForm);
        await loadReturns();
      } else {
        setMessage('Erro: ' + error.message);
      }
      return;
    }

    const { error } = await supabase.from('return_notes').insert(formData);
    if (!error) {
      setMessage('Devolução criada com sucesso.');
      setForm(emptyForm);
      await loadReturns();
    } else {
      setMessage('Erro: ' + error.message);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      return_date: item.return_date ?? '',
      order_number: item.order_number ?? '',
      customer_name: item.customer_name ?? '',
      reason: item.reason ?? '',
      reason_notes: item.reason_notes ?? '',
      total_value: item.total_value ?? '',
      cost: item.cost ?? '',
      status: item.status ?? 'rascunho',
      company_name: item.company_name ?? '',
      original_access_key: item.original_access_key ?? '',
      original_nfe_number: item.original_nfe_number ?? '',
    });
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('return_notes').delete().eq('id', id);
    if (!error) {
      setMessage('Devolução removida com sucesso.');
      await loadReturns();
    } else {
      setMessage('Erro: ' + error.message);
    }
  }

  const filtered = returns.filter((item) => {
    const term = search.toLowerCase();
    return [
      item.return_date || '', 
      item.order_number || '', 
      item.customer_name || '', 
      item.reason || '',
      item.company_name || ''
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
            placeholder="Empresa" 
            value={form.company_name} 
            onChange={(e) => setForm({ ...form, company_name: e.target.value })} 
          />
          <select 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            value={form.reason} 
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          >
            <option value="">Selecione o motivo</option>
            <option value="produto_com_defeito">Produto com defeito</option>
            <option value="cliente_de_servico">Cliente de serviço</option>
            <option value="arrependimento">Arrependimento</option>
            <option value="produto_diferente">Produto diferente</option>
            <option value="entrega_atrasada">Entrega atrasada</option>
            <option value="outros">Outros</option>
          </select>
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            placeholder="Detalhes do motivo" 
            value={form.reason_notes} 
            onChange={(e) => setForm({ ...form, reason_notes: e.target.value })} 
          />
          <input 
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" 
            type="number"
            step="0.01"
            placeholder="Valor total" 
            value={form.total_value} 
            onChange={(e) => setForm({ ...form, total_value: e.target.value })} 
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
            placeholder="Chave de acesso original" 
            value={form.original_access_key} 
            onChange={(e) => setForm({ ...form, original_access_key: e.target.value })} 
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
            <option value="rascunho">Rascunho</option>
            <option value="autorizada">Autorizada</option>
            <option value="criado">Criado</option>
          </select>
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
            placeholder="Buscar por pedido, cliente, motivo ou empresa" 
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
                      item.status === 'autorizada' ? 'bg-green-500/20 text-green-400' :
                      item.status === 'criado' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Data: {item.return_date || 'N/D'}</p>
                  <p className="mt-1 text-sm text-slate-400">Cliente: {item.customer_name || 'N/D'}</p>
                  <p className="mt-1 text-sm text-slate-400">Motivo: {item.reason || 'N/D'}</p>
                  {item.reason_notes && <p className="mt-1 text-sm text-slate-400">Detalhes: {item.reason_notes}</p>}
                  {item.company_name && <p className="mt-1 text-sm text-slate-400">Empresa: {item.company_name}</p>}
                  {item.original_nfe_number && <p className="mt-1 text-sm text-slate-400">NF-e: {item.original_nfe_number}</p>}
                  {item.original_access_key && (
                    <p className="mt-1 text-sm text-slate-400">Chave: {item.original_access_key.substring(0, 10)}...</p>
                  )}
                  <div className="mt-2 flex gap-3 text-sm">
                    <span className="text-slate-400">Valor: R$ {parseFloat(item.total_value || 0).toFixed(2)}</span>
                    {item.cost && item.cost > 0 && <span className="text-slate-400">Custo: R$ {parseFloat(item.cost).toFixed(2)}</span>}
                  </div>
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

Write-Host "✅ Arquivo $file atualizado com todos os campos!"
Write-Host "📋 Backup salvo em: $backup"
Write-Host ""
Write-Host "Execute este SQL no Supabase também:"
Write-Host "ALTER TABLE return_notes ALTER COLUMN original_nfe_number DROP NOT NULL;"
Write-Host ""
Write-Host "Depois execute: npm run dev"
