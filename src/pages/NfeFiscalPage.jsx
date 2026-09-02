import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, FileUp, Landmark, Loader2, RefreshCw, Send, ShieldAlert, Wifi, Printer, FileText, FilePlus2, FileDown, ExternalLink } from 'lucide-react';
import { NfeEntradaPanel } from '../components/fiscal/NfeEntradaPanel';

const Empty = {
  numero: '',
  serie: '1',
  nome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
  documento: '11144477735',
  ibge: '4209102',
  descricao: 'PRODUTO TESTE HOMOLOGACAO',
  ncm: '83023000',
  cfop: '5101',
  csosn: '102',
  quantidade: 1,
  valor: '10'
};
const Tag = ({ ok, children }) => <span className={`nf-tag ${ok ? 'yes' : 'no'}`}>{ok ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>} {children}</span>;

export default function NfeFiscalPage() {
  const [tab, setTab] = useState('emitir');
  const [form, setForm] = useState(Empty);
  const [erros, setErros] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [lista, setLista] = useState([]);
  const [testando, setTestando] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [sefaz, setSefaz] = useState(null);

  const set = (key, value) => setForm(x => ({ ...x, [key]: value }));

  const carregarLista = () => {
    fetch('/api/nfe')
      .then(x => x.ok ? x.json() : [])
      .then(x => setLista(Array.isArray(x) ? x : (Array.isArray(x?.value) ? x.value : [])))
      .catch(() => {});
  };

  useEffect(() => { carregarLista(); }, []);

  const validarLocal = () => {
    const e = [];
    if (!form.nome || !form.documento) e.push('Preencha nome e CPF/CNPJ do destinatário.');
    if (!form.ibge) e.push('Informe o código IBGE do destinatário.');
    if (!form.descricao || !form.ncm || !form.cfop || !form.csosn) {
      e.push('Complete descrição, NCM, CFOP e CSOSN/CST do item.');
    }
    setErros(e.length ? e : null);
    return e.length === 0;
  };

  const montarPayload = () => {
    const documento = String(form.documento).replace(/\D/g, '');
    const cliente = {
      nome: form.nome,
      endereco: 'Rua Teste',
      numero: '100',
      bairro: 'Centro',
      codigoIbge: String(form.ibge).replace(/\D/g, ''),
      cidade: 'Joinville',
      uf: 'SC',
      cep: '89207500',
      indIEDest: '9',
      indFinal: '1',
      indPres: '1',
      ...(documento.length === 11 ? { cpf: documento } : { cnpj: documento })
    };

    const produtos = [{
      codigo: 'ITEM001',
      descricao: form.descricao,
      ncm: String(form.ncm).replace(/\D/g, ''),
      csosn: form.csosn,
      pisCst: '49',
      cofinsCst: '49',
      cfopInterno: String(form.cfop).replace(/\D/g, '') || '5101',
      cfopInterestadual: '6101',
      cfopNaoContribuinte: '6107',
      orig: '0',
      unidade: 'UN',
      quantidade: Number(form.quantidade || 1),
      valorUnitario: Number(form.valor || 0)
    }];

    return {
      empresa_id: '1',
      ambiente: 'homologacao',
      ...(String(form.numero || '').trim()
        ? { numero: String(form.numero).trim() }
        : {}),
      serie: String(form.serie || '1'),
      cliente,
      produtos,
      natureza_operacao: 'VENDA DE MERCADORIA',
      observacao: 'NF-e emitida em homologação pelo ERP Metal Racing'
    };
  };

  const validar = () => { validarLocal(); };

  const emitir = async () => {
    if (!validarLocal()) return;

    setEmitindo(true);
    setResultado(null);

    try {
      const response = await fetch('/api/nfe/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPayload())
      });

      const data = await response.json();
      setResultado(data);
      carregarLista();
    } catch (error) {
      setResultado({
        success: false,
        autorizado: false,
        error: error.message || 'Falha ao comunicar com o servidor local.'
      });
    } finally {
      setEmitindo(false);
    }
  };

  const gerar = async () => {
    if (!validarLocal()) return;

    setEmitindo(true);
    setResultado(null);

    try {

      const response =
        await fetch('/api/nfe/gerar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body:
            JSON.stringify(
              montarPayload()
            )
        });

      const data =
        await response.json();

      setResultado(data);
      carregarLista();

    } catch (error) {

      setResultado({
        success: false,
        autorizado: false,
        error:
          error.message ||
          'Falha ao gerar a NF-e.'
      });

    } finally {

      setEmitindo(false);

    }
  };
  const testar = async () => {

    setTestando(true);
    setSefaz(null);

    try {

      const response = await fetch(
        '/api/nfe/testar-sefaz',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            empresa_id: '1'
          })
        }
      );

      const data = await response.json();

      setSefaz({
        success:
          Boolean(response.ok && data?.success),

        xMotivo:
          data?.xMotivo ||
          data?.mensagem ||
          data?.message ||
          data?.error ||
          'Sem detalhe retornado.',

        error:
          data?.error || null,

        cStat:
          data?.cStat || null
      });

    } catch (error) {

      console.error(
        'Erro ao testar conexão com SEFAZ:',
        error
      );

      setSefaz({
        success: false,
        error:
          error.message ||
          'Falha ao comunicar com o servidor local.',
        xMotivo:
          error.message ||
          'Falha ao comunicar com o servidor local.'
      });

    } finally {

      setTestando(false);

    }
  };

  const gerarDanfe = async (nfe) => {
    if (!nfe?.id) {
      alert('NF-e inválida.');
      return;
    }

    try {
      const resposta = await fetch(
        `/api/nfe/${nfe.id}/gerar-danfe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await resposta.json();

      if (!resposta.ok || !data.success) {
        throw new Error(
          data.error ||
          'Não foi possível gerar o DANFE.'
        );
      }

      alert(
        `DANFE da NF-e ${nfe.numero} gerado com sucesso.`
      );

      carregarLista();

    } catch (error) {
      alert(
        error.message ||
        'Erro ao gerar DANFE.'
      );
    }
  };
  const baixarDanfe = async (nfe) => {

    if (!nfe?.id) {
      alert('NF-e inválida.');
      return;
    }

    try {

      // Garante que o DANFE esteja gerado.
      const gerarResponse = await fetch(
        `/api/nfe/${nfe.id}/gerar-danfe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const gerarData =
        await gerarResponse.json();

      if (!gerarResponse.ok || !gerarData.success) {
        throw new Error(
          gerarData.error ||
          'Não foi possível gerar o DANFE.'
        );
      }

      const resposta =
        await fetch(
          `/api/nfe/${nfe.id}/danfe`
        );

      if (!resposta.ok) {
        throw new Error(
          'Não foi possível baixar o DANFE.'
        );
      }

      const blob =
        await resposta.blob();

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;

      link.download =
        `DANFE-NFe-${nfe.numero || nfe.id}.html`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (error) {

      console.error(
        'Erro ao baixar DANFE:',
        error
      );

      alert(
        error.message ||
        'Erro ao baixar DANFE.'
      );

    }
  };

  const abrirDanfe = (nfe) => {
    if (!nfe?.id) {
      alert('NF-e inválida.');
      return;
    }

    const janela = window.open(
      `/api/nfe/${nfe.id}/danfe`,
      '_blank'
    );

    if (!janela) {
      alert(
        'O navegador bloqueou a abertura do DANFE. Permita pop-ups para o ERP.'
      );
      return;
    }

    janela.focus();
  };

  const imprimirDanfe = (nfe) => {
    if (!nfe?.id) {
      alert('NF-e inválida.');
      return;
    }

    const janela = window.open(
      `/api/nfe/${nfe.id}/danfe`,
      '_blank'
    );

    if (!janela) {
      alert(
        'O navegador bloqueou a abertura do DANFE. Permita pop-ups para o ERP.'
      );
      return;
    }

    janela.focus();
  };

  const baixarXml = (nfe) => {
    const xml = nfe?.xmlAutorizado || nfe?.xml;

    if (!xml) {
      alert('XML não disponível para esta NF-e.');
      return;
    }

    const blob = new Blob(
      [xml],
      { type: 'application/xml;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download =
      `${nfe.chave_acesso || `NFe-${nfe.numero}`}.xml`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  };
  const input = (label, key, placeholder = '', type = 'text') => (
    <label className="nf-field">
      <span>{label}</span>
      <input type={type} value={form[key]} placeholder={placeholder} onChange={e => set(key, e.target.value)} />
    </label>
  );

  return (
    <main className="nf-page">
      <style>{`.nf-page{max-width:1260px;margin:auto;padding:28px;color:#dce7f6;font-family:Inter,Segoe UI,sans-serif}.nf-head{display:flex;justify-content:space-between;align-items:start;border-bottom:1px solid #314158;padding-bottom:19px;margin-bottom:20px}.nf-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#7e94b0;margin:0 0 7px}.nf-head h1{margin:0;font-size:28px;color:#fff}.nf-head p{margin:6px 0 0;color:#8ea0b8;font-size:14px}.nf-tag{display:inline-flex;gap:6px;align-items:center;border-radius:20px;padding:7px 11px;font-size:12px;font-weight:700}.nf-tag.yes{color:#a9efc4;background:#103e2b;border:1px solid #20794e}.nf-tag.no{color:#ffda7d;background:#4d3510;border:1px solid #a7781c}.nf-tabs{display:flex;gap:7px;padding:6px;border:1px solid #2c3d54;border-radius:12px;background:#101a2b;margin-bottom:18px}.nf-tabs button{flex:1;border:0;border-radius:8px;padding:12px;background:transparent;color:#93a5bd;font-weight:700;cursor:pointer}.nf-tabs button.active{background:#1779dd;color:#fff}.nf-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.nf-card{background:#101a2b;border:1px solid #2b3c54;border-radius:13px;padding:20px;margin-bottom:18px}.nf-card h2{display:flex;align-items:center;gap:8px;font-size:15px;color:#f4f8fd;margin:0 0 15px}.nf-alert{background:#382716;border:1px solid #a46b20;border-radius:9px;padding:13px;color:#ffd990;font-size:13px;line-height:1.45}.nf-alert b{display:block}.nf-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nf-kpi{background:#0a1321;border:1px solid #2c3d55;border-radius:8px;padding:13px}.nf-kpi span,.nf-field span{font-size:11px;color:#8fa2ba}.nf-kpi b{display:block;font-size:17px;color:#edf4fd;margin-top:4px}.nf-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.nf-field{display:flex;gap:6px;flex-direction:column}.nf-field input{background:#0b1321;border:1px solid #354861;border-radius:7px;padding:10px;color:#edf4fd;outline:none}.nf-field input:focus{border-color:#2585ec}.nf-wide{grid-column:span 2}.nf-section{margin:20px 0 11px;font-size:13px;color:#b9c9dc}.nf-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:17px}.nf-button{border:0;border-radius:8px;padding:11px 14px;display:inline-flex;gap:8px;align-items:center;font-weight:700;cursor:pointer}.nf-button.blue{background:#1779dd;color:#fff}.nf-button.dark{background:#273951;color:#e7eff9}.nf-button:disabled{opacity:.5;cursor:not-allowed}.nf-result{font-size:12px;line-height:1.55;background:#0a1321;border-radius:8px;margin-top:13px;padding:11px;color:#c0cede}.nf-result ul{margin:7px 0 0;padding-left:18px}.nf-check{padding:10px 0;border-bottom:1px solid #293950;font-size:13px;color:#becbdd;display:flex;gap:8px}.nf-check:last-child{border:0}.nf-check i{color:#ffbd57;font-style:normal}.nf-table{width:100%;border-collapse:collapse;font-size:12px}.nf-table th,.nf-table td{text-align:left;padding:9px;border-bottom:1px solid #293950};.nf-table button{white-space:nowrap}.nf-table th{color:#8fa2ba}.nf-empty{text-align:center;color:#8fa2ba;padding:25px;font-size:13px}@media(max-width:850px){.nf-grid{grid-template-columns:1fr}.nf-fields{grid-template-columns:1fr}.nf-wide{grid-column:auto}.nf-head{gap:13px;flex-direction:column}}`}</style>
      <header className="nf-head">
        <div>
          <p className="nf-kicker">Centro fiscal</p>
          <h1>NF-e</h1>
          <p>Emissão, autorização, entrada XML e documentos recebidos.</p>
        </div>
        <Tag ok={sefaz?.success === true}>SEFAZ homologação conectada</Tag>
      </header>
      <nav className="nf-tabs">
        <button className={tab === 'emitir' ? 'active' : ''} onClick={() => setTab('emitir')}>Emitir NF-e</button>
        <button className={tab === 'entrada' ? 'active' : ''} onClick={() => setTab('entrada')}>Entrada e XML</button>
      </nav>
      {tab === 'entrada' ? (
        <NfeEntradaPanel empresaId="1" />
      ) : (
        <div className="nf-grid">
          <section>
            <div className="nf-card">
              <h2><CheckCircle2 size={18} color="#66d78a" /> Homologação SEFAZ</h2>
              <div className="nf-alert" style={{ borderColor: "#20794e", background: "#103e2b", color: "#a9efc4" }}>
                <b>Comunicação com a SEFAZ funcionando</b>
                O ERP gera XML, assina com A1, transmite para SVRS/SC e interpreta o retorno da SEFAZ.
                A autorização final depende do credenciamento IE/CNPJ no ambiente de homologação.
              </div>
            </div>
            <div className="nf-card">
              <h2><Landmark size={18} color="#80b9ff" /> Emitente e ambiente</h2>
              <div className="nf-kpis">
                <div className="nf-kpi"><span>Ambiente</span><b>Homologação</b></div>
                <div className="nf-kpi"><span>Certificado</span><b>A1 configurado</b></div>
                <div className="nf-kpi"><span>Cadastro CNPJ / IE</span><b style={{ color: '#ffcf73' }}>Validar na SEFAZ</b></div>
                <div className="nf-kpi"><span>Numeração</span><b>Reserva exigida</b></div>
              </div>
            </div>
            <div className="nf-card">
              <h2><FileCheck2 size={18} color="#80b9ff" /> Nova NF-e de saída</h2>
              <div className="nf-fields">
                {input('Número reservado *', 'numero', 'Ex.: 18128')}
                {input('Série *', 'serie')}
                {input('Código IBGE destinatário *', 'ibge', '4209102')}
                {input('Nome / razão social *', 'nome', 'Destinatário')}
                {input('CPF ou CNPJ *', 'documento', '11144477735')}
                {input('Descrição do item *', 'descricao', 'Produto ou serviço')}
              </div>
              <p className="nf-section">Dados fiscais do item</p>
              <div className="nf-fields">
                {input('NCM *', 'ncm', '83023000')}
                {input('CFOP *', 'cfop', '4 dígitos')}
                {input('CSOSN / CST *', 'csosn')}
                {input('Quantidade', 'quantidade', '', 'number')}
                {input('Valor unitário', 'valor', '0,00', 'number')}
              </div>
              <div className="nf-actions">

                <button
                  className="nf-button dark"
                  onClick={validar}
                  disabled={emitindo}
                >
                  <FileCheck2 size={16} />
                  Validar NF-e
                </button>

                <button
                  className="nf-button dark"
                  onClick={gerar}
                  disabled={emitindo}
                >
                  {emitindo
                    ? <Loader2 size={16} />
                    : <FilePlus2 size={16} />}
                  Gerar NF-e
                </button>

                <button
                  className="nf-button blue"
                  onClick={emitir}
                  disabled={emitindo}
                >
                  {emitindo
                    ? <Loader2 size={16} />
                    : <Send size={16} />}
                  {emitindo
                    ? 'Transmitindo...'
                    : 'Emitir NF-e'}
                </button>

              </div>
              {erros && (
                <div className="nf-result">
                  <b>Bloqueios encontrados</b>
                  <ul>{erros.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}
              {resultado && (
  <div className="nf-result">
    <Tag ok={resultado.autorizado}>
      {resultado.autorizado
        ? 'NF-e autorizada'
        : 'NF-e não autorizada'}
    </Tag>

    <p>
      {resultado.message || resultado.error}
    </p>

    {resultado.sefaz?.cStat && (
      <p>
        cStat: {resultado.sefaz.cStat}
        {' — '}
        {resultado.sefaz.xMotivo}
      </p>
    )}

    {resultado.data?.chave_acesso && (
      <p>
        Chave: {resultado.data.chave_acesso}
      </p>
    )}

    {resultado.data?.nProt && (
      <p>
        Protocolo: {resultado.data.nProt}
      </p>
    )}

    {resultado.autorizado && resultado.data && (
      <div className="nf-actions">

        <button
          className="nf-button blue"
          onClick={() => abrirDanfe(resultado.data)}
        >
          <FileUp size={16} />
          Gerar DANFE
        </button>

        <button
          className="nf-button dark"
          onClick={() => imprimirDanfe(resultado.data)}
        >
          <FileCheck2 size={16} />
          Imprimir DANFE
        </button>

        <button
          className="nf-button dark"
          onClick={() => baixarXml(resultado.data)}
        >
          <FileUp size={16} />
          Baixar XML
        </button>

      </div>
    )}

  </div>
)}
            </div>
          </section>
          <aside>
            <div className="nf-card">
              <h2><Wifi size={18} color="#80b9ff" /> Serviço SEFAZ</h2>
              <p style={{ fontSize: 13, color: '#99aabd', marginTop: 0 }}>Teste separado da emissão; não gera NF-e.</p>
              <button className="nf-button dark" onClick={testar} disabled={testando}>
                {testando ? <Loader2 size={16} /> : <RefreshCw size={16} />}
                {testando ? 'Testando...' : 'Testar conexão'}
              </button>
              {sefaz && (
                <div className="nf-result">
                  <Tag ok={sefaz.success}>{sefaz.success ? 'Serviço em operação' : 'Conexão não confirmada'}</Tag>
                  <p>{sefaz.xMotivo || sefaz.error || 'Sem detalhe retornado.'}</p>
                </div>
              )}
            </div>
            <div className="nf-card">
              <h2><AlertTriangle size={18} color="#ffbd57" /> Checklist de produção</h2>
              {[
                'IE vinculada ao CNPJ e credenciamento confirmado',
                'Responsável técnico configurado',
                'Certificado compatível com o emitente',
                'Numeração transacional reservada',
                'Homologação SEFAZ validada; produção permanece bloqueada'
              ].map(x => (
                <div className="nf-check" key={x}><i>●</i>{x}</div>
              ))}
            </div>
            <div className="nf-card">
              <h2><FileUp size={18} color="#80b9ff" /> Últimas NF-e</h2>
              {lista.length ? (
                <table className="nf-table">
                  <thead>
  <tr>
    <th>NF-e</th>
    <th>Status</th>
    <th>SEFAZ</th>
    <th>Ações</th>
  </tr>
</thead>
                  <tbody>
                    {lista.slice(0, 5).map(x => (
                      <tr key={x.id}>
                        <td>{x.numero}</td>
                        <td>{x.status}</td>
                        <td>{x.cStat || '-'}</td>                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '5px',
                              flexWrap: 'wrap'
                            }}
                          >


                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px'
                              }}
                            >

                              <button
                                className="nf-button blue"
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px'
                                }}
                                onClick={() => gerarDanfe(x)}
                                disabled={!x.id}
                                title="Gerar DANFE"
                              >
                                <FilePlus2 size={13} />
                                Gerar DANFE
                              </button>

                              <button
                                className="nf-button blue"
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px'
                                }}
                                onClick={() => baixarDanfe(x)}
                                disabled={
                                  x.status !== 'AUTORIZADA'
                                }
                                title="Baixar DANFE"
                              >
                                <FileDown size={13} />
                                Baixar DANFE
                              </button>

                              <button
                                className="nf-button blue"
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px'
                                }}
                                onClick={() => imprimirDanfe(x)}
                                disabled={
                                  x.status !== 'AUTORIZADA'
                                }
                                title="Imprimir DANFE"
                              >
                                <Printer size={13} />
                                Imprimir DANFE
                              </button>

                              <button
                                className="nf-button dark"
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px'
                                }}
                                onClick={() => baixarXml(x)}
                                disabled={!x.id}
                                title="Baixar XML"
                              >
                                <FileUp size={13} />
                                XML
                              </button>

                            </div>


                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="nf-empty">Nenhuma NF-e enviada pelo ERP.</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
