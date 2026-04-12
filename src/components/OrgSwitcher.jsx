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
  return <Building2 size={size * 0.65} className="text-white/40 flex-shrink-0" />
}

export default function OrgSwitcher() {
  const { orgs, activeOrg, switchOrg, loading } = useOrg()
  const [open, setOpen] = useState(false)

  if (loading || !activeOrg) return null

  if (orgs.length <= 1) {
    return (
      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <OrgLogo org={activeOrg} size={24} />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider truncate">
            {activeOrg.name}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative px-5 py-3 border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full text-left hover:bg-white/5 rounded-md p-1 -m-1 transition-colors"
      >
        <OrgLogo org={activeOrg} size={24} />
        <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider truncate flex-1">
          {activeOrg.name}
        </span>
        <ChevronDown size={11} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl z-20 py-1">
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-3 ${
                  org.id === activeOrg.id
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <OrgLogo org={org} size={20} />
                {org.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
