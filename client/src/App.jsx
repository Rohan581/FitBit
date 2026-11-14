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
import MoneyNav from './components/MoneyNav';
import Login from './pages/Login';
import { MoneyMonth, MoneyActivity, MoneyReview, MoneyRecurring, MoneySavings, MoneySettings } from './pages/Money';
import { api } from './api';
import { initThemeListener } from './theme';

function UpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!show) return null;

  async function handleUpdate() {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations() || [];
      await Promise.all(regs.map(r => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {}
    window.location.reload();
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-card border border-points/30 rounded-card p-3 shadow-lg flex items-center justify-between gap-3">
      <p className="text-sm text-tx">New version available</p>
      <button onClick={handleUpdate} className="text-sm font-semibold text-points press-scale whitespace-nowrap">
        Update
      </button>
    </div>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isCook = location.pathname.startsWith('/cook');
  const isMoney = location.pathname.startsWith('/money');

  const openSidebar = () => setSidebarOpen(true);

  return (
    <>
      <UpdateToast />
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

            {/* Money routes */}
            <Route path="/money" element={<MoneyMonth onOpenSidebar={openSidebar} />} />
            <Route path="/money/activity" element={<MoneyActivity />} />
            <Route path="/money/review" element={<MoneyReview />} />
            <Route path="/money/recurring" element={<MoneyRecurring />} />
            <Route path="/money/savings" element={<MoneySavings />} />
            <Route path="/money/settings" element={<MoneySettings />} />

            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </div>
        {isCook ? <CookNav /> : isMoney ? <MoneyNav /> : <BottomNav />}
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}

function DefaultRedirect() {
  const lastModule = localStorage.getItem('earned_module');
  return <Navigate to={lastModule === 'cook' ? '/cook/recipes' : lastModule === 'money' ? '/money' : '/'} replace />;
}

export default function App() {
  useEffect(() => initThemeListener(), []);
  // null = checking, true = show the app, false = show the login screen
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    api.authStatus().then(a => setAuthed(!a.enabled || a.authed)).catch(() => setAuthed(true));
    const lock = () => setAuthed(false);
    window.addEventListener('auth-required', lock);
    return () => window.removeEventListener('auth-required', lock);
  }, []);

  if (authed === null) return <div className="h-full bg-page" />;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
