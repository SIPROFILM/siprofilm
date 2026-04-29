import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError('Email o contraseña incorrectos.')
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sf-bg flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             background: `
               radial-gradient(ellipse 60% 50% at 50% 30%, rgba(249,45,151,0.06) 0%, transparent 60%),
               radial-gradient(ellipse 50% 40% at 30% 80%, rgba(75,82,235,0.05) 0%, transparent 60%)
             `
           }} />

      <div className="w-full max-w-sm relative z-10 px-4">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-3 h-3 rounded-full bg-sf-pink dot-pulse mx-auto mb-5" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-sf-cream">
            SIPRO<span className="text-sf-pink">FILM</span>
          </h1>
          <p className="font-mono text-[10px] tracking-[3px] mt-2 uppercase"
             style={{ color: 'rgba(240,231,228,0.3)' }}>
            Sistema de Producción
          </p>
        </div>

        {/* Card */}
        <div className="bg-sf-surface rounded-xl p-8"
             style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <h2 className="font-mono text-xs font-medium tracking-[2px] uppercase mb-6"
              style={{ color: 'rgba(240,231,228,0.4)' }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] font-medium uppercase tracking-[1.5px] mb-1.5"
                     style={{ color: 'rgba(240,231,228,0.3)' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm font-mono"
                style={{
                  background: '#141213',
                  border: '1px solid rgba(199,191,239,0.1)',
                  color: '#F0E7E4',
                }}
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-medium uppercase tracking-[1.5px] mb-1.5"
                     style={{ color: 'rgba(240,231,228,0.3)' }}>
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm font-mono"
                style={{
                  background: '#141213',
                  border: '1px solid rgba(199,191,239,0.1)',
                  color: '#F0E7E4',
                }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs font-mono rounded-lg px-3 py-2"
                 style={{ color: '#F92D97', background: 'rgba(249,45,151,0.08)', border: '1px solid rgba(249,45,151,0.15)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-sm font-medium py-2.5 rounded-lg font-mono tracking-wide mt-2
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#F92D97',
                color: 'white',
                border: '1px solid rgba(249,45,151,0.5)',
              }}
            >
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center font-mono text-[10px] mt-6 tracking-[2px]"
           style={{ color: 'rgba(240,231,228,0.2)' }}>
          CAPRO · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
