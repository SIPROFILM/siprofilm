import { useState, useEffect } from 'react'
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
  { value: 'distribucion',   label: 'Distribución / Exhibición' },
]

const PROJECT_FORMATS = [
  { value: 'serie',    label: 'Serie' },
  { value: 'pelicula', label: 'Película' },
]
const PROJECT_GENRES = [
  { value: 'ficcion',    label: 'Ficción' },
  { value: 'documental', label: 'Documental' },
]
const PROJECT_TYPES = ['Película', 'Serie', 'Por definir']
const CONTENT_TYPES = ['Ficción', 'Documental']
const DEV_PROCESSES = [
  'No aplica (no es proyecto en desarrollo)',
  'Investigación', 'Desarrollo narrativo', 'Escritura',
  'Desarrollo conceptual', 'Diseño de proyecto', 'Estrategia de venta',
]
const MATERIALS_OPTIONS = [
  'Idea escrita', 'Investigación', 'Tratamiento', 'Biblia',
  'Guion (primer draft)', 'Guion (avanzado)', 'Pitch deck', 'Teaser',
]
const DISTRIBUTION_CHANNELS = ['Plataforma', 'EFICINE', 'Independiente', 'Canal TV', 'Otro']

export default function NewProgram() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name:              '',
    start_date:        format(nextWorkday(new Date()), 'yyyy-MM-dd'),
    work_modality:     'Lunes a Viernes',
    stage:             'incubadora',
    // Ficha del proyecto
    project_type:      '',
    content_type:      '',
    logline:           '',
    synopsis:          '',
    writers:           '',
    genre:             '',
    producer:          '',
    dev_process:       '',
    existing_materials:'',
    whats_needed:      '',
    estimated_cost:    '',
    has_investment:    '',
    confirmed_talent:  '',
    distribution_channel: '',
    target_end_date:   '',
    commercial_potential:      '',
    cinematographic_potential: '',
    treatment_status:  '',
    script_notes:      '',
    notes:             '',
    slack_webhook_url: '',
    // Categoría de costo
    project_format:    '',
    project_genre:     '',
    cost_category_id:  '',
    actual_cost:       '',
  })
  const [materials, setMaterials] = useState([])
  const [costCategories, setCostCategories] = useState([])
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [showFicha, setShowFicha] = useState(true)

  useEffect(() => {
    supabase.from('cost_categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCostCategories(data)
    })
  }, [])

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function toggleMaterial(mat) {
    setMaterials(prev => {
      const next = prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
      setForm(f => ({ ...f, existing_materials: next.join(', ') }))
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre del programa es obligatorio.')
    if (!form.start_date)  return setError('La fecha de inicio es obligatoria.')

    setSaving(true)

    // Clean empty strings to null
    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      payload[k] = typeof v === 'string' && v.trim() === '' ? null : v
    }
    payload.name = form.name.trim()

    const { data, error: err } = await supabase
      .from('programs')
      .insert([payload])
      .select()
      .single()

    if (err) {
      if (err.code === '23505') setError('Ya existe un programa con ese nombre.')
      else setError('Error al guardar. Intenta de nuevo.')
      setSaving(false)
      return
    }

    navigate(`/programas/${data.id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumb items={['Programas', 'Nuevo programa']} />
      <PageHeader
        title="Nuevo programa"
        subtitle="Completa los datos del proyecto. Los campos con * son obligatorios."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos básicos */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos básicos</p>

          <Field label="Título del programa *">
            <input
              type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="ej. Amiga Date Cuenta"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo de proyecto">
              <select value={form.project_type} onChange={e => update('project_type', e.target.value)} className={inputCls}>
                <option value="">— seleccionar —</option>
                {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Tipo de contenido">
              <select value={form.content_type} onChange={e => update('content_type', e.target.value)} className={inputCls}>
                <option value="">— seleccionar —</option>
                {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Etapa actual *">
              <select value={form.stage} onChange={e => update('stage', e.target.value)} className={inputCls}>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha de inicio *">
              <input type="date" required value={form.start_date}
                onChange={e => update('start_date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fecha aprox. finalización">
              <input type="date" value={form.target_end_date}
                onChange={e => update('target_end_date', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Modalidad de trabajo">
            <select value={form.work_modality} onChange={e => update('work_modality', e.target.value)} className={inputCls}>
              {MODALITIES.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        {/* Ficha creativa */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFicha(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ficha creativa del proyecto</p>
            <span className="text-xs text-gray-400">{showFicha ? 'Ocultar' : 'Mostrar'}</span>
          </button>

          {showFicha && (
            <div className="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
              <Field label="Logline / Idea" hint="Una línea que resuma el concepto del proyecto">
                <textarea value={form.logline} onChange={e => update('logline', e.target.value)}
                  rows={2} className={inputCls + ' resize-none'}
                  placeholder="Una mujer cansada de estafadores conoce a otra que se dedica a estafar hombres malos..." />
              </Field>

              <Field label="Sinopsis">
                <textarea value={form.synopsis} onChange={e => update('synopsis', e.target.value)}
                  rows={4} className={inputCls + ' resize-none'}
                  placeholder="Sinopsis completa del proyecto..." />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Escritor(a)">
                  <input type="text" value={form.writers} onChange={e => update('writers', e.target.value)}
                    className={inputCls} placeholder="Nombre(s) del escritor(a)" />
                </Field>
                <Field label="Formato / Género">
                  <input type="text" value={form.genre} onChange={e => update('genre', e.target.value)}
                    className={inputCls} placeholder="ej. Película | Comedia - Drama" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Productor responsable">
                  <input type="text" value={form.producer} onChange={e => update('producer', e.target.value)}
                    className={inputCls} placeholder="Nombre del productor" />
                </Field>
                <Field label="Talento confirmado">
                  <input type="text" value={form.confirmed_talent} onChange={e => update('confirmed_talent', e.target.value)}
                    className={inputCls} placeholder="Actores, directores confirmados..." />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Potencial comercial">
                  <input type="text" value={form.commercial_potential} onChange={e => update('commercial_potential', e.target.value)}
                    className={inputCls} placeholder="ej. Alto, Medio - Alto" />
                </Field>
                <Field label="Potencial cinematográfico">
                  <input type="text" value={form.cinematographic_potential} onChange={e => update('cinematographic_potential', e.target.value)}
                    className={inputCls} placeholder="ej. Alto, Medio" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Estado del tratamiento">
                  <input type="text" value={form.treatment_status} onChange={e => update('treatment_status', e.target.value)}
                    className={inputCls} placeholder="ej. 4, Pitch, Biblia" />
                </Field>
                <Field label="Proceso de desarrollo">
                  <select value={form.dev_process} onChange={e => update('dev_process', e.target.value)} className={inputCls}>
                    <option value="">— seleccionar —</option>
                    {DEV_PROCESSES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Materiales existentes" hint="Selecciona todos los que apliquen">
                <div className="flex flex-wrap gap-2 mt-1">
                  {MATERIALS_OPTIONS.map(mat => (
                    <button
                      key={mat} type="button"
                      onClick={() => toggleMaterial(mat)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        materials.includes(mat)
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Notas de guión">
                <textarea value={form.script_notes} onChange={e => update('script_notes', e.target.value)}
                  rows={3} className={inputCls + ' resize-none'}
                  placeholder="Observaciones sobre el estado actual del guión..." />
              </Field>
            </div>
          )}
        </div>

        {/* Datos de negocio y presupuesto */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Presupuesto y negocio</p>

          {/* Categoría de costo */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Formato">
              <select value={form.project_format} onChange={e => {
                update('project_format', e.target.value)
                update('cost_category_id', '')
              }} className={inputCls}>
                <option value="">— seleccionar —</option>
                {PROJECT_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Género">
              <select value={form.project_genre} onChange={e => {
                update('project_genre', e.target.value)
                update('cost_category_id', '')
              }} className={inputCls}>
                <option value="">— seleccionar —</option>
                {PROJECT_GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
          </div>

          {form.project_format && form.project_genre && (() => {
            const filtered = costCategories.filter(c =>
              c.format === form.project_format && c.genre === form.project_genre
            )
            if (filtered.length === 0) return null
            const selected = filtered.find(c => String(c.id) === String(form.cost_category_id))
            return (
              <Field label="Categoría de costo" hint="Se asigna un costo estimado según la categoría">
                <div className="flex flex-wrap gap-2 mt-1">
                  {filtered.map(cat => (
                    <button
                      key={cat.id} type="button"
                      onClick={() => {
                        update('cost_category_id', cat.id)
                        if (!form.actual_cost) update('estimated_cost', String(cat.estimated_cost))
                      }}
                      className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                        String(form.cost_category_id) === String(cat.id)
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <span className="font-medium">{cat.category_name}</span>
                      <span className="ml-1.5 opacity-70">
                        ${(cat.estimated_cost / 1000000).toFixed(0)}M
                      </span>
                    </button>
                  ))}
                </div>
                {selected && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Costo estimado de categoría: ${(selected.estimated_cost / 1000000).toFixed(0)}M MXN
                  </p>
                )}
              </Field>
            )
          })()}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Costo real (si se conoce)" hint="Sobreescribe el estimado de categoría">
              <input type="number" value={form.actual_cost} onChange={e => update('actual_cost', e.target.value)}
                className={inputCls} placeholder="ej. 435000000" />
            </Field>
            <Field label="¿Cuenta con inversión previa?">
              <select value={form.has_investment} onChange={e => update('has_investment', e.target.value)} className={inputCls}>
                <option value="">— seleccionar —</option>
                <option>Sí</option>
                <option>No</option>
              </select>
            </Field>
          </div>

          <Field label="Canal de distribución pensado">
            <select value={form.distribution_channel} onChange={e => update('distribution_channel', e.target.value)} className={inputCls}>
              <option value="">— seleccionar —</option>
              {DISTRIBUTION_CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="¿Qué falta para avanzar?">
            <textarea value={form.whats_needed} onChange={e => update('whats_needed', e.target.value)}
              rows={2} className={inputCls + ' resize-none'}
              placeholder="Describe lo que se necesita para que el proyecto avance..." />
          </Field>

          <Field label="Notas adicionales">
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} placeholder="Opcional" />
          </Field>

          <Field label="Slack Webhook URL" hint="Para notificaciones automáticas. Se puede configurar después.">
            <input type="url" value={form.slack_webhook_url}
              onChange={e => update('slack_webhook_url', e.target.value)}
              className={inputCls} placeholder="https://hooks.slack.com/services/..." />
          </Field>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="bg-[#1a1a1a] text-white text-sm font-medium px-6 py-2.5 rounded-md
                       hover:bg-gray-800 transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear programa'}
          </button>
          <Link to="/programas" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
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
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = `w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm
  focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:border-transparent
  placeholder-gray-300 bg-white`
