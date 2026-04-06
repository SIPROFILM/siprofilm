import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewProgram from './pages/NewProgram'
import ProgramDetail from './pages/ProgramDetail'
import Participants from './pages/Participants'
import Settings from './pages/Settings'
import Timeline from './pages/Timeline'

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
              <Route path="programas/nuevo" element={<NewProgram />} />
              <Route path="programas/:id" element={<ProgramDetail />} />
              <Route path="actividades" element={<ActivitiesCatalogPlaceholder />} />
              <Route path="participantes" element={<Participants />} />
              <Route path="configuracion" element={<Settings />} />
              <Route path="timeline" element={<Timeline />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

// Placeholder para el catálogo de actividades (próxima iteración)
function ActivitiesCatalogPlaceholder() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">Catálogo de actividades</h1>
      <p className="text-sm text-gray-500 mb-6">
        Biblioteca de actividades reutilizables cargadas desde el Excel original.
      </p>
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
        En construcción — próxima iteración.
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
