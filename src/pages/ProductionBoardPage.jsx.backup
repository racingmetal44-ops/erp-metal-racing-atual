import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Cores/rotulo por marketplace. Adicione outros aqui se precisar (ex: Amazon).
const MARKETPLACE_STYLE = {
  shopee: { label: 'Shopee', bg: 'bg-orange-500', text: 'text-white' },
  'mercado livre': { label: 'Mercado Livre', bg: 'bg-yellow-400', text: 'text-slate-900' },
};

function marketplaceBadge(marketplace) {
  const key = (marketplace || '').trim().toLowerCase();
  const style = MARKETPLACE_STYLE[key];
  if (style) return style;
  return { label: marketplace || 'Marketplace', bg: 'bg-slate-600', text: 'text-white' };
}

function calcularPrazo(createdAt, cutoffTime) {
  const [h, m] = cutoffTime.split(':').map(Number);
  const criado = new Date(createdAt);
  const prazo = new Date(criado);
  prazo.setHours(h, m, 0, 0);
  if (criado > prazo) {
    prazo.setDate(prazo.getDate() + 1);
  }
  return prazo;
}

function formatarTempoDecorrido(dataISO) {
  const diffMs = Date.now() - new Date(dataISO).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 60) return `${minutos} min atras`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h${minutos % 60}min atras`;
  const dias = Math.floor(horas / 24);
  return `${dias}d atras`;
}

export default function ProductionBoardPage() {
  const [orders, setOrders] = useState([]);
  const [productPhotos, setProductPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [cutoffTime, setCutoffTime] = useState('14:00');
  const [cutoffInput, setCutoffInput] = useState('14:00');
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [marcandoId, setMarcandoId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const loadCutoff = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      setCutoffTime(data.cutoff_time);
      setCutoffInput(data.cutoff_time);
    }
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .is('produced_at', null)
      .order('created_at', { ascending: true });

    if (ordersError) {
      setMessage(`Falha ao carregar pedidos: ${ordersError.message}`);
      setLoading(false);
      return;
    }

    const pendingOrders = ordersData ?? [];
    setOrders(pendingOrders);

    const skus = Array.from(
      new Set(
        pendingOrders
          .map((o) => o.items?.[0]?.sku)
          .filter(Boolean)
      )
    );

    if (skus.length > 0) {
      const { data: productsData } = await supabase
        .from('products')
        .select('id, sku')
        .in('sku', skus);

      const productIds = (productsData ?? []).map((p) => p.id);
      const skuByProductId = {};
      (productsData ?? []).forEach((p) => { skuByProductId[p.id] = p.sku; });

      let photosBySku = {};
      if (productIds.length > 0) {
        const { data: filesData } = await supabase
          .from('product_files')
          .select('product_id, file_url, is_primary, sort_order')
          .in('product_id', productIds);

        (filesData ?? [])
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .forEach((file) => {
            const sku = skuByProductId[file.product_id];
            if (sku && !photosBySku[sku]) {
              photosBySku[sku] = file.file_url;
            }
          });
      }
      setProductPhotos(photosBySku);
    } else {
      setProductPhotos({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadCutoff();
    loadBoard();
    const interval = setInterval(loadBoard, 30000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [loadCutoff, loadBoard]);

  async function salvarCutoff(e) {
    e.preventDefault();
    setSavingCutoff(true);
    const { data: existing } = await supabase
      .from('production_settings')
      .select('id')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from('production_settings')
          .update({ cutoff_time: cutoffInput, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('production_settings').insert({ cutoff_time: cutoffInput });

    setSavingCutoff(false);
    if (!error) {
      setCutoffTime(cutoffInput);
      setMessage('Horario de corte atualizado.');
    } else {
      setMessage(error.message);
    }
  }

  async function marcarComoProduzido(order) {
    setMarcandoId(order.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('orders')
      .update({
        produced_at: new Date().toISOString(),
        produced_by: userData?.user?.email || 'sistema',
        status: 'Produzido',
      })
      .eq('id', order.id);
    setMarcandoId(null);
    if (!error) {
      await loadBoard();
    } else {
      setMessage(error.message);
    }
  }

  const ordersComPrazo = orders.map((order) => {
    const prazo = calcularPrazo(order.created_at, cutoffTime);
    const atrasado = now > prazo.getTime();
    return { ...order, atrasado };
  });

  const novos = ordersComPrazo.filter((o) => !o.atrasado);
  const atrasados = ordersComPrazo.filter((o) => o.atrasado);

  function Card({ order }) {
    const sku = order.items?.[0]?.sku;
    const foto = sku ? productPhotos[sku] : null;
    const badge = marketplaceBadge(order.marketplace);
    const nomeItem = order.items?.[0]?.product_name || 'Produto';
    const outrosItens = (order.items?.length ?? 0) - 1;

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex gap-3">
        <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center">
          {foto ? (
            <img src={foto} alt={nomeItem} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-slate-500 text-center px-1">sem foto</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <span className="text-xs text-slate-500">{formatarTempoDecorrido(order.created_at)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-100 truncate">{order.order_number}</p>
          <p className="text-xs text-slate-400 truncate">{order.client_name || 'Cliente nao informado'}</p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {nomeItem}
            {sku ? ` . SKU: ${sku}` : ''}
            {outrosItens > 0 ? ` +${outrosItens} item(s)` : ''}
          </p>
          <button
            onClick={() => marcarComoProduzido(order)}
            disabled={marcandoId === order.id}
            className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 transition px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {marcandoId === order.id ? 'Marcando...' : 'Marcar como produzido'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Producao</p>
        <h1 className="mt-2 text-3xl font-semibold">Quadro de Producao</h1>
        <p className="mt-2 text-sm text-slate-400">
          Pedidos novos de Shopee, Mercado Livre e Bling, com a foto do produto puxada pelo SKU do estoque.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Horario de corte</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pedidos que passarem desse horario sem serem marcados como produzidos entram como "Atrasado".
        </p>
        {message ? <p className="mt-2 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={salvarCutoff} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Horario</label>
            <input
              type="time"
              value={cutoffInput}
              onChange={(e) => setCutoffInput(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
            />
          </div>
          <button
            disabled={savingCutoff}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingCutoff ? 'Salvando...' : 'Salvar horario'}
          </button>
          <span className="text-xs text-slate-500">Atual: {cutoffTime}</span>
        </form>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando quadro...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-emerald-300">Venda Nova</h2>
              <span className="text-2xl font-bold text-emerald-300">{novos.length}</span>
            </div>
            <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {novos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum pedido novo pendente.</p>
              ) : (
                novos.map((order) => <Card key={order.id} order={order} />)
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-500/40 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-rose-300">Venda Atrasada</h2>
              <span className="text-2xl font-bold text-rose-300">{atrasados.length}</span>
            </div>
            <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {atrasados.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum pedido atrasado.</p>
              ) : (
                atrasados.map((order) => <Card key={order.id} order={order} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}