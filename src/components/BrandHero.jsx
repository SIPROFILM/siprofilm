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

      <div className="flex items-center justify-between gap-4 px-6 py-5 md:px-8 md:py-6 relative">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.1)' }}>
            {logoSrc ? (
              <img src={logoSrc} alt={activeOrg.name} className="w-10 h-10 md:w-12 md:h-12 object-contain" />
            ) : (
              <Building2 size={28} style={{ color: 'rgba(240,231,228,0.25)' }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] font-medium uppercase tracking-[2px] text-sf-lavender opacity-70 mb-1">
              Productora
            </div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-sf-cream truncate">{activeOrg.name}</h1>
            {subtitle && <p className="text-xs sm:text-sm mt-1" style={{ color: 'rgba(240,231,228,0.4)' }}>{subtitle}</p>}
          </div>
        </div>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
