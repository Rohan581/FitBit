import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ModuleSwitcher from './components/ModuleSwitcher';
import Dashboard from './pages/Dashboard';
import FoodLog from './pages/FoodLog';
import Points from './pages/Points';
import Trends from './pages/Trends';
import History from './pages/History';
import Settings from './pages/Settings';
import Training from './pages/Training';
import Finance from './pages/Finance';
import { initThemeListener } from './theme';

export default function App() {
  useEffect(() => initThemeListener(), []);

  const [module, setModule] = useState(() => localStorage.getItem('earned_module') || 'fitness');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function switchModule(m) {
    setModule(m);
    localStorage.setItem('earned_module', m);
    setSidebarOpen(false);
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-page">
        <div className="flex-1 overflow-y-auto page-content">
          {module === 'fitness' ? (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/food" element={<FoodLog />} />
              <Route path="/training" element={<Training />} />
              <Route path="/trends" element={<Trends />} />
              <Route path="/rewards" element={<Points />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            <Finance onOpenSidebar={() => setSidebarOpen(true)} />
          )}
        </div>
        {module === 'fitness' && (
          <BottomNav onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </div>
      <ModuleSwitcher
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        current={module}
        onSwitch={switchModule}
      />
    </BrowserRouter>
  );
}
