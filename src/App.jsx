import { Navigate, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { useWebSocket } from './hooks/useWebSocket'
import { useAuth } from './hooks/useAuth.jsx'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Zones from './pages/Zones'
import Programs from './pages/Programs'
import Alerts from './pages/Alerts'
import Devices from './pages/Devices'
import Tanks from './pages/Tanks'
import Peripherals from './pages/Peripherals'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { data, status } = useWebSocket()

  return (
    <AppLayout wsStatus={status}>
      <Routes>
        <Route path="/" element={<Dashboard data={data} />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/history" element={<History />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/tanks" element={<Tanks />} />
        <Route path="/peripherals" element={<Peripherals />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
