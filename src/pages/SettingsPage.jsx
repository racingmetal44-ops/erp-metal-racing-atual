export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold">Configurações</h1>
        <p className="mt-2 text-sm text-slate-400">Centro de configuração do ERP.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="space-y-4">
          {['Integrações', 'Permissões', 'Notificações', 'Workflows'].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <span>{item}</span>
              <span className="text-sm text-slate-400">Ativo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
