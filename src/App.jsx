import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewProgram from './pages/NewProgram'
import ProgramDetail from './pages/ProgramDetail'
import Participants from './pages/Participants'
import Settings from './pages/Settings'
import Timeline from './pages/Timeline'
import StatusReport from './pages/StatusReport'
import Programs from './pages/Programs'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1a1a1a] rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="programas" element={<Programs />} />
              <Route path="programas/nuevo" element={<NewProgram />} />
              <Route path="programas/:id" element={<ProgramDetail />} />
              <Route path="presupuesto" element={<BudgetPlaceholder />} />
              <Route path="participantes" element={<Participants />} />
              <Route path="configuracion" element={<Settings />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="reporte" element={<StatusReport />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

// Placeholder para presupuestos (próxima iteración)
function BudgetPlaceholder() {
  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <h1 className="text-lg md:text-xl font-display font-semibold text-sf-cream tracking-tight mb-1">Presupuesto</h1>
      <p className="text-xs md:text-sm text-sf-muted mb-6">
        Control de costos por programa y vista general de la organización.
      </p>
      <div className="rounded-xl p-8 text-center text-sf-muted text-sm"
           style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.1)' }}>
        <span className="text-sf-pink font-mono text-xs font-medium">EN CONSTRUCCIÓN</span>
        <p className="mt-2 text-sf-muted text-xs">Próxima iteración — presupuestos por programa con categorías de gasto.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <OrgProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </OrgProvider>
    </AuthProvider>
  )
}
