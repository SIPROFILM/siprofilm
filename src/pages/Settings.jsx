import { useState, useEffect } from 'react'
import { PageHeader } from '../components/Layout'
import { Settings2, MessageSquare, Send, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { getSlackSettings, updateSlackSetting, sendDailySummary } from '../lib/slack'

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

      {/* ====== Slack Integration ====== */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4A154B] rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Slack</h2>
            <p className="text-xs text-gray-400">Alertas y resúmenes en tu canal de Slack</p>
          </div>
          {/* Toggle global */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-500">{isEnabled ? 'Activo' : 'Inactivo'}</span>
            <div
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer
                         ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
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
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Webhook URL
            </label>
            <p className="text-[10px] text-gray-400 mb-2">
              Crea un Incoming Webhook en tu workspace de Slack y pega la URL aquí.{' '}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
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
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm pr-10
                             focus:outline-none focus:border-gray-400 placeholder-gray-300"
                />
                <button
                  onClick={() => setShowWebhook(!showWebhook)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => handleSave('slack_webhook_url', slackSettings.slack_webhook_url)}
                disabled={saving}
                className="px-4 py-2 bg-[#1a1a1a] text-white text-xs rounded-md hover:bg-gray-800
                           transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Notification types */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-3">
              Notificaciones
            </label>
            <div className="space-y-3">
              {/* Status change alerts */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-700">Cambios de estado</span>
                  <p className="text-[10px] text-gray-400">Aviso cuando una actividad cambia de estado</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>

              {/* Blocked alerts */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-700">Actividades bloqueadas</span>
                  <p className="text-[10px] text-gray-400">Alerta inmediata cuando algo se bloquea</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>

              {/* Daily summary */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <span className="text-sm text-gray-700">Resumen diario</span>
                  <p className="text-[10px] text-gray-400">
                    Resumen automático con el status de todos los proyectos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={slackSettings.slack_daily_summary_time}
                    onChange={e => handleSave('slack_daily_summary_time', e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    <option value="08:00">8:00 AM</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="18:00">6:00 PM</option>
                  </select>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer
                               ${hasSummary ? 'bg-green-500' : 'bg-gray-300'}`}
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
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleTestSummary}
              disabled={!slackSettings.slack_webhook_url || testResult === 'sending'}
              className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-md
                         px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              {testResult === 'sending' ? (
                <>Enviando...</>
              ) : testResult === 'success' ? (
                <><CheckCircle2 size={14} className="text-green-500" /> Enviado</>
              ) : testResult === 'error' ? (
                <><AlertCircle size={14} className="text-red-500" /> Error — verifica la URL</>
              ) : (
                <><Send size={14} /> Enviar resumen de prueba</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ====== Setup instructions ====== */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">Setup inicial</h3>
        <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
          <li>Corre el SQL <code className="bg-amber-100 px-1 rounded">sql/003_slack_settings.sql</code> en Supabase</li>
          <li>Despliega la Edge Function: <code className="bg-amber-100 px-1 rounded">supabase functions deploy slack-notify</code></li>
          <li>Crea un Incoming Webhook en Slack y pega la URL arriba</li>
          <li>Activa las notificaciones con el toggle</li>
        </ol>
      </div>
    </div>
  )
}
