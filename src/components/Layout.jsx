import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import {
  LayoutDashboard, Film, ListChecks, Users,
  DollarSign, Settings, LogOut, ChevronRight, CalendarRange, FileText,
  Menu, X
} from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/programas',    icon: Film,            label: 'Programas'     },
  { to: '/timeline',     icon: CalendarRange,   label: 'Vista General' },
  { to: '/reporte',      icon: FileText,        label: 'Reporte Status'},
  { to: '/actividades',  icon: ListChecks,      label: 'Actividades'   },
  { to: '/participantes',icon: Users,           label: 'Participantes' },
  { to: '/configuracion',icon: Settings,        label: 'Configuración' },
]

// Bottom nav items (las más usadas en móvil)
const mobileNavItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/programas',    icon: Film,            label: 'Programas'  },
  { to: '/reporte',      icon: FileText,        label: 'Reporte'    },
  { to: '/actividades',  icon: ListChecks,      label: 'Actividades'},
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      {/* ====== Desktop Sidebar ====== */}
      <aside className="hidden md:flex w-56 bg-[#1a1a1a] flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/capro-iso.svg" alt="CAPRO" className="w-7 h-7 flex-shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-white/50 text-[8px] font-light tracking-[3px] uppercase">CAPRO</span>
              <span className="text-white text-sm font-light tracking-[4px] uppercase mt-0.5">
                SIPRO<span className="font-bold">FILM</span>
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors group
                 ${isActive
                   ? 'bg-white/10 text-white font-medium border-l-2 border-[#BE1E2D] pl-[10px]'
                   : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-[10px]'
                 }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center
                            text-white text-xs font-semibold flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-gray-400 text-xs truncate">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-gray-500 hover:text-white text-xs
                       transition-colors w-full px-1"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ====== Mobile Top Bar ====== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1a1a] flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/capro-iso.svg" alt="CAPRO" className="w-6 h-6" />
          <span className="text-white text-xs tracking-[3px] uppercase">
            SIPRO<span className="font-bold">FILM</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-1"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ====== Mobile Drawer ====== */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden fixed top-0 left-0 bottom-0 w-64 bg-[#1a1a1a] z-50 flex flex-col animate-slide-in">
            {/* Logo */}
            <div className="px-5 pt-6 pb-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/capro-iso.svg" alt="CAPRO" className="w-7 h-7" />
                <div className="flex flex-col leading-none">
                  <span className="text-white/50 text-[8px] font-light tracking-[3px] uppercase">CAPRO</span>
                  <span className="text-white text-sm font-light tracking-[4px] uppercase mt-0.5">
                    SIPRO<span className="font-bold">FILM</span>
                  </span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/60 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors
                     ${isActive
                       ? 'bg-white/10 text-white font-medium'
                       : 'text-gray-400 hover:bg-white/5 hover:text-white'
                     }`
                  }
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* User */}
            <div className="px-4 py-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center
                                text-white text-xs font-semibold flex-shrink-0">
                  {user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-gray-400 text-xs truncate">{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-gray-500 hover:text-white text-xs
                           transition-colors w-full px-1"
              >
                <LogOut size={13} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====== Main content ====== */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* ====== Mobile Bottom Nav ====== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200
                      flex items-center justify-around py-2 px-1">
        {mobileNavItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 px-3 py-1"
            >
              <Icon size={20} className={isActive ? 'text-[#BE1E2D]' : 'text-gray-400'} />
              <span className={`text-[10px] ${isActive ? 'text-[#BE1E2D] font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </NavLink>
          )
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1"
        >
          <Menu size={20} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">Más</span>
        </button>
      </div>
    </div>
  )
}

/* Componente reutilizable para encabezados de página */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 md:mb-8 gap-3">
      <div>
        <h1 className="text-lg md:text-xl font-semibold text-[#1a1a1a] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* Breadcrumb simple */
export function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} />}
          <span className={i === items.length - 1 ? 'text-gray-700 font-medium' : ''}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  )
}
