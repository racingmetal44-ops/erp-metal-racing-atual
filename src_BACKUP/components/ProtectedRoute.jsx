import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, session, loading }) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-4 text-slate-300">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
