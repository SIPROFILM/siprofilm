import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Film, ListChecks, Users,
  DollarSign, Settings, LogOut, ChevronRight, CalendarRange
} from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/programas',    icon: Film,            label: 'Programas'     },
  { to: '/timeline',     icon: CalendarRange,   label: 'Vista General' },
  { to: '/actividades',  icon: ListChecks,      label: 'Actividades'   },
  { to: '/participantes',icon: Users,           label: 'Participantes' },
  { to: '/configuracion',icon: Settings,        label: 'Configuración' },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1a1a] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 pt-7 pb-6 border-b border-white/10">
          <span className="text-white text-base font-light tracking-[5px] uppercase">
            SIPRO<span className="font-semibold">FILM</span>
          </span>
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
                   ? 'bg-white/10 text-white font-medium'
                   : 'text-gray-400 hover:bg-white/5 hover:text-white'
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

/* Componente reutilizable para encabezados de página */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1a1a1a] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
