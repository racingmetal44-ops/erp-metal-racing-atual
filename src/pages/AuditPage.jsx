import { useEffect, useState } from 'react';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/pcp/auditoria-frontend?limite=200');
        const data = await res.json();

        if (!data.sucesso) throw new Error(data.erro || 'Erro');

        const registros = (data.registros || []).map((item) => ({
          id: item.id,
          action: item.action,
          created_at: item.created_at,
          details: item.details
        }));

        // Ordena por data desc
        registros.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setLogs(registros);
      } catch (error) {
        console.error('Erro ao carregar auditoria:', error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
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

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">
          Carregando auditoria...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">
          <p className="text-slate-400">Nenhum registro de auditoria encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{log.action || 'Evento'}</h2>
                <span className="text-sm text-slate-400">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{log.details || 'Detalhes não informados'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
