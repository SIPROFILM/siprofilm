import { useState, useEffect } from 'react'
import { PageHeader } from '../components/Layout'
import { Settings2, MessageSquare, Send, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff, Palette } from 'lucide-react'
import { getSlackSettings, updateSlackSetting, sendDailySummary } from '../lib/slack'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'

export default function Settings() {
  const [slackSettings, setSlackSettings] = useState({
    slack_webhook_url: '',
    slack_notifications_enabled: 'false',
    slack_daily_summary_enabled: 'false',
    slack_daily_summary_time: '09:00',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showWebhook, setShowWebhook] = useState(false)
  const [testBtnHover, setTestBtnHover] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const settings = await getSlackSettings()
      setSlackSettings(prev => ({ ...prev, ...settings }))
    } catch (err) {
      console.error('Error loading settings:', err)
    }
    setLoading(false)
  }

  async function handleSave(key, value) {
    setSaving(true)
    try {
      await updateSlackSetting(key, value)
      setSlackSettings(prev => ({ ...prev, [key]: value }))
    } catch (err) {
      console.error('Error saving setting:', err)
    }
    setSaving(false)
  }

  async function handleTestSummary() {
    setTestResult('sending')
    try {
      const result = await sendDailySummary()
      setTestResult(result.success ? 'success' : 'error')
    } catch {
      setTestResult('error')
    }
    setTimeout(() => setTestResult(null), 4000)
  }

  const isEnabled = slackSettings.slack_notifications_enabled === 'true'
  const hasSummary = slackSettings.slack_daily_summary_enabled === 'true'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <PageHeader
        title="Configuración"
        subtitle="Ajustes generales de SIPROFILM"
      />

      {/* ====== Branding ====== */}
      <BrandingSection />

      {/* ====== Slack Integration ====== */}
      <div
        className="rounded-lg overflow-hidden mb-6"
        style={{ background: '#1c1a1b', border: '1px solid rgba(199,191,239,0.08)' }}
      >
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}
        >
          <div className="w-8 h-8 bg-[#4A154B] rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-display text-sf-cream">Slack</h2>
            <p className="text-xs font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Alertas y resúmenes en tu canal de Slack</p>
          </div>
          {/* Toggle global */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{isEnabled ? 'Activo' : 'Inactivo'}</span>
            <div
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer
                         ${isEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
              onClick={() => handleSave('slack_notifications_enabled', isEnabled ? 'false' : 'true')}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                              ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
          </label>
        </div>

        <div className="p-6 space-y-6">
          {/* Webhook URL */}
          <div>
            <label className="text-xs font-medium font-mono block mb-2" style={{ color: 'rgba(240,231,228,0.6)' }}>
              Webhook URL
            </label>
            <p className="text-[10px] font-mono mb-2" style={{ color: 'rgba(240,231,228,0.4)' }}>
              Crea un Incoming Webhook en tu workspace de Slack y pega la URL aquí.{' '}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline inline-flex items-center gap-0.5"
                style={{ color: '#4B52EB' }}
              >
                Ver instrucciones <ExternalLink size={9} />
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showWebhook ? 'text' : 'password'}
                  value={slackSettings.slack_webhook_url || ''}
                  onChange={e => setSlackSettings(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full rounded-md px-3 py-2 text-sm font-mono pr-10 focus:outline-none focus:ring-1 focus:ring-sf-blue"
                  style={{ background: '#141213', border: '1px solid rgba(199,191,239,0.1)', color: '#F0E7E4' }}
                />
                <button
                  onClick={() => setShowWebhook(!showWebhook)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(240,231,228,0.4)' }}
                >
                  {showWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => handleSave('slack_webhook_url', slackSettings.slack_webhook_url)}
                disabled={saving}
                className="px-4 py-2 text-white text-xs rounded-md transition-colors font-medium font-mono disabled:opacity-50"
                style={{ background: '#F92D97' }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Notification types */}
          <div>
            <label className="text-xs font-medium font-mono block mb-3" style={{ color: 'rgba(240,231,228,0.6)' }}>
              Notificaciones
            </label>
            <div className="space-y-3">
              {/* Status change alerts */}
              <div
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: 'rgba(199,191,239,0.04)' }}
              >
                <div>
                  <span className="text-sm font-mono text-sf-cream">Cambios de estado</span>
                  <p className="text-[10px] font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Aviso cuando una actividad cambia de estado</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-600'}`} />
              </div>

              {/* Blocked alerts */}
              <div
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: 'rgba(199,191,239,0.04)' }}
              >
                <div>
                  <span className="text-sm font-mono text-sf-cream">Actividades bloqueadas</span>
                  <p className="text-[10px] font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Alerta inmediata cuando algo se bloquea</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-600'}`} />
              </div>

              {/* Daily summary */}
              <div
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: 'rgba(199,191,239,0.04)' }}
              >
                <div className="flex-1">
                  <span className="text-sm font-mono text-sf-cream">Resumen diario</span>
                  <p className="text-[10px] font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>
                    Resumen automático con el status de todos los proyectos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={slackSettings.slack_daily_summary_time}
                    onChange={e => handleSave('slack_daily_summary_time', e.target.value)}
                    className="text-xs font-mono rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sf-blue"
                    style={{ background: '#141213', border: '1px solid rgba(199,191,239,0.1)', color: '#F0E7E4' }}
                  >
                    <option value="08:00">8:00 AM</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="18:00">6:00 PM</option>
                  </select>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer
                               ${hasSummary ? 'bg-green-500' : 'bg-gray-600'}`}
                    onClick={() => handleSave('slack_daily_summary_enabled', hasSummary ? 'false' : 'true')}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                                    ${hasSummary ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Test button */}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(199,191,239,0.08)' }}>
            <button
              onClick={handleTestSummary}
              disabled={!slackSettings.slack_webhook_url || testResult === 'sending'}
              onMouseEnter={() => setTestBtnHover(true)}
              onMouseLeave={() => setTestBtnHover(false)}
              className="flex items-center gap-2 text-sm font-mono rounded-md px-4 py-2 transition-colors disabled:opacity-40"
              style={{
                color: 'rgba(240,231,228,0.6)',
                border: '1px solid rgba(199,191,239,0.08)',
                background: testBtnHover ? 'rgba(199,191,239,0.04)' : 'transparent',
              }}
            >
              {testResult === 'sending' ? (
                <>Enviando...</>
              ) : testResult === 'success' ? (
                <><CheckCircle2 size={14} style={{ color: '#D0ED40' }} /> Enviado</>
              ) : testResult === 'error' ? (
                <><AlertCircle size={14} style={{ color: '#F92D97' }} /> Error — verifica la URL</>
              ) : (
                <><Send size={14} /> Enviar resumen de prueba</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Setup */}
      <div
        className="rounded-lg p-5"
        style={{ background: 'rgba(75,82,235,0.1)', border: '1px solid rgba(75,82,235,0.2)' }}
      >
        <h3 className="text-sm font-semibold font-display mb-2" style={{ color: '#4B52EB' }}>Setup inicial</h3>
        <ol className="text-xs font-mono space-y-1.5 list-decimal list-inside" style={{ color: 'rgba(240,231,228,0.6)' }}>
          <li>Corre el SQL <code className="px-1 rounded" style={{ background: 'rgba(75,82,235,0.15)' }}>sql/003_slack_settings.sql</code> en Supabase</li>
          <li>Despliega la Edge Function: <code className="px-1 rounded" style={{ background: 'rgba(75,82,235,0.15)' }}>supabase functions deploy slack-notify</code></li>
          <li>Crea un Incoming Webhook en Slack y pega la URL arriba</li>
          <li>Activa las notificaciones con el toggle</li>
        </ol>
      </div>
    </div>
  )
}

/* ====== Branding Section ====== */
function BrandingSection() {
  const { activeOrg } = useOrg()
  const [logoUrl, setLogoUrl] = useState('')
  const [color, setColor] = useState('#1a1a1a')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (activeOrg) {
      setLogoUrl(activeOrg.logo_url || '')
      setColor(activeOrg.primary_color || '#1a1a1a')
    }
  }, [activeOrg?.id])

  async function handleSave() {
    if (!activeOrg) return
    setSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({ logo_url: logoUrl || null, primary_color: color || null })
      .eq('id', activeOrg.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      setTimeout(() => window.location.reload(), 600)
    }
  }

  if (!activeOrg) return null

  return (
    <div
      className="rounded-lg overflow-hidden mb-6"
      style={{ background: '#1c1a1b', border: '1px solid rgba(199,191,239,0.08)' }}
    >
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color }}>
          <Palette size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold font-display text-sf-cream">Branding de {activeOrg.name}</h2>
          <p className="text-xs font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Logo y color principal del dashboard</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Preview */}
        <div
          className="rounded-lg p-5 flex items-center gap-4"
          style={{ background: color }}
        >
          <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
            ) : (
              <span className="text-xs text-white/60 font-mono">Logo</span>
            )}
          </div>
          <div className="text-white">
            <div className="text-xs opacity-70 uppercase tracking-wider font-mono">Vista previa</div>
            <div className="text-lg font-bold font-display">{activeOrg.name}</div>
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label className="text-xs font-medium font-mono block mb-2" style={{ color: 'rgba(240,231,228,0.6)' }}>Logo (URL pública)</label>
          <input
            type="url"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://...o ruta local tipo /logos/mi-logo.png"
            className="w-full rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sf-blue"
            style={{ background: '#141213', border: '1px solid rgba(199,191,239,0.1)', color: '#F0E7E4' }}
          />
          <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(240,231,228,0.4)' }}>
            Puedes dejarlo vacío si tu slug ya tiene un logo local ({activeOrg.slug}).
          </p>
        </div>

        {/* Color */}
        <div>
          <label className="text-xs font-medium font-mono block mb-2" style={{ color: 'rgba(240,231,228,0.6)' }}>Color principal</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer"
              style={{ background: '#141213', border: '1px solid rgba(199,191,239,0.1)' }}
            />
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="flex-1 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sf-blue"
              style={{ background: '#141213', border: '1px solid rgba(199,191,239,0.1)', color: '#F0E7E4' }}
              placeholder="#1a1a1a"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-white text-sm rounded-md transition-colors font-medium font-mono disabled:opacity-50"
            style={{ background: '#F92D97' }}
          >
            {saving ? 'Guardando…' : 'Guardar branding'}
          </button>
          {saved && (
            <span className="text-xs font-mono flex items-center gap-1" style={{ color: '#D0ED40' }}>
              <CheckCircle2 size={12} /> Guardado
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
