export default function Dashboard() {
  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold">📊 Dashboard</h1>
      <p className="text-slate-400 mt-2">Bem-vindo ao ERP Metal Racing</p>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-slate-800 p-6 rounded-xl"><p className="text-slate-400">Total Produtos</p><p className="text-2xl font-bold">0</p></div>
        <div className="bg-slate-800 p-6 rounded-xl"><p className="text-slate-400">Bipagens Hoje</p><p className="text-2xl font-bold">0</p></div>
        <div className="bg-slate-800 p-6 rounded-xl"><p className="text-slate-400">Alertas</p><p className="text-2xl font-bold">0</p></div>
      </div>
    </div>
  );
}
