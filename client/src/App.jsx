import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import CookNav from './components/CookNav';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import FoodLog from './pages/FoodLog';
import Points from './pages/Points';
import Trends from './pages/Trends';
import History from './pages/History';
import Settings from './pages/Settings';
import Training from './pages/Training';
import CookRecipes from './pages/CookRecipes';
import CookRecipeDetail from './pages/CookRecipeDetail';
import CookMode from './pages/CookMode';
import CookCooked from './pages/CookCooked';
import { initThemeListener } from './theme';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isCook = location.pathname.startsWith('/cook');

  const openSidebar = () => setSidebarOpen(true);

  return (
    <>
      <div className="flex flex-col h-full bg-page">
        <div className="flex-1 overflow-y-auto page-content">
          <Routes>
            {/* Fitness routes */}
            <Route path="/" element={<Dashboard onOpenSidebar={openSidebar} />} />
            <Route path="/food" element={<FoodLog />} />
            <Route path="/training" element={<Training />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/rewards" element={<Points />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />

            {/* Cook routes */}
            <Route path="/cook/recipes" element={<CookRecipes onOpenSidebar={openSidebar} />} />
            <Route path="/cook/recipes/new" element={<CookRecipeDetail onOpenSidebar={openSidebar} isNew />} />
            <Route path="/cook/recipes/:id" element={<CookRecipeDetail onOpenSidebar={openSidebar} />} />
            <Route path="/cook/recipes/:id/edit" element={<CookRecipeDetail onOpenSidebar={openSidebar} isEdit />} />
            <Route path="/cook/recipes/:id/cook" element={<CookMode />} />
            <Route path="/cook/cooked" element={<CookCooked onOpenSidebar={openSidebar} />} />
            <Route path="/cook" element={<Navigate to="/cook/recipes" replace />} />

            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </div>
        {isCook ? <CookNav /> : <BottomNav />}
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}

function DefaultRedirect() {
  const lastModule = localStorage.getItem('earned_module');
  return <Navigate to={lastModule === 'cook' ? '/cook/recipes' : '/'} replace />;
}

export default function App() {
  useEffect(() => initThemeListener(), []);

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
