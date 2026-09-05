import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, QrCode, Users, Bell, Trophy } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const menus = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/estoque', icon: Package, label: 'Estoque' },
    { path: '/bipagem', icon: QrCode, label: 'Bipagem' },
    { path: '/usuarios', icon: Users, label: 'Usuários' },
    { path: '/avisos', icon: Bell, label: 'Avisos' },
    { path: '/ranking', icon: Trophy, label: 'Ranking' },
  ];

  return (
    <div className="w-64 h-screen bg-slate-900 border-r border-slate-800 p-4 fixed">
      <div className="text-orange-400 font-bold text-xl mb-8">🏁 Metal Racing</div>
      <nav className="space-y-2">
        {menus.map((menu) => {
          const Icon = menu.icon;
          const isActive = location.pathname === menu.path;
          return (
            <Link
              key={menu.path}
              to={menu.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                isActive ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={20} />
              <span>{menu.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
