export default function SpreadsheetsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Planilhas</p>
        <h1 className="mt-2 text-3xl font-semibold">Planilhas</h1>
        <p className="mt-2 text-sm text-slate-400">Gestão de relatórios e planilhas da operação.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {['Produção', 'Estoque', 'Financeiro', 'Logística'].map((sheet) => (
            <div key={sheet} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="font-semibold">{sheet}</h2>
              <p className="mt-2 text-sm text-slate-400">Planilha disponível para visualização e exportação.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
