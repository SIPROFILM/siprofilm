import { useState } from 'react'
import { Mail, MapPin, Send, CheckCircle } from 'lucide-react'

export default function Contacto() {
  const [sent, setSent] = useState(false)

  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    const form = e.target
    const data = new FormData(form)
    try {
      await fetch('https://formspree.io/f/mojyaagl', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      setSent(true)
      form.reset()
    } catch (err) {
      alert('Error al enviar. Intenta de nuevo.')
    }
    setSending(false)
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-black text-white pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-capro-red font-medium mb-4">Contacto</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-wider">
            Habl<span className="font-bold">emos</span>
          </h1>
          <p className="text-white/40 mt-6 max-w-xl text-lg">
            Cu&eacute;ntanos sobre tu empresa. Queremos entender tu proceso
            para encontrar c&oacute;mo potencializar tu negocio.
          </p>
        </div>
      </section>

      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="h-px bg-gradient-to-r from-transparent via-capro-red/30 to-transparent mb-24" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact info */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Informaci&oacute;n de contacto</h2>
              <div className="space-y-6">
                <a
                  href="mailto:ceo@caproconsultores.com"
                  className="flex items-center gap-4 p-4 rounded-lg bg-capro-surface hover:bg-white/[0.04] transition-colors group"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-capro-red/10 flex items-center justify-center
                                  group-hover:bg-capro-red transition-colors flex-shrink-0">
                    <Mail size={18} className="text-capro-red group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-white/20 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-bold text-white">ceo@caproconsultores.com</p>
                  </div>
                </a>
                <div
                  className="flex items-center gap-4 p-4 rounded-lg bg-capro-surface"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-capro-red/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-capro-red" />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-white/20 uppercase tracking-wider">Ubicaci&oacute;n</p>
                    <p className="text-sm font-bold text-white">Ciudad de M&eacute;xico, MX</p>
                  </div>
                </div>
              </div>

              {/* SIPROFILM access */}
              <div className="mt-12 p-6 bg-capro-surface rounded-xl" style={{ border: '1px solid rgba(190,30,45,0.15)' }}>
                <p className="text-sm text-white/30 mb-2">&iquest;Ya trabajas con nosotros?</p>
                <p className="font-bold text-white mb-4">Accede a tu plataforma SIPROFILM</p>
                <a
                  href="https://siprofilm.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-capro-red text-white px-6 py-3 rounded
                             hover:bg-red-700 transition-colors text-sm tracking-wider uppercase font-bold"
                >
                  Entrar a SIPROFILM
                </a>
              </div>
            </div>

            {/* Contact form */}
            <div>
              {sent ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-capro-surface rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <CheckCircle size={48} className="text-capro-red mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Mensaje enviado</h3>
                  <p className="text-white/30 text-sm">
                    Gracias por tu inter&eacute;s. Te responderemos en menos de 24 horas.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-6 text-sm text-capro-red hover:text-red-400 font-bold"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block font-mono text-xs text-white/20 uppercase tracking-wider font-medium mb-2">
                        Nombre
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        required
                        className="w-full px-4 py-3 bg-capro-surface rounded-lg text-sm text-white
                                   placeholder-white/20 focus:outline-none transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                        onFocus={e => e.target.style.borderColor = '#BE1E2D'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-white/20 uppercase tracking-wider font-medium mb-2">
                        Empresa
                      </label>
                      <input
                        type="text"
                        name="empresa"
                        className="w-full px-4 py-3 bg-capro-surface rounded-lg text-sm text-white
                                   placeholder-white/20 focus:outline-none transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                        onFocus={e => e.target.style.borderColor = '#BE1E2D'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        placeholder="Nombre de tu empresa"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-white/20 uppercase tracking-wider font-medium mb-2">
                      &iquest;En qu&eacute; podemos ayudarte?
                    </label>
                    <textarea
                      name="mensaje"
                      required
                      rows={5}
                      className="w-full px-4 py-3 bg-capro-surface rounded-lg text-sm text-white resize-none
                                 placeholder-white/20 focus:outline-none transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      onFocus={e => e.target.style.borderColor = '#BE1E2D'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      placeholder="Cuéntanos sobre tu empresa, tu industria y qué retos enfrentas..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 bg-capro-red text-white
                               py-4 rounded-lg hover:bg-red-700 transition-colors text-sm
                               tracking-wider uppercase font-bold disabled:opacity-50"
                  >
                    <Send size={16} />
                    {sending ? 'Enviando...' : 'Enviar mensaje'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
