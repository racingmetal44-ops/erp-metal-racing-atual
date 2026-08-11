import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  name: '',
  document: '',
  status: 'ativo',
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  regime_tributario: '',
  address: '',
  cep: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  codigo_ibge: '',
  telefone: '',
  email: '',
  serie_nfe: '1',
  next_nfe_number: '',
  ambiente_nf: 'homologacao',
  sefaz_uf: '',
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
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Razão Social" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome Fantasia" value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Inscrição Estadual" value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Inscrição Municipal" value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.regime_tributario} onChange={(e) => setForm({ ...form, regime_tributario: e.target.value })}>
            <option value="">Regime Tributário</option>
            <option value="simples">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Código IBGE" value={form.codigo_ibge} onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Série da NF-e" value={form.serie_nfe} onChange={(e) => setForm({ ...form, serie_nfe: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Número inicial / próximo" value={form.next_nfe_number} onChange={(e) => setForm({ ...form, next_nfe_number: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.ambiente_nf} onChange={(e) => setForm({ ...form, ambiente_nf: e.target.value })}>
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="UF da SEFAZ" value={form.sefaz_uf} onChange={(e) => setForm({ ...form, sefaz_uf: e.target.value })} />
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Certificado Digital (A1)</h2>
          <p className="mt-2 text-sm text-slate-400">O arquivo do certificado e a senha são enviados ao servidor e armazenados de forma segura. Nunca expostos no frontend.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="file" id="certFile" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <input type="password" id="certPassword" placeholder="Senha do certificado" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <button onClick={async () => {
              const fileInput = document.getElementById('certFile');
              const pwdInput = document.getElementById('certPassword');
              if (!fileInput.files.length) return alert('Selecione o arquivo do certificado');
              if (!editingId) return alert('Salve a empresa antes de enviar o certificado.');
              const file = fileInput.files[0];
              const name = (file.name || '').toLowerCase();
              if (!name.endsWith('.pfx') && !name.endsWith('.p12')) return alert('Selecione um arquivo .pfx ou .p12');
              const MAX = 5 * 1024 * 1024;
              if (file.size > MAX) return alert('Arquivo do certificado muito grande. Máx 5MB');
              const fd = new FormData();
              fd.append('certificado', file);
              fd.append('company_id', editingId);
              fd.append('password', pwdInput.value || '');
              try {
                const res = await fetch('/api/empresas/certificado', { method: 'POST', body: fd });
                let json = null;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                  try { json = await res.json(); } catch (e) { json = null; }
                } else {
                  const text = await res.text();
                  try { json = JSON.parse(text); } catch (e) { json = null; }
                }
                if (!res.ok) {
                  const errMsg = (json && (json.mensagem || json.error || json.message)) || `HTTP ${res.status}`;
                  return alert('Falha ao enviar certificado: ' + errMsg);
                }
                const ok = (json && (json.sucesso || json.ok || json.success));
                if (!ok) return alert('Falha ao enviar certificado: resposta inválida.');
                alert(json.mensagem || 'Certificado enviado com sucesso.');
              } catch (err) { alert('Erro: ' + (err.message || err)); }
            }} className="rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">Enviar certificado</button>
            <button onClick={async () => {
              const fileInput = document.getElementById('certFile');
              const pwdInput = document.getElementById('certPassword');
              if (!fileInput.files.length) return alert('Selecione o arquivo do certificado');
              if (!editingId) return alert('Salve a empresa antes de testar o certificado.');
              // upload then test
              try {
                const file = fileInput.files[0];
                const name = (file.name || '').toLowerCase();
                if (!name.endsWith('.pfx') && !name.endsWith('.p12')) return alert('Selecione um arquivo .pfx ou .p12');
                const MAX = 5 * 1024 * 1024;
                if (file.size > MAX) return alert('Arquivo do certificado muito grande. Máx 5MB');
                const fd = new FormData();
                fd.append('certificado', file);
                fd.append('company_id', editingId);
                const res = await fetch('/api/empresas/certificado', { method: 'POST', body: fd });
                let json = null;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                  try { json = await res.json(); } catch (e) { json = null; }
                } else {
                  const text = await res.text();
                  try { json = JSON.parse(text); } catch (e) { json = null; }
                }
                if (!res.ok) {
                  const errMsg = (json && (json.mensagem || json.error || json.message)) || `HTTP ${res.status}`;
                  return alert('Falha ao enviar certificado: ' + errMsg);
                }
                const path = json && (json.path || json.stored_path || null);
                // call testar endpoint using stored path if available, otherwise pass company_id
                const body = path ? { stored_path: path } : { company_id: editingId };
                const test = await fetch('/api/empresas/certificado/testar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                let testJson = null;
                try { testJson = await test.json(); } catch (e) { const t = await test.text(); try { testJson = JSON.parse(t); } catch { testJson = null; } }
                if (!test.ok) {
                  const errMsg = (testJson && (testJson.mensagem || testJson.error || testJson.message)) || `HTTP ${test.status}`;
                  return alert('Teste falhou: ' + errMsg);
                }
                if (testJson && (testJson.valido || testJson.ok || testJson.sucesso)) alert('Teste OK. Tamanho: ' + (testJson.tamanho || testJson.size || 'n/a'));
                else alert('Teste falhou: resposta inválida.');
              } catch (err) { alert('Erro: ' + (err.message || err)); }
            }} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200">Testar certificado</button>
          </div>
        </div>
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

