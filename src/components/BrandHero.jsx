import { Building2 } from 'lucide-react'
import { useOrg } from '../context/OrgContext'

const LOCAL_LOGOS = {
  matchpoint: '/logos/MATCH POINT FILMS_LOGO.png',
  amateur:    '/logos/amateur.svg',
  scopio:     '/logos/SCOPIO_LOGO.png',
  casagori:   '/logos/CASA GORI_LOGO.png',
}

export default function BrandHero({ subtitle, rightSlot }) {
  const { activeOrg } = useOrg()
  if (!activeOrg) return null

  const logoSrc = activeOrg.logo_url || LOCAL_LOGOS[activeOrg.slug]
  const primary = activeOrg.primary_color || '#1a1a1a'

  // Calcular color de texto según fondo
  const textOnPrimary = getContrast(primary)

  return (
    <div
      className="rounded-xl overflow-hidden mb-6 border border-gray-200"
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${shade(primary, -15)} 100%)`,
      }}
    >
      <div className="flex items-center justify-between gap-4 px-6 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-5 min-w-0">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/90 shadow-sm"
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={activeOrg.name}
                className="w-12 h-12 md:w-14 md:h-14 object-contain"
              />
            ) : (
              <Building2 size={32} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0" style={{ color: textOnPrimary }}>
            <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">
              Productora
            </div>
            <h1 className="text-2xl md:text-3xl font-bold truncate">{activeOrg.name}</h1>
            {subtitle && <p className="text-sm opacity-80 mt-1">{subtitle}</p>}
          </div>
        </div>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}

// Utilidades de color
function getContrast(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#1a1a1a' : '#ffffff'
}

function shade(hex, percent) {
  const c = hex.replace('#', '')
  const num = parseInt(c, 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, Math.min(255, (num >> 16) + amt))
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt))
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt))
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
}
