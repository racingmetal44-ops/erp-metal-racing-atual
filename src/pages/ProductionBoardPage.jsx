import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, RefreshCw, Trash2, Edit3, X, Package, GripVertical,
  ChevronRight, Upload, Clock3, UserRound, Search, Factory, Printer
} from 'lucide-react';

const ETAPAS_VISUAIS = [
  'Recebido',
  'Corte a Laser',
  'Dobra',
  'Solda',
  'Lixamento',
  'Químico',
  'Pintura',
  'Fechamento',
  'Embalagem',
  'Expedição'
];

const ETAPA_BACKEND_ALIASES = {};

const ORIGENS = [
  { id: 'shopee', label: 'SHOPEE', color: 'orange', icon: 'S' },
  { id: 'correios', label: 'CORREIOS', color: 'yellow', icon: '◆' },
  { id: 'coleta', label: 'COLETA', color: 'blue', icon: 'M' },
  { id: 'agencia', label: 'AGÊNCIA', color: 'blue', icon: 'A' },
  { id: 'garantia', label: 'GARANTIA', color: 'green', icon: '🛡️' },
  { id: 'tiktok', label: 'TIKTOK', color: 'black', icon: '♪' },
  { id: 'site', label: 'SITE', color: 'slate', icon: '🌐' }
];

const FORM_INICIAL = {
  id: '',
  order_number: '',
  product_id: '',
  product_name: '',
  sku: '',
  client: '',
  quantity: 1,
  prioridade: 'Media',
  current_stage: 'Recebido',
  expected_delivery: '',
  observations: '',
  origem: 'shopee',
  image_url: ''
};

function apiError(payload, status) {
  return payload?.error || payload?.message || `Erro HTTP ${status}`;
}

function normalizeOrders(payload) {
  const data = payload?.data || payload?.orders || [];
  return Array.isArray(data) ? data : [];
}

function getPriority(priority) {
  const p = String(priority || 'Media').toLowerCase();
  if (p === 'urgente') return 'urgente';
  if (p === 'alta') return 'alta';
  if (p === 'baixa') return 'baixa';
  return 'media';
}

function stageForVisual(stage, listaDinamica) {
  const lista = Array.isArray(listaDinamica) && listaDinamica.length > 0 ? listaDinamica : ETAPAS_VISUAIS;
  if (!stage) return lista[0] || 'Recebido';
  if (lista.includes(stage)) return stage;
  const stageTrim = String(stage).trim();
  const encontrado = lista.find(s => String(s).trim() === stageTrim);
  return encontrado || lista[0] || 'Recebido';
}

function stageColor(stage) {
  return {
    'Recebido': 'bg-slate-100 text-white',
    'Corte a Laser': 'bg-violet-600 text-white',
    'Dobra': 'bg-blue-600 text-white',
    'Solda': 'bg-orange-600 text-white',
    'Lixamento': 'bg-amber-500 text-white',
    'Químico': 'bg-cyan-500 text-white',
    'Pintura': 'bg-pink-500 text-white',
    'Fechamento': 'bg-green-500 text-white',
    'Embalagem': 'bg-fuchsia-600 text-white',
    'Expedição': 'bg-blue-700 text-white'
  }[stage] || 'bg-slate-500 text-white';
}

function originInfo(value) {
  const key = String(value || '').toLowerCase().replace(/\s+/g, '_');
  return ORIGENS.find(o => o.id === key) || ORIGENS[0];
}

