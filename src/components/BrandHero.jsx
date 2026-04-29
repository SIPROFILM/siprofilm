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

  return (
    <div
      className="rounded-xl overflow-hidden mb-6 relative"
      style={{
        background: 'linear-gradient(135deg, rgba(75,82,235,0.08) 0%, rgba(249,45,151,0.05) 100%)',
        border: '1px solid rgba(199,191,239,0.08)',
      }}
    >
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(249,45,151,0.08) 0%, transparent 70%)' }} />

      <div className="px-5 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 relative">
        {/* Top row: logo + name + buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.1)' }}>
            {logoSrc ? (
              <img src={logoSrc} alt={activeOrg.name} className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain" />
            ) : (
              <Building2 size={28} style={{ color: 'rgba(240,231,228,0.25)' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] font-medium uppercase tracking-[2px] text-sf-lavender opacity-70 mb-0.5">
              Productora
            </div>
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-sf-cream truncate">{activeOrg.name}</h1>
            {subtitle && <p className="text-[11px] sm:text-xs md:text-sm mt-0.5" style={{ color: 'rgba(240,231,228,0.4)' }}>{subtitle}</p>}
          </div>
          {rightSlot && <div className="flex-shrink-0 hidden sm:block">{rightSlot}</div>}
        </div>
        {/* Mobile: buttons below */}
        {rightSlot && (
          <div className="sm:hidden mt-3 flex items-center gap-2">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  )
}
