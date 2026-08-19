import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import StockPage from './pages/StockPage';
import BipagemPage from './pages/BipagemPage';
import ProductionPage from './pages/ProductionPage';
import OrdersPage from './pages/OrdersPage';
import ProductionBoardPage from './pages/ProductionBoardPage';
import NfePage from './pages/NfePage';
import ContabilidadePage from './pages/ContabilidadePage';
import FinancePage from './pages/FinancePage';
import RankingPage from './pages/RankingPage';
import AvisosPage from './pages/AvisosPage';
import UsersPage from './pages/UsersPage';
import LabelsPage from './pages/LabelsPage';
import DispatchPage from './pages/DispatchPage';
import TvPage from './pages/TvPage';
import SettingsPage from './pages/SettingsPage';
import ExecutiveAiPage from './pages/ExecutiveAiPage';
import SpreadsheetsPage from './pages/SpreadsheetsPage';
import StockMapPage from './pages/StockMapPage';
import CompaniesPage from './pages/CompaniesPage';
import ReturnsPage from './pages/ReturnsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import AuditPage from './pages/AuditPage';
import ImportPage from './pages/ImportPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute session={session} loading={loading}>
            <Layout session={session} />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/estoque" element={<StockPage />} />
        <Route path="/bipagem" element={<BipagemPage />} />
        <Route path="/producao" element={<ProductionPage />} />
        <Route path="/pedidos" element={<OrdersPage />} />
        <Route path="/quadro-producao" element={<ProductionBoardPage />} />
        <Route path="/nfe" element={<NfePage />} />
        <Route path="/contabilidade" element={<ContabilidadePage />} />
        <Route path="/financeiro" element={<FinancePage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/avisos" element={<AvisosPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/etiquetas" element={<LabelsPage />} />
        <Route path="/expedicao" element={<DispatchPage />} />
        <Route path="/tv" element={<TvPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/ia" element={<ExecutiveAiPage />} />
        <Route path="/planilhas" element={<SpreadsheetsPage />} />
        <Route path="/mapa-estoque" element={<StockMapPage />} />
        <Route path="/empresas" element={<CompaniesPage />} />
        <Route path="/devolucoes" element={<ReturnsPage />} />
        <Route path="/sugestoes" element={<SuggestionsPage />} />
        <Route path="/auditoria" element={<AuditPage />} />
        <Route path="/importacao" element={<ImportPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
