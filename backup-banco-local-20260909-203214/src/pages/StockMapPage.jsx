export default function StockMapPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Mapa</p>
        <h1 className="mt-2 text-3xl font-semibold">Mapa de Estoque</h1>
        <p className="mt-2 text-sm text-slate-400">Visualização do layout físico e localização de itens.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {['Zona A', 'Zona B', 'Zona C'].map((zone) => (
            <div key={zone} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="font-semibold">{zone}</h2>
              <p className="mt-2 text-sm text-slate-400">Área de armazenamento e movimentação.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
