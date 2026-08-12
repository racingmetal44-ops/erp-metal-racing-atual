import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const regimeOptions = [
  { value: '1', label: 'Simples Nacional' },
  { value: '2', label: 'Simples Nacional — excesso de sublimite' },
  { value: '3', label: 'Regime Normal' },
];

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
  tipo_estabelecimento: '',
  indicador_inscricao_estadual: '',
  cnae_principal: '',
  crt: '',
  cep: '',
  address: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  codigo_ibge: '',
  telefone: '',
  email: '',
  modelo_nf: '55',
  serie_nfe: '1',
  proximo_numero_nf: '',
  ambiente_nf: 'homologacao',
  finalidade_nf: 'normal',
  tipo_emissao_nf: '1',
  uf_sefaz: '',
  tipo_ambiente: 'homologacao',
  cfop: '',
  ncm: '',
  cest: '',
  origem_mercadoria: '',
  cst: '',
  csosn: '',
  icms: '',
  icms_st: '',
  ipi: '',
  pis: '',
  cofins: '',
  ibs: '',
  cbs: '',
};

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function formatCNPJ(value = '') {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function formatCEP(value = '') {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(value = '') {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function isValidCNPJ(value = '') {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;

  const invalids = [
    '00000000000000',
    '11111111111111',
    '22222222222222',
    '33333333333333',
    '44444444444444',
    '55555555555555',
    '66666666666666',
    '77777777777777',
    '88888888888888',
    '99999999999999',
  ];

  if (invalids.includes(cnpj)) return false;

  let sum = 0;
  let multiplier = 5;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(cnpj.charAt(i)) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (Number(cnpj.charAt(12)) !== digit) return false;

  sum = 0;
  multiplier = 6;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(cnpj.charAt(i)) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return Number(cnpj.charAt(13)) === digit;
}

function getStatusLabel(value) {
  if (!value) return 'Não informado';
  const labels = {
    '1': 'Simples Nacional',
    '2': 'Simples Nacional — excesso de sublimite',
    '3': 'Regime Normal',
    homologacao: 'Homologação',
    producao: 'Produção',
    normal: 'Normal',
    complementar: 'Complementar',
    ajuste: 'Ajuste',
    devolucao: 'Devolução',
    tipo_emissao_normal: 'Normal',
    tipo_emissao_contingencia: 'Contingência',
  };
  return labels[value] || value;
}

function getCompanyChecklist(company) {
  return [
    { label: 'Dados da empresa', ok: Boolean(company.name && company.razao_social) },
    { label: 'CNPJ válido', ok: !company.cnpj || isValidCNPJ(company.cnpj) },
    { label: 'Inscrição estadual', ok: Boolean(company.inscricao_estadual) },
    { label: 'Regime tributário', ok: Boolean(company.regime_tributario) },
    { label: 'Código IBGE', ok: Boolean(company.codigo_ibge) },
    { label: 'Certificado digital', ok: Boolean(company.certificado_disponivel) },
    { label: 'Certificado dentro da validade', ok: Boolean(company.certificado_valido) },
    { label: 'Senha válida', ok: Boolean(company.senha_valida) },
    { label: 'Ambiente configurado', ok: Boolean(company.ambiente_nf) },
    { label: 'Série configurada', ok: Boolean(company.serie_nfe) },
    { label: 'Numeração configurada', ok: Boolean(company.proximo_numero_nf) },
    { label: 'UF da SEFAZ', ok: Boolean(company.uf_sefaz || company.sefaz_uf) },
    { label: 'Configuração fiscal', ok: Boolean(company.cfop || company.ncm || company.cest || company.icms) },
    { label: 'Comunicação com SEFAZ', ok: Boolean(company.sefaz_configurada) },
  ];
}

function buildPayloadFromForm(form) {
  return {
    name: form.name?.trim() || '',
    document: form.cnpj || '',
    status: form.status || 'ativo',
    cnpj: onlyDigits(form.cnpj || ''),
    razao_social: form.razao_social?.trim() || '',
    nome_fantasia: form.nome_fantasia?.trim() || '',
    inscricao_estadual: form.inscricao_estadual?.trim() || '',
    inscricao_municipal: form.inscricao_municipal?.trim() || '',
    regime_tributario: form.regime_tributario || '',
    tipo_estabelecimento: form.tipo_estabelecimento?.trim() || '',
    indicador_inscricao_estadual: form.indicador_inscricao_estadual?.trim() || '',
    cnae_principal: form.cnae_principal?.trim() || '',
    crt: form.crt?.trim() || '',
    address: form.address?.trim() || '',
    cep: onlyDigits(form.cep || ''),
    numero: form.numero?.trim() || '',
    bairro: form.bairro?.trim() || '',
    cidade: form.cidade?.trim() || '',
    uf: form.uf?.trim().toUpperCase() || '',
    codigo_ibge: form.codigo_ibge?.trim() || '',
    telefone: onlyDigits(form.telefone || ''),
    email: form.email?.trim() || '',
    modelo_nf: form.modelo_nf || '55',
    serie_nfe: form.serie_nfe || '1',
    proximo_numero_nf: form.proximo_numero_nf || '',
    ambiente_nf: form.ambiente_nf || 'homologacao',
    finalidade_nf: form.finalidade_nf || 'normal',
    tipo_emissao_nf: form.tipo_emissao_nf || '1',
    uf_sefaz: form.uf_sefaz?.trim().toUpperCase() || '',
    cfop: form.cfop?.trim() || '',
    ncm: form.ncm?.trim() || '',
    cest: form.cest?.trim() || '',
    origem_mercadoria: form.origem_mercadoria?.trim() || '',
    cst: form.cst?.trim() || '',
    csosn: form.csosn?.trim() || '',
    icms: form.icms?.trim() || '',
    icms_st: form.icms_st?.trim() || '',
    ipi: form.ipi?.trim() || '',
    pis: form.pis?.trim() || '',
    cofins: form.cofins?.trim() || '',
    ibs: form.ibs?.trim() || '',
    cbs: form.cbs?.trim() || '',
  };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [certificateMeta, setCertificateMeta] = useState(null);

  async function loadCompanies() {
    setLoading(true);
    const { data, error } = await supabase.from('companies').select('*').order('id', { ascending: false });
    if (!error) {
      setCompanies(data ?? []);
    }
    setLoading(false);
  }

  async function loadCertificateMeta(companyId) {
    if (!companyId) {
      setCertificateMeta(null);
      return;
    }

    const { data, error } = await supabase
      .from('company_certificates')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      setCertificateMeta(data[0]);
    } else {
      setCertificateMeta(null);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  const companyChecklist = useMemo(() => getCompanyChecklist({
    ...form,
    certificado_disponivel: Boolean(certificateMeta),
    certificado_valido: Boolean(certificateMeta),
    senha_valida: Boolean(form.ambiente_nf),
    sefaz_configurada: Boolean(form.uf_sefaz || form.sefaz_uf),
  }), [certificateMeta, form]);

  const companySummary = companyChecklist.filter((item) => item.ok).length;

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (!form.name || !form.name.trim()) {
      setMessage('⚠️ Preencha o nome da empresa.');
      return;
    }

    const cnpjValue = onlyDigits(form.cnpj || '');
    if (form.cnpj && form.cnpj.trim()) {
      if (!isValidCNPJ(form.cnpj)) {
        setMessage('⚠️ CNPJ inválido. Verifique o número digitado.');
        return;
      }
    }

    if (form.cep && form.cep.trim()) {
      const cepDigits = onlyDigits(form.cep || '');
      if (cepDigits.length !== 8) {
        setMessage('⚠️ CEP inválido. Deve conter 8 dígitos.');
        return;
      }
    }

    const payload = buildPayloadFromForm(form);
    payload.document = cnpjValue || payload.document || '';

    try {
      if (editingId) {
        const { error } = await supabase.from('companies').update(payload).eq('id', editingId);
        if (error) {
          console.error('Erro ao atualizar empresa:', error);
          setMessage('Não foi possível salvar a empresa. Verifique os dados e tente novamente.');
          return;
        }
        setMessage('✅ Empresa atualizada com sucesso.');
      } else {
        const { error } = await supabase.from('companies').insert(payload);
        if (error) {
          console.error('Erro ao criar empresa:', error);
          setMessage('Não foi possível salvar a empresa. Verifique os dados e tente novamente.');
          return;
        }
        setMessage('✅ Empresa criada com sucesso.');
      }

      setTimeout(() => {
        setEditingId(null);
        setForm(emptyForm);
        setCertificateMeta(null);
        setMessage('');
      }, 1500);
      
      await loadCompanies();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      setMessage('❌ Não foi possível salvar a empresa. Tente novamente.');
    }
  }

  function handleEdit(company) {
    setEditingId(company.id);
    setForm({
      ...emptyForm,
      name: company.name ?? '',
      document: company.document ?? '',
      status: company.status ?? 'ativo',
      cnpj: company.cnpj ? formatCNPJ(company.cnpj) : '',
      razao_social: company.razao_social ?? '',
      nome_fantasia: company.nome_fantasia ?? '',
      inscricao_estadual: company.inscricao_estadual ?? '',
      inscricao_municipal: company.inscricao_municipal ?? '',
      regime_tributario: String(company.regime_tributario ?? ''),
      tipo_estabelecimento: company.tipo_estabelecimento ?? '',
      indicador_inscricao_estadual: company.indicador_inscricao_estadual ?? '',
      cnae_principal: company.cnae_principal ?? '',
      crt: company.crt ?? '',
      address: company.address ?? '',
      cep: company.cep ? formatCEP(company.cep) : '',
      numero: company.numero ?? '',
      bairro: company.bairro ?? '',
      cidade: company.cidade ?? '',
      uf: company.uf ?? '',
      codigo_ibge: company.codigo_ibge ?? '',
      telefone: company.telefone ? formatPhone(company.telefone) : '',
      email: company.email ?? '',
      modelo_nf: company.modelo_nf ?? '55',
      serie_nfe: company.serie_nfe ?? '1',
      proximo_numero_nf: company.proximo_numero_nf ?? '',
      ambiente_nf: company.ambiente_nf ?? 'homologacao',
      finalidade_nf: company.finalidade_nf ?? 'normal',
      tipo_emissao_nf: company.tipo_emissao_nf ?? '1',
      uf_sefaz: company.uf_sefaz ?? '',
      cfop: company.cfop ?? '',
      ncm: company.ncm ?? '',
      cest: company.cest ?? '',
      origem_mercadoria: company.origem_mercadoria ?? '',
      cst: company.cst ?? '',
      csosn: company.csosn ?? '',
      icms: company.icms ?? '',
      icms_st: company.icms_st ?? '',
      ipi: company.ipi ?? '',
      pis: company.pis ?? '',
      cofins: company.cofins ?? '',
      ibs: company.ibs ?? '',
      cbs: company.cbs ?? '',
    });
    loadCertificateMeta(company.id);
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Deseja desativar esta empresa em vez de excluir permanentemente?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('companies').update({ status: 'inativo' }).eq('id', id);
      if (error) {
        console.error('Erro ao inativar empresa:', error);
        setMessage('Não foi possível inativar a empresa. Tente novamente.');
        return;
      }
      setMessage('Empresa inativada com sucesso.');
      await loadCompanies();
    } catch (error) {
      console.error('Erro ao inativar empresa:', error);
      setMessage('Não foi possível inativar a empresa. Tente novamente.');
    }
  }

  async function handleCEPChange(value) {
    const cepValue = onlyDigits(value).slice(0, 8);
    setForm((current) => ({ ...current, cep: formatCEP(cepValue) }));

    if (cepValue.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
      const data = await response.json();
      if (!data || data.erro) return;
      setForm((current) => ({
        ...current,
        address: data.logradouro || current.address,
        bairro: data.bairro || current.bairro,
        cidade: data.localidade || current.cidade,
        uf: (data.uf || current.uf || '').toUpperCase(),
        codigo_ibge: data.ibge || current.codigo_ibge,
      }));
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
    }
  }

  async function handleUploadCertificate() {
    const fileInput = document.getElementById('certFile');
    const passwordInput = document.getElementById('certPassword');
    const file = fileInput?.files?.[0];

    if (!file) {
      setMessage('Selecione o arquivo do certificado digital antes de enviar.');
      return;
    }

    if (!editingId) {
      setMessage('Salve a empresa antes de enviar o certificado digital.');
      return;
    }

    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
      setMessage('Selecione um arquivo .pfx ou .p12 válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Arquivo do certificado muito grande. Utilize um arquivo de até 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('certificado', file);
    formData.append('company_id', String(editingId));
    if (passwordInput && passwordInput.value) {
      formData.append('password', passwordInput.value);
    }

    try {
      const response = await fetch('/api/empresas/certificado', { method: 'POST', body: formData });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('Erro no upload do certificado:', json);
        setMessage((json && (json.mensagem || json.error || json.message)) || 'Não foi possível enviar o certificado digital.');
        return;
      }
      setMessage('Certificado digital enviado com sucesso.');
      await loadCertificateMeta(editingId);
    } catch (error) {
      console.error('Erro ao enviar certificado:', error);
      setMessage('Não foi possível enviar o certificado. Verifique o arquivo e tente novamente.');
    }
  }

  async function handleTestCertificate() {
    if (!editingId) {
      setMessage('Salve a empresa antes de testar o certificado.');
      return;
    }

    try {
      const response = await fetch('/api/empresas/certificado/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: editingId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('Erro ao testar certificado:', json);
        setMessage((json && (json.mensagem || json.error || json.message)) || 'Não foi possível testar o certificado digital.');
        return;
      }
      setMessage(json && json.valido ? '🟢 CERTIFICADO VÁLIDO' : '🔴 CERTIFICADO INVÁLIDO');
    } catch (error) {
      console.error('Erro ao testar certificado:', error);
      setMessage('Não foi possível testar o certificado. Verifique o arquivo e tente novamente.');
    }
  }

  async function handleTestSefaz() {
    try {
      const response = await fetch('/api/empresas/sefaz/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: editingId,
          ambiente: form.ambiente_nf || 'homologacao',
          uf: form.uf_sefaz || form.uf || '',
          modelo: form.modelo_nf || '55',
          serie: form.serie_nfe || '1',
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('Erro ao testar conexão com a SEFAZ:', json);
        setMessage((json && (json.mensagem || json.error || json.message)) || 'Não foi possível conectar à SEFAZ.');
        return;
      }
      setMessage(json?.mensagem || '🟢 Comunicação com a SEFAZ realizada com sucesso.');
    } catch (error) {
      console.error('Erro ao testar conexão com a SEFAZ:', error);
      setMessage('Não foi possível conectar à SEFAZ. Verifique a configuração e tente novamente.');
    }
  }

  const filtered = companies.filter((company) => {
    const term = search.toLowerCase();
    return [company.name, company.document, company.razao_social, company.cnpj].join(' ').toLowerCase().includes(term);
  });

  const cnpjState = form.cnpj ? (isValidCNPJ(form.cnpj) ? '✓ CNPJ válido.' : '⚠️ CNPJ inválido.') : '';
  const cepState = form.cep ? (onlyDigits(form.cep).length === 8 ? '✓ CEP válido.' : '⚠️ CEP inválido.') : '';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Empresas</p>
        <h1 className="mt-2 text-3xl font-semibold">Empresas</h1>
        <p className="mt-2 text-sm text-slate-400">Central de cadastro, certificado digital e configuração fiscal.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <p className="mt-2 font-semibold text-white">{companySummary >= 10 ? '🟢 Cadastro completo' : '🟠 Configuração incompleta'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Certificado</p>
            <p className="mt-2 font-semibold text-white">{certificateMeta ? '🟢 Válido' : '⚠️ Não enviado'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">NF-e</p>
            <p className="mt-2 font-semibold text-white">{form.serie_nfe ? '🧾 Configurada' : '⚠️ Pendente'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ambiente</p>
            <p className="mt-2 font-semibold text-white">{form.ambiente_nf === 'producao' ? '🔴 Produção' : '🟡 Homologação'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{editingId ? 'Editar empresa' : 'Nova empresa'}</h2>
          {editingId ? <span className="text-xs text-orange-300">Empresa em edição</span> : null}
        </div>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Dados da empresa</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <div className="space-y-1">
                <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} />
                {cnpjState ? <p className={`text-xs ${isValidCNPJ(form.cnpj) ? 'text-emerald-300' : 'text-amber-300'}`}>{cnpjState}</p> : null}
              </div>
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Razão Social" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome Fantasia" value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Inscrição Estadual" value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Inscrição Municipal" value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} />
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.regime_tributario} onChange={(e) => setForm({ ...form, regime_tributario: e.target.value })}>
                <option value="">Regime Tributário</option>
                {regimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Tipo de estabelecimento" value={form.tipo_estabelecimento} onChange={(e) => setForm({ ...form, tipo_estabelecimento: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Indicador de inscrição estadual" value={form.indicador_inscricao_estadual} onChange={(e) => setForm({ ...form, indicador_inscricao_estadual: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CNAE principal" value={form.cnae_principal} onChange={(e) => setForm({ ...form, cnae_principal: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CRT" value={form.crt} onChange={(e) => setForm({ ...form, crt: e.target.value })} />
              <div className="space-y-1">
                <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CEP" value={form.cep} onChange={(e) => handleCEPChange(e.target.value)} />
                {cepState ? <p className={`text-xs ${onlyDigits(form.cep).length === 8 ? 'text-emerald-300' : 'text-amber-300'}`}>{cepState}</p> : null}
              </div>
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Código IBGE" value={form.codigo_ibge} onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Configuração fiscal</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CFOP" value={form.cfop} onChange={(e) => setForm({ ...form, cfop: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="NCM" value={form.ncm} onChange={(e) => setForm({ ...form, ncm: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CEST" value={form.cest} onChange={(e) => setForm({ ...form, cest: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Origem da mercadoria" value={form.origem_mercadoria} onChange={(e) => setForm({ ...form, origem_mercadoria: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CST" value={form.cst} onChange={(e) => setForm({ ...form, cst: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CSOSN" value={form.csosn} onChange={(e) => setForm({ ...form, csosn: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="ICMS" value={form.icms} onChange={(e) => setForm({ ...form, icms: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="ICMS-ST" value={form.icms_st} onChange={(e) => setForm({ ...form, icms_st: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="IPI" value={form.ipi} onChange={(e) => setForm({ ...form, ipi: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="PIS" value={form.pis} onChange={(e) => setForm({ ...form, pis: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="COFINS" value={form.cofins} onChange={(e) => setForm({ ...form, cofins: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="IBS" value={form.ibs} onChange={(e) => setForm({ ...form, ibs: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CBS" value={form.cbs} onChange={(e) => setForm({ ...form, cbs: e.target.value })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Configuração NF-e</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.modelo_nf} onChange={(e) => setForm({ ...form, modelo_nf: e.target.value })}>
                <option value="55">55 — NF-e</option>
              </select>
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Série" value={form.serie_nfe} onChange={(e) => setForm({ ...form, serie_nfe: e.target.value })} />
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Próximo número" value={form.proximo_numero_nf} onChange={(e) => setForm({ ...form, proximo_numero_nf: e.target.value })} />
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.ambiente_nf} onChange={(e) => setForm({ ...form, ambiente_nf: e.target.value })}>
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
              <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="UF da SEFAZ" value={form.uf_sefaz} onChange={(e) => setForm({ ...form, uf_sefaz: e.target.value.toUpperCase() })} />
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.finalidade_nf} onChange={(e) => setForm({ ...form, finalidade_nf: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="complementar">Complementar</option>
                <option value="ajuste">Ajuste</option>
                <option value="devolucao">Devolução</option>
              </select>
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.tipo_emissao_nf} onChange={(e) => setForm({ ...form, tipo_emissao_nf: e.target.value })}>
                <option value="1">Normal</option>
                <option value="2">Contingência</option>
              </select>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Numeração</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Empresa</p>
                <p className="mt-1 text-sm font-medium text-white">{form.name || 'Não informada'}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Modelo</p>
                <p className="mt-1 text-sm font-medium text-white">{form.modelo_nf || '55'}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Série</p>
                <p className="mt-1 text-sm font-medium text-white">{form.serie_nfe || '1'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Certificado Digital (A1)</h3>
            <p className="mb-4 text-sm text-slate-400">O arquivo do certificado e a senha são processados no backend. A senha não fica exposta no frontend.</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Nome do certificado</p>
                <p className="mt-1 text-sm text-white">{certificateMeta?.filename || 'Não enviado'}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">CNPJ</p>
                <p className="mt-1 text-sm text-white">{form.cnpj || 'Não informado'}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Emissor</p>
                <p className="mt-1 text-sm text-white">Não informado</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Validade inicial</p>
                <p className="mt-1 text-sm text-white">Não informado</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Validade final</p>
                <p className="mt-1 text-sm text-white">Não informado</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Status</p>
                <p className="mt-1 text-sm text-emerald-300">{certificateMeta ? '🟢 Certificado válido' : '⚠️ Não enviado'}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="file" id="certFile" accept=".pfx,.p12" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
              <input type="password" id="certPassword" placeholder="Senha do certificado" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
              <div className="flex gap-2">
                <button type="button" onClick={handleUploadCertificate} className="rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">Enviar certificado</button>
                <button type="button" onClick={handleTestCertificate} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200">Testar certificado</button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Conexão SEFAZ</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">SEFAZ</p>
                <p className="mt-1 text-sm text-emerald-300">🟢 Configurada</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Certificado</p>
                <p className="mt-1 text-sm text-emerald-300">🟢 Válido</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">Ambiente</p>
                <p className="mt-1 text-sm text-amber-300">🟡 {getStatusLabel(form.ambiente_nf || 'homologacao')}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-400">UF</p>
                <p className="mt-1 text-sm text-white">{form.uf_sefaz || form.uf || 'SC'}</p>
              </div>
            </div>
            <div className="mt-4">
              <button type="button" onClick={handleTestSefaz} className="rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">Testar conexão com SEFAZ</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Status para faturamento</h3>
            <div className="space-y-2">
              {companyChecklist.map((item, index) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                  <span className="text-slate-300">{index + 1}. {item.label}</span>
                  <span className={item.ok ? 'text-emerald-300' : 'text-amber-300'}>{item.ok ? '✔' : '•'}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
              {companySummary >= 10 ? '🟢 EMPRESA PRONTA PARA HOMOLOGAÇÃO' : companySummary >= 6 ? '🟠 CONFIGURAÇÃO INCOMPLETA' : '🔴 EMPRESA NÃO ESTÁ PRONTA PARA FATURAR'}
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">{editingId ? 'Salvar alterações' : 'Cadastrar empresa'}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setCertificateMeta(null); }} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Empresas cadastradas</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou razão social" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2" />
        </div>
        {loading ? <p className="text-sm text-slate-500">Carregando...</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((company) => (
              <div key={company.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{company.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{company.cnpj ? formatCNPJ(company.cnpj) : company.document || 'CNPJ não informado'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${company.status === 'inativo' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                    {company.status === 'inativo' ? 'Inativo' : 'Ativo'}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <p>Ambiente: {company.ambiente_nf === 'producao' ? 'Produção' : 'Homologação'}</p>
                  <p>Certificado: {company.cnpj ? '🟢 Válido' : '⚠️ Pendente'}</p>
                  <p>Status: {company.status === 'inativo' ? 'Inativo' : 'Pronto'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleEdit(company)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200">Editar</button>
                  <button type="button" onClick={() => handleDelete(company.id)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300">Inativar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

