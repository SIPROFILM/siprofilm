import { ArrowRight } from 'lucide-react'

const CLIENTS = [
  { name: 'Matchpoint Films', logo: '/logos/MATCH POINT FILMS_LOGO.png', url: 'https://www.matchpointfilms.mx/' },
  { name: 'AMATEUR Films',    logo: '/logos/amateur.svg',                url: 'https://filmadora.mx/' },
  { name: 'Scopio',           logo: '/logos/SCOPIO_LOGO.png',            url: 'https://www.scopiofilms.com/' },
  { name: 'Casa Gori',        logo: '/logos/CASA GORI_LOGO.png',        url: 'https://www.casagori.mx/' },
]

export default function Clientes() {
  return (
    <>
      {/* Hero */}
      <section className="bg-black text-white pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-capro-red font-medium mb-4">
            Clientes
          </p>
          <h1 className="text-4xl md:text-6xl font-light tracking-wider">
            Empresas que <span className="font-bold">conf&iacute;an en nosotros</span>
          </h1>
          <p className="text-white/40 mt-6 max-w-xl text-lg">
            Trabajamos con empresas de distintos sectores para desarrollar
            sistemas de informaci&oacute;n que transforman su operaci&oacute;n.
          </p>
        </div>
      </section>

      {/* Logo grid */}
      <section className="py-20 bg-black">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <p className="text-center font-mono text-xs tracking-[0.3em] uppercase text-white/20 mb-12">
            Sector: Producci&oacute;n audiovisual
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {CLIENTS.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square flex items-center justify-center p-4
                           opacity-60 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
              >
                <img src={c.logo} alt={c.name} className="w-full h-full object-contain" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Próximos sectores */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-capro-red/30 to-transparent mb-20" />
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/20 mb-3">Pr&oacute;ximamente</p>
          <h2 className="text-2xl md:text-3xl font-light tracking-wider text-white mb-4">
            Nuevos <span className="font-bold">sectores</span>
          </h2>
          <p className="text-white/30 max-w-lg mx-auto mb-10">
            Nuestra metodolog&iacute;a es aplicable a cualquier industria que necesite
            sistematizar sus procesos operativos y financieros.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Construcción', 'Hospitalidad', 'Manufactura', 'Eventos'].map(s => (
              <span
                key={s}
                className="px-5 py-2.5 rounded-full text-sm text-white/30"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-black">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-capro-red/30 to-transparent mb-16" />
          <p className="text-white/30 mb-4">
            &iquest;Tu industria necesita un sistema como este?
          </p>
          <a
            href="/contacto"
            className="inline-flex items-center gap-2 text-sm text-capro-red hover:text-red-400
                       tracking-wider uppercase font-bold transition-colors"
          >
            Hablemos <ArrowRight size={14} />
          </a>
        </div>
      </section>
    </>
  )
}