function formatElapsed(value) {
  if (!value) return '0h';
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return '0h';
  const mins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function ProductThumb({ order, large = false }) {
  const src = order?.image_url || order?.image || order?.foto || order?.product_image;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${large ? 'h-36 w-36' : 'h-16 w-16'} rounded-lg object-cover border border-slate-700 bg-slate-900`}
      />
    );
  }
  return (
    <div className={`${large ? 'h-36 w-36' : 'h-16 w-16'} flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900`}>
      <Package size={large ? 42 : 25} className="text-slate-500" />
    </div>
  );
}

export default function ProductionBoardPage() {
  const [pedidos, setPedidos] = useState([]);
  const [etapasBackend, setEtapasBackend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [dragged, setDragged] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [bipagem, setBipagem] = useState('');
  const [operadores, setOperadores] = useState([]);
  const [operadorSelecionado, setOperadorSelecionado] = useState(null);
  const [responsavelCadastro, setResponsavelCadastro] = useState(null);
  const [operadoresPorEtapa, setOperadoresPorEtapa] = useState({});
  const [fotoOrdem, setFotoOrdem] = useState(null);
  const [larguraColuna, setLarguraColuna] = useState(145);
  const [message, setMessage] = useState('');

  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageForm, setStageForm] = useState({ nome: '', cor: '#3b82f6', ordem: 0 });
  const [stagesFull, setStagesFull] = useState([]);
  const [zoomImage, setZoomImage] = useState(null);
  // IMPRESSÃO MANUAL DE ETIQUETA - EMBALAGEM
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [pedidoImpressao, setPedidoImpressao] = useState(null);
  const [etiquetaPreview, setEtiquetaPreview] = useState(null);
  const [impressoras, setImpressoras] = useState([]);
  const [impressoraSelecionada, setImpressoraSelecionada] = useState('');
  const [carregandoImpressao, setCarregandoImpressao] = useState(false);
  const [imprimindoEtiqueta, setImprimindoEtiqueta] = useState(false);
  const bipRef = useRef(null);
  // AUTO-SKU-IMAGEM
  useEffect(() => {
    const sku = String(form.sku || '').trim();

    if (!sku) return;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/produtos/buscar/${encodeURIComponent(sku)}`
        );

        const resultado = await response.json();

        if (!response.ok || !resultado?.data) {
          return;
        }

        const produto = resultado.data;

        const arquivos = Array.isArray(produto.files)
          ? produto.files
          : [];

        const imagemPrincipal =
          arquivos.find(
            arquivo => Number(arquivo?.is_primary) === 1
          )?.file_url ||
          arquivos[0]?.file_url ||
          produto.imagem_url ||
          produto.image_url ||
          '';

        setForm(current => ({
          ...current,
          product_id: produto.id || '',
          product_name: produto.nome || produto.name || '',
          sku: produto.sku || produto.codigo || sku,
          image_url: imagemPrincipal
        }));

        setMessage(
          imagemPrincipal
            ? 'Produto e imagem identificados pelo SKU.'
            : 'Produto identificado, mas não possui imagem cadastrada.'
        );

      } catch (error) {
        console.error('[PRODUÇÃO] Erro ao buscar SKU:', error);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.sku]);


  async function api(url, options = {}) {
    const isFormData = options?.body instanceof FormData;
    const headers = isFormData
      ? { ...(options.headers || {}) }
      : { 'Content-Type': 'application/json', ...(options.headers || {}) };

    const response = await fetch(url, {
      headers,
      ...options
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text }; }
    if (!response.ok || payload.success === false) throw new Error(apiError(payload, response.status));
    return payload;
  }

  async function carregarTudo() {
    setLoading(true);
    try {
      const [ordersRes, stagesRes, operadoresRes] = await Promise.all([
        api('/api/pcp/orders'),
        api('/api/pcp/stages'),
        api('/api/pcp/operadores')
      ]);

      setPedidos(normalizeOrders(ordersRes));

      const stages = stagesRes?.data || stagesRes?.stages || [];
      setEtapasBackend(Array.isArray(stages) ? stages : []);

      const listaOperadores =
        operadoresRes?.data ||
        operadoresRes?.operadores ||
        operadoresRes?.users ||
        [];

      setOperadores(Array.isArray(listaOperadores) ? listaOperadores : []);
    } catch (e) {

      try {
        const stagesFullRes = await api('/api/pcp/stages/full');
        const stagesFullData = stagesFullRes?.stages || stagesFullRes?.data || [];
        if (Array.isArray(stagesFullData) && stagesFullData.length > 0) {
          setStagesFull(stagesFullData);
        } else {
          console.warn('[PCP] /stages/full retornou vazio ou invalido:', stagesFullData);
        }
      } catch (e) {
        console.warn('[PCP] getStagesFull falhou:', e.message);
      }
      setMessage(e.message || 'Não foi possível carregar o quadro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarTudo(); }, []);

  // CTRL-V-PASTE-FOTO
  useEffect(() => {
    function handlePaste(e) {
      if (!showModal) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            setFotoOrdem(file);
            setForm(function(f) { return Object.assign({}, f, { image_url: URL.createObjectURL(file) }); });
            setMessage('Foto colada! Clique em Criar ordem para salvar.');
            e.preventDefault();
            return;
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return function() { window.removeEventListener('paste', handlePaste); };
  }, [showModal]);

  // CARREGAR-SETORES-INDEPENDENTE
  useEffect(() => {
    async function carregarSetores() {
      try {
        const res = await fetch('/api/pcp/stages/full');
        const json = await res.json();
        const lista = json?.stages || json?.data || [];
        console.log('[PCP] Setores recebidos:', lista.length);
        if (Array.isArray(lista) && lista.length > 0) {
          setStagesFull(lista);
          console.log('[PCP] Setores ativos:', lista.filter(s => s.ativo !== 0).map(s => s.nome));
        }
      } catch (e) {
        console.error('[PCP] Erro ao carregar setores:', e.message);
      }
    }
    carregarSetores();
  }, []);
  useEffect(() => { bipRef.current?.focus(); }, []);

  const totalQuantidade = useMemo(
    () => pedidos.reduce((s, p) => s + Number(p.quantity ?? p.quantidade ?? 0), 0),
    [pedidos]
  );

  const totalProduzido = useMemo(
    () => pedidos.reduce((s, p) => s + Number(p.quantidade_produzida ?? 0), 0),
    [pedidos]
  );

  const origemStats = useMemo(() => {
    return ORIGENS.map(o => {
      const list = pedidos.filter(p => {
        const v = String(p.origem || p.origin || p.source || p.order_source || '').toLowerCase().replace(/\s+/g, '_');
        return v === o.id;
      });
      return {
        ...o,
        pedidos: list.length,
        pecas: list.reduce((s, p) => s + Number(p.quantity ?? p.quantidade ?? 0), 0)
      };
    });
  }, [pedidos]);

  

  // Lista DINAMICA de etapas (vem do banco via stagesFull)
  const etapasVisuais = useMemo(() => {
    if (Array.isArray(stagesFull) && stagesFull.length > 0) {
      const lista = stagesFull
        .filter(s => s && s.ativo !== 0 && s.nome)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(s => s.nome);
      if (lista.length > 0) return lista;
    }
    return ETAPAS_VISUAIS;
  }, [stagesFull]);

  const colunas = useMemo(() => {
    const termo = bipagem.trim().toLowerCase();
    return etapasVisuais.map(etapa => ({
      etapa,
      pedidos: pedidos.filter(p => {
        const visual = stageForVisual(p.current_stage || p.stage, etapasVisuais);
        if (visual !== etapa) return false;
        if (!termo) return true;
        const text = [
          p.order_number, p.numero, p.product_name, p.sku, p.client
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(termo);
      })
    }));
  }, [pedidos, bipagem]);

  function abrirNovo() {
    setEditing(null);
    setForm({ ...FORM_INICIAL, current_stage: 'Recebido' });
    setShowModal(true);
  }

  // CRUD DE SETORES
  const abrirModalNovoSetor = () => {
    setEditingStage(null);
    const proximaOrdem = stagesFull && stagesFull.length > 0
      ? Math.max(...stagesFull.map(s => Number(s.ordem) || 0)) + 1
      : 1;
    setStageForm({ nome: '', cor: '#3b82f6', ordem: proximaOrdem });
    setShowStageModal(true);
  };

  const abrirModalEditarSetor = (setor) => {
    setEditingStage(setor);
    setStageForm({ nome: setor.nome, cor: setor.cor || '#3b82f6', ordem: setor.ordem || 0 });
    setShowStageModal(true);
  };


  const moverSetor = async (setor, direcao) => {
    try {
      setSaving(true);
      setMessage('');
      await api('/api/pcp/stages/' + setor.id + '/mover', {
        method: 'PATCH',
        body: JSON.stringify({ direcao })
      });

      // Recarrega a lista
      const res = await api('/api/pcp/stages/full');
      const lista = res?.stages || res?.data || [];
      if (Array.isArray(lista) && lista.length > 0) {
        setStagesFull(lista);
      }

      setMessage('Setor movido para ' + (direcao === 'up' ? 'cima' : 'baixo') + '!');
    } catch (err) {
      console.error('Erro ao mover setor:', err);
      setMessage(err.message || 'Erro ao mover setor');
    } finally {
      setSaving(false);
    }
  };

  const reativarSetor = async (setor) => {
    try {
      setSaving(true);
      setMessage('');
      // Usa a rota PUT para reativar (envia ativo: true)
      await api('/api/pcp/stages/' + setor.id, {
        method: 'PUT',
        body: JSON.stringify({ ativo: true })
      });

      const res = await api('/api/pcp/stages/full');
      const lista = res?.stages || res?.data || [];
      if (Array.isArray(lista) && lista.length > 0) {
        setStagesFull(lista);
      }
      setMessage('Setor reativado com sucesso!');
    } catch (err) {
      console.error('Erro ao reativar setor:', err);
      setMessage(err.message || 'Erro ao reativar setor');
    } finally {
      setSaving(false);
    }
  };
  const salvarSetor = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');

      // Garante que ordem é número válido (>= 1)
      const ordemValidada = Math.max(1, Number(stageForm.ordem) || 1);
      const payload = { ...stageForm, ordem: ordemValidada };

      if (editingStage) {
        await api('/api/pcp/stages/' + editingStage.id, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/pcp/stages', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowStageModal(false);

      // Recarrega SOMENTE os setores
      try {
        const res = await api('/api/pcp/stages/full');
        const lista = res?.stages || res?.data || [];
        if (Array.isArray(lista) && lista.length > 0) {
          setStagesFull(lista);
        }
      } catch (errLista) {
        console.warn('Erro ao recarregar setores:', errLista.message);
      }

      setMessage(editingStage ? 'Setor atualizado com sucesso!' : 'Setor criado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar setor:', err);
      setMessage(err.message || 'Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  const excluirSetor = async (setor) => {
    try {
      setSaving(true);
      setMessage('');
      await api('/api/pcp/stages/' + setor.id, { method: 'DELETE' });
      setShowStageModal(false);

      // Recarrega a lista de setores
      const res = await api('/api/pcp/stages/full');
      const lista = res?.stages || res?.data || [];
      if (Array.isArray(lista) && lista.length > 0) {
        setStagesFull(lista);
      }

      setMessage('Setor "' + setor.nome + '" foi desativado. Pode ser reativado depois.');
    } catch (err) {
      console.error('Erro ao excluir setor:', err);
      setMessage('ERRO ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };


  function abrirEdicao(pedido) {
    setEditing(pedido);
    setForm({
      ...FORM_INICIAL,
      ...pedido,
      id: pedido.id || '',
      order_number: pedido.order_number || pedido.numero || '',
      product_name: pedido.product_name || '',
      sku: pedido.sku || '',
      quantity: pedido.quantity ?? pedido.quantidade ?? 1,
      prioridade: pedido.priority || pedido.prioridade || 'Media',
      current_stage: stageForVisual(pedido.current_stage || pedido.stage),
      observations: pedido.observations || pedido.observacao || ''
    });
    setShowModal(true);
  }

  async function salvarOrdem(e) {
    e.preventDefault();
    if (!editing && !responsavelCadastro) {
      setMessage('Selecione o responsável pelo cadastro antes de criar a ordem.');
      return;
    }
    if (!form.product_name.trim()) return setMessage('Informe o nome da peça.');
    if (Number(form.quantity) <= 0) return setMessage('Informe uma quantidade válida.');
    setSaving(true);
    try {
      const stage = form.current_stage === 'Fechamento'
        ? (etapasBackend.find(s => ETAPA_BACKEND_ALIASES.Fechamento.includes(s)) || 'Montagem')
        : form.current_stage;

      const body = {
        order_number: form.order_number || undefined,
        product_id: form.product_id || null,
        product_name: form.product_name.trim(),
        sku: String(form.sku || '').trim(),
        client: String(form.client || '').trim(),
        quantity: Number(form.quantity),
        prioridade: form.prioridade,
        current_stage: stage,
        expected_delivery: form.expected_delivery || null,
        observations: String(form.observations || '').trim(),
        origem: form.origem || null,
        image_url: form.image_url || null,
        responsavel_cadastro_id: !editing ? responsavelCadastro?.id : undefined,
        responsavel_cadastro_nome: !editing ? responsavelCadastro?.nome : undefined
      };

      if (editing?.id) {
        await api(`/api/pcp/orders/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        if ((editing.current_stage || '') !== stage) {
          await api(`/api/pcp/orders/${editing.id}/stage`, {
            method: 'PATCH',
            body: JSON.stringify({ stage })
          });
        }
        setMessage('Ordem atualizada.');
      } else {
        const ordemCriada = await api('/api/pcp/orders', { method: 'POST', body: JSON.stringify(body) });

        const ordemIdCriada = ordemCriada?.order?.id || ordemCriada?.ordem?.id || ordemCriada?.data?.id || ordemCriada?.id;

        if (fotoOrdem && ordemIdCriada) {
          const fotoForm = new FormData();
          fotoForm.append('photo', fotoOrdem);
          await api(`/api/pcp/orders/${ordemIdCriada}/photo`, { method: 'POST', body: fotoForm });
        }

        setMessage('Ordem criada.');
      }
      setShowModal(false);
      await carregarTudo();
    } catch (e) {
      setMessage(e.message || 'Erro ao salvar ordem.');
    } finally {
      setSaving(false);
    }
  }

  async function moverOrdem(pedido, visualStage) {
    let target = visualStage;
    if (visualStage === 'Fechamento') {
      target = etapasBackend.find(s => ETAPA_BACKEND_ALIASES.Fechamento.includes(s)) || 'Montagem';
    }

    const etapaAtual = stageForVisual(pedido.current_stage || pedido.stage, etapasVisuais);
    const operador = operadoresPorEtapa[etapaAtual] || null;

    if (!operador?.id) {
      setMessage('Selecione um funcionário para o setor "' + etapaAtual + '" antes de avançar a ordem.');
      setMessageType('error');
      setDragOver(null);
      return;
    }

    if (etapaAtual === visualStage) {
      setDragOver(null);
      return;
    }

    if (!operador) {
      setMessage('Selecione o funcionário responsável pelo setor ' + etapaAtual + '.');
      setDragOver(null);
      return;
    }

    try {
      await api(`/api/pcp/orders/${pedido.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: target,
          operador_id: operador.id,
          operador_nome: operador.nome
        })
      });

      setMessage('Ordem #' + (pedido.order_number || pedido.numero) + ' avançada por ' + operador.nome + '.');
      await carregarTudo();
    } catch (e) {
      setMessage(e.message || 'Não foi possível mover a ordem.');
      await carregarTudo();
    } finally {
      setDragged(null);
      setDragOver(null);
    }
  }

  async function excluirOrdem(pedido) {
    if (!window.confirm(`Excluir a ordem #${pedido.order_number || pedido.numero || pedido.id}?`)) return;
    try {
      await api(`/api/pcp/orders/${pedido.id}`, { method: 'DELETE' });
      await carregarTudo();
    } catch (e) {
      setMessage(e.message || 'Erro ao excluir.');
    }
  }

  async function bipar(e) {
    if (e.key !== 'Enter') return;

    if (!operadorSelecionado) {
      setMessage('Selecione o funcionário antes de bipar.');
      return;
    }
    const code = bipagem.trim().toLowerCase();
    if (!code) return;
    const found = pedidos.find(p =>
      [p.order_number, p.numero, p.sku, p.product_name].filter(Boolean)
        .some(v => String(v).toLowerCase() === code)
    );
    if (found) {
      const result = await api('/api/pcp/bipar', { method: 'POST', body: JSON.stringify({ code, operador_id: operadorSelecionado.id, operador_nome: operadorSelecionado.nome }) });
      const ordem = result?.order || result?.ordem || result?.data || result;
      abrirEdicao(ordem?.id ? { ...found, ...ordem } : found);
      setMessage(`Ordem #${found.order_number || found.numero} localizada.`);
    } else {
      setMessage(`Código "${bipagem}" não encontrado.`);
    }
    setBipagem('');
  }

  return (
    <div className="min-h-screen bg-[#03090d] text-white">
      <div className="mx-auto max-w-[1550px] px-4 pb-8 pt-3">

        {/* Cabeçalho no estilo do modelo */}
        <header className="mb-3 flex h-12 items-center border-b border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-black italic tracking-tighter">MR</div>
            <div className="border-l border-slate-500 pl-3">
              <div className="text-lg font-black italic">METAL RACING</div>
              <div className="text-[9px] tracking-widest text-slate-400">GERENCIAMENTO EMPRESARIAL</div>
            </div>
          </div>
          <div className="ml-7 flex items-center gap-3 border-l border-slate-600 pl-7">
            <Factory className="text-orange-500" size={22} />
            <span className="text-xl font-bold">Produção</span>
          </div>
          <div className="ml-auto flex items-center gap-5 text-xs text-slate-300">
            <div className="text-right">
              <div>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div className="text-lg font-bold text-white">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center font-bold">L</div>
            <div>
              <div className="font-bold text-white">Lucas</div>
              <div>Administrador</div>
            </div>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(700px,1.4fr)_minmax(400px,1fr)]">

          <div>
            <div className="mb-1 text-sm font-black tracking-wide">ORIGEM DOS PEDIDOS</div>
            <div className="grid grid-cols-7 gap-3">
              {origemStats.map(o => (
                <div key={o.id} className="overflow-hidden rounded-xl border border-slate-700 bg-[#0a1117]">
                  <div className={`h-16 px-4 flex items-center justify-center gap-3 font-black ${
                    o.color === 'orange' ? 'bg-orange-500' :
                    o.color === 'yellow' ? 'bg-yellow-400 text-slate-900' : 'bg-blue-600'
                  }`}>
                    <span className="text-3xl flex-shrink-0">{o.icon}</span><span className="text-sm tracking-wide whitespace-nowrap text-center">{o.label}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-700 p-3 text-center">
                    <div><b className="text-2xl">{o.pedidos}</b><div className="text-xs text-slate-400 mt-1">pedidos</div></div>
                    <div><b className="text-2xl">{o.pecas}</b><div className="text-xs text-slate-400 mt-1">peças</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-[#071017] px-4 py-3">
          <div>
            <div className="flex items-center gap-3"><Factory className="text-orange-500" size={28}/><span className="text-2xl font-black">Quadro de Produção</span></div>
            <div className="text-xs text-slate-400">Acompanhe o fluxo de produção e a movimentação das ordens.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={carregarTudo} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold hover:bg-slate-800">
            <button onClick={abrirModalNovoSetor} className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold hover:bg-slate-700">
              <Factory size={17} className="mr-1 inline"/> Gerenciar Setores
            </button>
              <RefreshCw size={15} className={`mr-2 inline ${loading ? 'animate-spin' : ''}`}/> Atualizar
            </button>
            <button type="button" onClick={() => setLarguraColuna(w => Math.max(80, w - 20))} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold hover:bg-slate-800" title="Diminuir largura">−</button>
            <button type="button" onClick={() => setLarguraColuna(w => Math.min(400, w + 20))} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold hover:bg-slate-800" title="Aumentar largura">+</button>
            <button onClick={abrirNovo} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black hover:bg-orange-600">
              <Plus size={17} className="mr-1 inline"/> Nova ordem
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-2 rounded-lg border border-orange-700/50 bg-orange-950/30 px-4 py-2 text-sm text-orange-300">
            {message}
          </div>
        )}

        {/* Quadro */}
        <div className="mt-3 overflow-x-auto pb-3">
          <div className="flex min-w-[1500px] gap-2">
            {colunas.map(({ etapa, pedidos: coluna }) => (
              <section
                key={etapa}
                onDragOver={e => { e.preventDefault(); setDragOver(etapa); }}
                onDrop={e => { e.preventDefault(); if (dragged) moverOrdem(dragged, etapa); }}
                style={{ width: larguraColuna }}
                className={`w-[145px] shrink-0 rounded-lg border ${dragOver === etapa ? 'border-orange-500 bg-orange-950/20' : 'border-slate-800 bg-[#091117]'}`}
              >
                {(
                  <div className="border-b border-slate-800 p-2">
                    <label className="mb-1 flex items-center gap-1 text-[10px] font-bold text-slate-300">
                      <UserRound size={13} className="text-orange-500" />
                      RESPONSÁVEL
                    </label>
                    <select
                      value={operadoresPorEtapa[etapa]?.id || ''}
                      onChange={e => {
                        const operador = operadores.find(
                          op => String(op.id) === String(e.target.value)
                        );
                        setOperadoresPorEtapa(old => ({ ...old, [etapa]: operador || null }));
                      }}
                      className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-[11px] font-semibold text-slate-200 outline-none focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {operadores.map(op => (
                        <option key={op.id} value={op.id}>
                          {op.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-slate-800 px-2 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${stageColor(etapa).split(' ')[0]}`}/>
                    <span className="truncate text-xs font-black">{etapa}</span>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold">{coluna.length}</span>
                </div>

                <div className="min-h-[650px] space-y-2 p-2">
                  {coluna.map(pedido => {
                    const quantidade = Number(pedido.quantity ?? pedido.quantidade ?? 0);
                    const produzido = Number(pedido.quantidade_produzida ?? 0);
                    const prioridade = getPriority(pedido.priority || pedido.prioridade);
                    const origem = originInfo(pedido.origem || pedido.origin || pedido.source || pedido.order_source);
                    const idx = etapasVisuais.indexOf(etapa);

                    return (
                      <article
                        key={pedido.id}
                        draggable
                        onDragStart={() => setDragged(pedido)}
                        onDragEnd={() => { setDragged(null); setDragOver(null); }}
                        className="cursor-grab rounded-lg border border-slate-700 bg-[#10191f] p-2 shadow-lg active:cursor-grabbing"
                      >
                        <div className="flex gap-2">
                          <div onClick={() => { const src = pedido?.image_url || pedido?.image || pedido?.foto || pedido?.product_image; if (src) setZoomImage(src); }} className="cursor-zoom-in inline-block"><ProductThumb order={pedido}/></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[11px] font-black text-cyan-400">#{pedido.order_number || pedido.numero}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                                prioridade === 'urgente' ? 'bg-red-500 text-white' :
                                prioridade === 'alta' ? 'bg-orange-400 text-slate-950' :
                                'bg-slate-600 text-white'
                              }`}>{prioridade.toUpperCase()}</span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight">{pedido.product_name || 'Produto sem nome'}</div>
                            <div className="mt-1 text-[9px] text-slate-400">SKU: <b className="text-slate-200">{pedido.sku || '-'}</b></div>
                            <div className="text-[9px] text-slate-300">Qtd: <b>{quantidade}</b></div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between rounded bg-slate-900/80 px-2 py-1.5">
                          <span className="text-[9px]">Produzido: <b className="text-emerald-400">{produzido}/{quantidade}</b></span>
                          <span className="text-[9px] text-slate-400"><Clock3 size={11} className="mr-1 inline"/> {formatElapsed(pedido.data_inicio)}</span>
                        </div>

                        <div className="mt-2 flex items-center gap-1">
                          <span className={`rounded px-1.5 py-1 text-[8px] font-black ${
                            origem.color === 'orange' ? 'bg-orange-500' : origem.color === 'yellow' ? 'bg-yellow-400 text-slate-900' : 'bg-blue-600'
                          }`}>{origem.label}</span>
                          <button onClick={() => abrirEdicao(pedido)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-700"><Edit3 size={13}/></button>
                          {idx < etapasVisuais.length - 1 && (
                            <button onClick={() => moverOrdem(pedido, etapasVisuais[idx + 1])} className="rounded bg-orange-500 p-1 text-white hover:bg-orange-600"><ChevronRight size={13}/></button>
                          )}
                          <button onClick={() => excluirOrdem(pedido)} className="rounded p-1 text-red-400 hover:bg-red-950"><Trash2 size={13}/></button>
                        </div>
                      </article>
                    );
                  })}

                  {coluna.length === 0 && (
                    <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-slate-500">
                      <Package size={25} className="mb-2 text-slate-600"/>
                      <div className="text-[10px]">Nenhuma ordem</div>
                      <div className="text-[9px]">nesta etapa</div>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[94vh] w-full max-w-[710px] overflow-y-auto rounded-xl border border-slate-700 bg-[#0a1117] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500"><Plus size={19}/></span><h2 className="text-xl font-black">Nova ordem de produção</h2></div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X/></button>
            </div>

            <form onSubmit={salvarOrdem} className="grid grid-cols-2 gap-4 p-5">
              {/* RESPONSAVEL-CADASTRO-SELECT */}
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold text-orange-400">Responsável pelo cadastro *</label>
                <select
                  value={(responsavelCadastro && responsavelCadastro.id) ? responsavelCadastro.id : ""}
                  onChange={function(e) {
                    var op = operadores.find(function(o) { return String(o.id) === String(e.target.value); });
                    setResponsavelCadastro(op || null);
                  }}
                  required
                  className="field"
                >
                  <option value="">Selecione o responsável...</option>
                  {operadores.map(function(op) {
                    return <option key={op.id} value={op.id}>{op.nome}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Foto da peça</label>
                <div className="flex gap-3">
                  <ProductThumb order={form} large/>
                  <label className="flex h-36 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 text-center text-xs text-slate-400 hover:border-orange-500">
                    <Upload size={28} className="mb-2"/>
                    Clique ou <b className="text-orange-400">Ctrl+V</b> para colar
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFotoOrdem(file);
                        setForm(f => ({...f, image_url: URL.createObjectURL(file)}));
                      }
                    }}/>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div><label className="mb-1 block text-xs font-bold text-slate-300">Nome da peça</label><input value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} placeholder="Nome da peça" required className="field"/></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-300">SKU</label><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="SKU da peça" className="field"/></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-300">Quantidade</label><input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} className="field"/></div>
              </div>

              <div className="col-span-2"><label className="mb-1 block text-xs font-bold text-slate-300">Observação</label><textarea rows="2" value={form.observations} onChange={e=>setForm({...form,observations:e.target.value})} placeholder="Observações da ordem..." className="field resize-none"/></div>

              <div className="col-span-2">
                <label className="mb-2 block text-xs font-bold text-slate-300">Origem do pedido</label>
                <div className="grid grid-cols-5 gap-4">
                  {ORIGENS.map(o => (
                    <button type="button" key={o.id} onClick={()=>setForm({...form,origem:o.id})}
                      className={`rounded-lg border-2 p-3 text-center ${form.origem===o.id ? 'border-orange-500 bg-slate-800' : 'border-slate-700 bg-slate-900'}`}>
                      <div className="text-xl">{o.icon}</div><div className="mt-1 text-[10px] font-black">{o.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 flex justify-end gap-2 border-t border-slate-700 pt-4">
                <button type="button" onClick={()=>setShowModal(false)} className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-bold">Cancelar</button>
                <button disabled={saving} className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-black hover:bg-orange-600">{saving ? 'Salvando...' : 'Criar ordem'}</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: GERENCIAR SETORES */}
      {showStageModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowStageModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{editingStage ? 'Editar Setor' : 'Novo Setor'}</h2>
              <button onClick={() => setShowStageModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>

            <form onSubmit={salvarSetor} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Nome do setor</label>
                <input className="field" value={stageForm.nome} onChange={(e) => setStageForm({ ...stageForm, nome: e.target.value })} required autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Cor</label>
                  <input type="color" className="field h-11 p-1" value={stageForm.cor} onChange={(e) => setStageForm({ ...stageForm, cor: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Ordem</label>
                  <input type="number" min="1" className="field" value={stageForm.ordem} onChange={(e) => setStageForm({ ...stageForm, ordem: Number(e.target.value) })} />
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t border-slate-700">
                {editingStage && (
                  <button type="button" onClick={() => { setShowStageModal(false); excluirSetor(editingStage); }} className="rounded-lg border border-red-700 text-red-400 px-4 py-2 text-sm font-bold hover:bg-red-950">
                    Desativar Setor
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => setShowStageModal(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold">Cancelar</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black hover:bg-orange-600">{saving ? 'Salvando...' : (editingStage ? 'Salvar' : 'Criar Setor')}</button>
                </div>
              </div>
            </form>

            {stagesFull.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-xs font-bold text-slate-400 mb-2">Setores existentes ({stagesFull.filter(s => s.ativo).length} ativos):</p>
                <div className="space-y-1">
                <div className="space-y-1">
                  {stagesFull.filter(s => s.ativo).map((s, idx, arr) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: s.cor || '#cbd5e1', backgroundColor: (s.cor || '#cbd5e1') + '15' }}>
                      <span className="flex-1 text-xs font-bold" style={{ color: '#e2e8f0' }}>{s.nome}</span>
                      <button type="button" disabled={idx === 0 || saving} onClick={() => moverSetor(s, 'up')} className="rounded p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Mover para cima">↑</button>
                      <button type="button" disabled={idx === arr.length - 1 || saving} onClick={() => moverSetor(s, 'down')} className="rounded p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Mover para baixo">↓</button>
                      <button type="button" onClick={() => abrirModalEditarSetor(s)} className="rounded p-1 text-blue-400 hover:bg-slate-700" title="Editar">✎</button>
                      <button type="button" disabled={saving} onClick={() => excluirSetor(s)} className="rounded p-1 text-red-400 hover:bg-red-950" title="Desativar setor">🗑</button>
                    </div>
                  ))}
                </div>

                    <p className="text-xs font-bold text-slate-500 mb-2">Setores Inativos ({stagesFull.filter(s => !s.ativo).length}):</p>
                    <div className="space-y-1">
                      {stagesFull.filter(s => !s.ativo).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/50 px-2 py-1 opacity-60">
                          <span className="flex-1 text-xs font-bold text-slate-500 line-through" style={{ color: '#94a3b8' }}>{s.nome}</span>
                          <button type="button" disabled={saving} onClick={() => reativarSetor(s)} className="rounded px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-700 hover:bg-emerald-950" title="Reativar setor">Reativar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ZOOM DA FOTO */}
      {zoomImage && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 cursor-zoom-out" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Zoom" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}

      <style>{`
        .field{width:100%;border:1px solid #334155;background:#0f1720;color:#fff;border-radius:8px;padding:10px 12px;font-size:13px;outline:none}
        .field:focus{border-color:#f97316;box-shadow:0 0 0 2px rgba(249,115,22,.12)}
        .field::placeholder{color:#64748b}
      `}</style>
    </div>
  );
}




















































