import { useState } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'
import { useOrg } from '../context/OrgContext'

const ORG_LOGOS = {
  matchpoint: '/logos/MATCH POINT FILMS_LOGO.png',
  amateur:    '/logos/amateur.svg',
  scopio:     '/logos/SCOPIO_LOGO.png',
  casagori:   '/logos/CASA GORI_LOGO.png',
}

function OrgLogo({ org, size = 20 }) {
  const src = ORG_LOGOS[org?.slug]
  if (src) {
    return (
      <img
        src={src}
        alt={org.name}
        className="flex-shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  return <Building2 size={size * 0.65} className="flex-shrink-0" style={{ color: 'rgba(240,231,228,0.25)' }} />
}

export default function OrgSwitcher({ onSwitch }) {
  const { orgs, activeOrg, switchOrg, loading } = useOrg()
  const [open, setOpen] = useState(false)

  if (loading || !activeOrg) return null

  if (orgs.length <= 1) {
    return (
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
        <div className="flex items-center gap-3 p-2 rounded-lg"
             style={{ background: 'rgba(199,191,239,0.04)', border: '1px solid rgba(199,191,239,0.07)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.1)' }}>
            <OrgLogo org={activeOrg} size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-sf-cream truncate block">{activeOrg.name}</span>
            <span className="font-mono text-[9px] tracking-wide" style={{ color: 'rgba(240,231,228,0.25)' }}>CEO</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative px-4 py-3" style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full text-left p-2 rounded-lg transition-colors"
        style={{ background: 'rgba(199,191,239,0.04)', border: '1px solid rgba(199,191,239,0.07)' }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.1)' }}>
          <OrgLogo org={activeOrg} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-sf-cream truncate block">{activeOrg.name}</span>
          <span className="font-mono text-[9px] tracking-wide" style={{ color: 'rgba(240,231,228,0.25)' }}>CEO</span>
        </div>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`}
                     style={{ color: 'rgba(199,191,239,0.3)' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 bg-sf-surface rounded-lg shadow-xl z-20 py-1 overflow-hidden"
               style={{ border: '1px solid rgba(199,191,239,0.1)' }}>
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => { switchOrg(org.id); setOpen(false); onSwitch?.() }}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-3
                  ${org.id === activeOrg.id ? 'text-sf-cream font-medium' : 'text-sf-muted hover:text-sf-cream'}`}
                style={org.id === activeOrg.id ? { background: 'rgba(249,45,151,0.06)' } : {}}
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(199,191,239,0.06)', border: '1px solid rgba(199,191,239,0.08)' }}>
                  <OrgLogo org={org} size={18} />
                </div>
                {org.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
