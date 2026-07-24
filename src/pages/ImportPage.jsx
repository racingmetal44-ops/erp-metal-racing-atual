export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Importação</p>
        <h1 className="mt-2 text-3xl font-semibold">Importação</h1>
        <p className="mt-2 text-sm text-slate-400">Área para importar dados, planilhas e cadastros.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <label className="block rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
          Arraste arquivos aqui ou clique para selecionar
          <input type="file" className="hidden" />
        </label>
      </div>
    </div>
  );
}
