export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
        <h1 className="text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-400">A rota informada não existe.</p>
      </div>
    </div>
  );
}
