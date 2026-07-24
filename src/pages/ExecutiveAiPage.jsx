export default function ExecutiveAiPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">IA executiva</p>
        <h1 className="mt-2 text-3xl font-semibold">IA Executiva</h1>
        <p className="mt-2 text-sm text-slate-400">Assistente para análise, recomendações e visão rápida do negócio.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Resumo de performance</h2>
        <p className="mt-3 text-sm text-slate-400">Com base na operação atual, a recomendação principal é priorizar pedidos com estoque baixo e alertas críticos.</p>
      </div>
    </div>
  );
}
