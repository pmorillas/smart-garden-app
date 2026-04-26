import { Routes, Route, NavLink } from 'react-router-dom'

import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Zones from './pages/Zones'
import Alerts from './pages/Alerts'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-green-700 text-white px-6 py-3 flex gap-6">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/history">Historial</NavLink>
        <NavLink to="/zones">Zones</NavLink>
        <NavLink to="/alerts">Alertes</NavLink>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/alerts" element={<Alerts />} />
        </Routes>
      </main>
    </div>
  )
}
