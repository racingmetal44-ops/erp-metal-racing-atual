import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function load() {
      const [{ data: auditLogs }, { data: bipagens }, auditoriaLocal] = await Promise.all([
        supabase.from('audit_logs').select('*').order('id', { ascending: false }),
        supabase.from('bipagem_history').select('*').order('created_at', { ascending: false }).limit(500),
        fetch('/api/nfe-entradas/auditoria-bipagens').then((response) => response.ok ? response.json() : { registros: [] }).catch(() => ({ registros: [] })),
      ]);

      const bipagemLogs = (bipagens ?? []).map((item) => ({
        id: `bipagem-${item.id}`,
        action: `Bipagem - ${String(item.tipo || 'evento').toUpperCase()}`,
        created_at: item.created_at,
        details: `${item.usuario_nome || 'Sistema'} bipou ${item.product_name || 'produto não encontrado'} | Código: ${item.product_sku || '-'} | Quantidade: ${item.quantidade ?? 0} | Estoque: ${item.quantidade_anterior ?? 0} -> ${item.quantidade_nova ?? 0}`,
      }));

      const registrosLocais = (auditoriaLocal?.registros ?? []).map((item, index) => ({
        id: `auditoria-local-${index}-${item.created_at}`,
        action: `Bipagem - ${String(item.tipo || 'evento').toUpperCase()}`,
        created_at: item.created_at,
        details: `${item.usuario_nome || 'Sistema'} bipou ${item.product_name || 'produto'} | Código: ${item.product_sku || '-'} | Quantidade: ${item.quantidade ?? 0} | Estoque: ${item.quantidade_anterior ?? 0} -> ${item.quantidade_nova ?? 0}`,
      }));

      setLogs([...((auditLogs ?? [])), ...bipagemLogs, ...registrosLocais].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Auditoria</p>
        <h1 className="mt-2 text-3xl font-semibold">Auditoria</h1>
        <p className="mt-2 text-sm text-slate-400">Registro histórico de operações e eventos do sistema.</p>
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{log.action || 'Evento'}</h2>
              <span className="text-sm text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{log.details || 'Detalhes não informados'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

