import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader, Breadcrumb } from '../components/Layout'
import { nextWorkday } from '../lib/utils'
import { format } from 'date-fns'

const MODALITIES = ['Lunes a Viernes', 'Lunes a Sábado', 'Flexible']

const STAGES = [
  { value: 'incubadora',     label: 'Incubadora' },
  { value: 'desarrollo',     label: 'Desarrollo' },
  { value: 'preproduccion',  label: 'Preproducción' },
  { value: 'produccion',     label: 'Producción' },
  { value: 'postproduccion', label: 'Postproducción' },
  { value: 'distribucion',   label: 'Distribución' },
]

export default function NewProgram() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name:          '',
    start_date:    format(nextWorkday(new Date()), 'yyyy-MM-dd'),
    work_modality: 'Lunes a Viernes',
    stage:         'incubadora',
    notes:         '',
    slack_webhook_url: '',
  })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre del programa es obligatorio.')
    if (!form.start_date)  return setError('La fecha de inicio es obligatoria.')

    setSaving(true)
    const { data, error: err } = await supabase
      .from('programs')
      .insert([{ ...form, name: form.name.trim() }])
      .select()
      .single()

    if (err) {
      if (err.code === '23505') setError('Ya existe un programa con ese nombre.')
      else setError('Error al guardar. Intentá de nuevo.')
      setSaving(false)
      return
    }

    navigate(`/programas/${data.id}`)
  }

  return (
    <div className="p-8 max-w-2xl">
      <Breadcrumb items={['Programas', 'Nuevo programa']} />
      <PageHeader
        title="Nuevo programa"
        subtitle="Completá los datos base. Después podés agregar actividades."
      />

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">

        <Field label="Nombre del programa *">
          <input
            type="text"
            required
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="ej. Documental CDMX 2026"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de inicio *">
            <input
              type="date"
              required
              value={form.start_date}
              onChange={e => update('start_date', e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Modalidad de trabajo">
            <select
              value={form.work_modality}
              onChange={e => update('work_modality', e.target.value)}
              className={inputCls}
            >
              {MODALITIES.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Etapa actual *" hint="¿En qué etapa de producción entra este programa?">
          <select
            value={form.stage}
            onChange={e => update('stage', e.target.value)}
            className={inputCls}
          >
            {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>

        <Field label="Notas iniciales" hint="Contexto del proyecto, cliente, referencias, etc.">
          <textarea
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={3}
            className={inputCls + ' resize-none'}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Slack Webhook URL" hint="Para notificaciones automáticas de este programa. Podés configurarlo después.">
          <input
            type="url"
            value={form.slack_webhook_url}
            onChange={e => update('slack_webhook_url', e.target.value)}
            className={inputCls}
            placeholder="https://hooks.slack.com/services/..."
          />
        </Field>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#1a1a1a] text-white text-sm font-medium px-6 py-2.5 rounded-md
                       hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear programa'}
          </button>
          <Link
            to="/programas"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = `w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm
  focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:border-transparent
  placeholder-gray-300 bg-white`
