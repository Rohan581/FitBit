import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import FoodLog from './pages/FoodLog';
import Points from './pages/Points';
import Trends from './pages/Trends';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-warm-50 max-w-lg mx-auto">
        <div className="flex-1 overflow-y-auto page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/food" element={<FoodLog />} />
            <Route path="/points" element={<Points />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
