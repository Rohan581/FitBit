import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import FoodLog from './pages/FoodLog';
import Points from './pages/Points';
import Trends from './pages/Trends';
import History from './pages/History';
import Settings from './pages/Settings';
import { initThemeListener } from './theme';

export default function App() {
  useEffect(() => initThemeListener(), []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-warm-50">
        <div className="flex-1 overflow-y-auto page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/food" element={<FoodLog />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/rewards" element={<Points />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
