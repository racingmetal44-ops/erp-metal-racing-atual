import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ScanBarcode, Factory, ShoppingCart, FileText, Landmark, TrendingUp, Bell, Users, Tag, Truck, Tv, Settings, Bot, Table2, Map, Building2, RotateCcw, Lightbulb, ShieldCheck, Upload, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/bipagem', label: 'Bipagem', icon: ScanBarcode },
  { to: '/producao', label: 'Produção', icon: Factory },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/nfe', label: 'NF-e', icon: FileText },
  { to: '/financeiro', label: 'Financeiro', icon: Landmark },
  { to: '/ranking', label: 'Ranking', icon: TrendingUp },
  { to: '/avisos', label: 'Avisos', icon: Bell },
  { to: '/usuarios', label: 'Usuários', icon: Users },
  { to: '/etiquetas', label: 'Etiquetas', icon: Tag },
  { to: '/expedicao', label: 'Expedição', icon: Truck },
  { to: '/tv', label: 'TV Operacional', icon: Tv },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/ia', label: 'IA Executiva', icon: Bot },
  { to: '/planilhas', label: 'Planilhas', icon: Table2 },
  { to: '/mapa-estoque', label: 'Mapa de Estoque', icon: Map },
  { to: '/empresas', label: 'Empresas', icon: Building2 },
  { to: '/devolucoes', label: 'Devoluções', icon: RotateCcw },
  { to: '/sugestoes', label: 'Sugestões', icon: Lightbulb },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { to: '/importacao', label: 'Importação', icon: Upload },
];

export default function Layout({ session }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 flex-col border-r border-white/10 bg-slate-950/70 p-5 backdrop-blur">
          <div className="mb-8 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-orange-400">ERP Metal Racing</p>
            <h1 className="mt-2 text-xl font-semibold">Operação integrada</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-orange-500/20 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.12)]' : 'text-slate-300 hover:bg-slate-800/70'}`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="mt-auto flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 transition hover:border-orange-500/40 hover:text-orange-300"
          >
            <LogOut size={16} />
            Sair
          </button>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 shadow-lg shadow-slate-950/30 backdrop-blur">
            <div>
              <p className="text-sm text-slate-400">Sistema ERP</p>
              <h2 className="text-xl font-semibold">Metal Racing</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">{session?.user?.email || 'Usuário'}</span>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
