import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import OrgSwitcher from './OrgSwitcher'
import { useState } from 'react'
import {
  LayoutDashboard, Film, Users,
  DollarSign, Settings, LogOut, ChevronRight, CalendarRange, FileText,
  Menu, X
} from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/programas',    icon: Film,            label: 'Programas'     },
  { to: '/timeline',     icon: CalendarRange,   label: 'Vista General' },
  { to: '/reporte',      icon: FileText,        label: 'Reporte Status'},
  { to: '/presupuesto',  icon: DollarSign,       label: 'Presupuesto'   },
  { to: '/participantes',icon: Users,           label: 'Participantes' },
  { to: '/configuracion',icon: Settings,        label: 'Configuración' },
]

const mobileNavItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/programas',    icon: Film,            label: 'Programas'  },
  { to: '/reporte',      icon: FileText,        label: 'Reporte'    },
  { to: '/presupuesto',  icon: DollarSign,       label: 'Presupuesto'},
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
    <div className="flex h-screen bg-sf-bg overflow-hidden">
      {/* ====== Desktop Sidebar ====== */}
      <aside className="hidden md:flex w-56 bg-sf-surface flex-col flex-shrink-0 border-r"
             style={{ borderColor: 'rgba(199,191,239,0.08)' }}>
        {/* Brand */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-[7px] h-[7px] rounded-full bg-sf-pink dot-pulse flex-shrink-0" />
            <span className="font-mono text-sf-cream text-[11px] font-medium tracking-[2px]">
              SIPRO<span className="text-sf-pink">FILM</span>
            </span>
          </div>
        </div>

        {/* Org Switcher */}
        <OrgSwitcher />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group
                 ${isActive
                   ? 'text-sf-cream font-medium'
                   : 'text-sf-muted hover:text-sf-cream'
                 }`
              }
              style={({ isActive }) => isActive ? { background: 'rgba(249,45,151,0.08)' } : {}}
            >
              {({ isActive }) => (
                <>
                  <div className={`w-[5px] h-[5px] rounded-full flex-shrink-0 transition-all
                    ${isActive ? 'bg-sf-pink shadow-[0_0_6px_rgba(249,45,151,0.5)]' : ''}`}
                    style={!isActive ? { background: 'rgba(199,191,239,0.15)' } : {}}
                  />
                  <Icon size={16} className="flex-shrink-0" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sf-lavender text-xs font-medium flex-shrink-0"
                 style={{ background: 'rgba(75,82,235,0.2)', border: '1px solid rgba(75,82,235,0.3)' }}>
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-sf-muted text-xs font-mono truncate">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sf-muted hover:text-sf-cream text-xs transition-colors w-full px-1"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ====== Mobile Top Bar ====== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sf-surface flex items-center justify-between px-4 h-14 print:hidden"
           style={{ borderBottom: '1px solid rgba(199,191,239,0.08)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-[6px] h-[6px] rounded-full bg-sf-pink dot-pulse" />
          <span className="font-mono text-sf-cream text-[11px] font-medium tracking-[2px]">
            SIPRO<span className="text-sf-pink">FILM</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-sf-cream p-2.5 -mr-2 rounded-lg transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ====== Mobile Drawer ====== */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-sf-surface z-50 flex flex-col">
            {/* Brand */}
            <div className="px-5 pt-6 pb-5 flex items-center justify-between"
                 style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-[7px] h-[7px] rounded-full bg-sf-pink dot-pulse" />
                <span className="font-mono text-sf-cream text-[11px] font-medium tracking-[2px]">
                  SIPRO<span className="text-sf-pink">FILM</span>
                </span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-sf-muted p-1">
                <X size={20} />
              </button>
            </div>

            {/* Org Switcher in mobile drawer */}
            <OrgSwitcher onSwitch={() => setMobileMenuOpen(false)} />

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map(({ to, icon: Icon, label }) => {
                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm transition-all
                       ${isActive ? 'text-sf-cream font-medium' : 'text-sf-muted'}`}
                    style={isActive ? { background: 'rgba(249,45,151,0.08)' } : {}}
                  >
                    <div className={`w-[5px] h-[5px] rounded-full flex-shrink-0
                      ${isActive ? 'bg-sf-pink shadow-[0_0_6px_rgba(249,45,151,0.5)]' : ''}`}
                      style={!isActive ? { background: 'rgba(199,191,239,0.15)' } : {}}
                    />
                    <Icon size={20} className="flex-shrink-0" />
                    {label}
                  </NavLink>
                )
              })}
            </nav>

            <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(199,191,239,0.08)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sf-lavender text-xs font-medium flex-shrink-0"
                     style={{ background: 'rgba(75,82,235,0.2)', border: '1px solid rgba(75,82,235,0.3)' }}>
                  {user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-sf-muted text-xs font-mono truncate">{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sf-muted hover:text-sf-cream text-xs transition-colors w-full px-1"
              >
                <LogOut size={13} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====== Main content ====== */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* ====== Mobile Bottom Nav ====== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sf-surface
                      flex items-stretch justify-around print:hidden"
           style={{ borderTop: '1px solid rgba(199,191,239,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileNavItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-2 transition-colors"
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-sf-pink' : 'text-sf-muted'} />
              <span className={`text-[10px] leading-tight font-mono ${isActive ? 'text-sf-pink font-medium' : 'text-sf-muted'}`}>
                {label}
              </span>
            </NavLink>
          )
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-2 transition-colors"
        >
          <Menu size={22} strokeWidth={1.8} className="text-sf-muted" />
          <span className="text-[10px] leading-tight text-sf-muted font-mono">Más</span>
        </button>
      </nav>
    </div>
  )
}

/* Componente reutilizable para encabezados de página */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 md:mb-8 gap-3">
      <div>
        <h1 className="text-lg md:text-xl font-display font-semibold text-sf-cream tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-sf-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* Breadcrumb simple */
export function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-sf-muted mb-6 font-mono">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} />}
          <span className={i === items.length - 1 ? 'text-sf-cream font-medium' : ''}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  )
}
