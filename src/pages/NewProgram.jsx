import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'
import { useStages } from '../hooks/useStages'
import { useProjectTypes } from '../hooks/useProjectTypes'
import { createProjectChannel, notifyProgramCreated } from '../lib/slack'
import { PageHeader, Breadcrumb } from '../components/Layout'
import { fmtMXN, nextWorkday } from '../lib/utils'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'

/* ─── Constantes para perfil Elite ─── */
const GENRES = [
  { value: 'ficcion',    label: 'Ficción' },
  { value: 'documental', label: 'Documental' },
]
const MODALITIES = ['Lunes a Viernes', 'Lunes a Sábado', 'Flexible']
const DEV_PROCESSES = [
  'Investigación', 'Desarrollo narrativo', 'Escritura',
  'Desarrollo conceptual', 'Diseño de proyecto', 'Estrategia de venta',
]
const MATERIALS_OPTIONS = [
  'Idea escrita', 'Investigación', 'Tratamiento', 'Biblia',
  'Guion (primer draft)', 'Guion (avanzado)', 'Pitch deck', 'Teaser',
]
const DISTRIBUTION_CHANNELS = ['Plataforma', 'EFICINE', 'Independiente', 'Canal TV', 'Otro']

/* ─── Componente principal ─── */
export default function NewProgram() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeOrg } = useOrg()
  const { stages: orgStages, stageKeys, stageGte } = useStages()
  const { types: projectTypes } = useProjectTypes()

  const profile = activeOrg?.profile || 'productora'
  const STAGES = orgStages.map(s => ({ value: s.key, label: s.label, color: s.bg }))
  const FORMATS = projectTypes.map(t => ({ value: t.key, label: t.label }))

  const [form, setForm] = useState({
    name:              '',
    stage:             '',
    project_format:    '',
    project_genre:     '',
    cost_category_id:  '',
    estimated_cost:    '',
    actual_cost:       '',
    google_drive_link: '',
    logline:           '',
    status_note:       '',
    client_name:       '',
    notes:             '',
    // Elite/Independiente fields
    producer:          '',
    writers:           '',
    existing_materials:'',
    dev_process:       '',
    distribution_channel: '',
    green_light:       false,
    cost_desarrollo:   '',
    start_date:        format(nextWorkday(new Date()), 'yyyy-MM-dd'),
    target_end_date:   '',
    work_modality:     'Lunes a Viernes',
    confirmed_talent:  '',
    director:          '',
    cost_preproduccion:'',
    cost_produccion:   '',
    cost_postproduccion:'',
    cost_distribucion: '',
  })
  const [materials, setMaterials] = useState([])
  const [costCategories, setCostCategories] = useState([])
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('cost_categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCostCategories(data)
    })
  }, [])

  useEffect(() => {
    if (stageKeys.length > 0 && !form.stage) {
      setForm(f => ({ ...f, stage: stageKeys[0] }))
    }
  }, [stageKeys])

  const stage = form.stage
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
    setSaving(true)

    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === 'string' && v.trim() === '') payload[k] = null
      else if (v === false && k === 'green_light') payload[k] = false
      else payload[k] = v
    }
    payload.name = form.name.trim()
    if (activeOrg?.id) payload.org_id = activeOrg.id
    if (payload.project_format) {
      payload.project_type = payload.project_format
    }

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

    // Add creator as admin to program_members (for access control)
    if (user?.id) {
      const { error: memberErr } = await supabase
        .from('program_members')
        .insert([{
          program_id: data.id,
          user_id: user.id,
          role: 'admin',
        }])

      if (memberErr) {
        console.error('Error adding creator to program_members:', memberErr)
        // Non-blocking: continue even if this fails
      }
    }

    // Create Slack channel for this project (async, non-blocking)
    createProjectChannel(data.name, data.id).then(result => {
      if (result.success && result.data?.channelId) {
        notifyProgramCreated({
          channelId: result.data.channelId,
          programName: data.name,
          orgName: activeOrg?.name || '',
          projectType: data.project_type || data.project_format || '',
          stage: data.stage || '',
        })
      }
    }).catch(() => {}) // Silent fail

    navigate(`/programas/${data.id}`)
  }

  /* ─── Para perfil independiente: determinar si el tipo seleccionado usa formulario elite ─── */
  const eliteTypes = ['serie', 'pelicula']
  const useEliteForm = profile === 'elite' || (profile === 'independiente' && eliteTypes.includes(form.project_format))

  /* ─── Categorías filtradas (solo para elite) ─── */
  const filteredCats = costCategories.filter(c =>
    c.format === form.project_format && c.genre === form.project_genre
  )
  const selectedCat = filteredCats.find(c => String(c.id) === String(form.cost_category_id))

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Breadcrumb items={['Programas', 'Nuevo programa']} />
      <PageHeader
        title="Nuevo programa"
        subtitle={profile === 'productora'
          ? "Registra un nuevo proyecto de producción."
          : "Los campos se adaptan según la etapa del proyecto."}
      />

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ════════════════════════════════════════════
            BLOQUE BASE — Siempre visible
        ════════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del proyecto</p>

          <Field label="Nombre del proyecto *">
            <input type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder={profile === 'productora' ? 'ej. Comercial Santander' : 'ej. Amiga Date Cuenta'}
              className={inputCls} />
          </Field>

          {/* Tipo de proyecto — siempre visible */}
          <Field label="Tipo de proyecto *">
            <div className="flex flex-wrap gap-2 mt-1">
              {FORMATS.map(f => (
                <button
                  key={f.value} type="button"
                  onClick={() => { update('project_format', f.value); update('cost_category_id', '') }}
                  className={`text-xs px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                    form.project_format === f.value
                      ? 'bg-[#1a1a1a] text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Cliente — para productora e independiente (cuando no es serie/película) */}
          {!useEliteForm && (
            <Field label="Cliente">
              <input type="text" value={form.client_name}
                onChange={e => update('client_name', e.target.value)}
                className={inputCls} placeholder="ej. Santander, Nike, Gobierno CDMX" />
            </Field>
          )}

          {/* Etapa — siempre visible */}
          <Field label="Etapa actual *">
            <div className="flex flex-wrap gap-2 mt-1">
              {STAGES.map(s => (
                <button
                  key={s.value} type="button"
                  onClick={() => update('stage', s.value)}
                  className={`text-xs px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                    form.stage === s.value
                      ? `${s.color} text-white border-transparent`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* ─── FORMULARIO PRODUCTORA (simplificado) ─── */}
          {!useEliteForm && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha de entrega">
                  <input type="date" value={form.target_end_date}
                    onChange={e => update('target_end_date', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Presupuesto total">
                  <input type="number" value={form.actual_cost}
                    onChange={e => update('actual_cost', e.target.value)}
                    className={inputCls} placeholder="ej. 150000" />
                </Field>
              </div>

              <Field label="Descripción breve">
                <textarea value={form.logline} onChange={e => update('logline', e.target.value)}
                  rows={2} className={inputCls + ' resize-none'}
                  placeholder="Describe brevemente el proyecto..." />
              </Field>
            </>
          )}

          {/* ─── FORMULARIO ELITE (completo) ─── */}
          {useEliteForm && (
            <>
              {/* Género */}
              <Field label="Género">
                <select value={form.project_genre} onChange={e => {
                  update('project_genre', e.target.value)
                  update('cost_category_id', '')
                }} className={inputCls}>
                  <option value="">— seleccionar —</option>
                  {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>

              {/* Categoría de costo */}
              {form.project_format && form.project_genre && filteredCats.length > 0 && (
                <Field label="Categoría de costo" hint="Define el rango de presupuesto estimado">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {filteredCats.map(cat => (
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
                        <span className="ml-1.5 opacity-70">{fmtMXN(cat.estimated_cost)}</span>
                      </button>
                    ))}
                  </div>
                  {selectedCat && (
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Presupuesto estimado de categoría: {fmtMXN(selectedCat.estimated_cost)}
                    </p>
                  )}
                </Field>
              )}

              {/* Costo real */}
              <Field label="Presupuesto total real (si se conoce)" hint="Sobreescribe el estimado de categoría">
                <input type="number" value={form.actual_cost}
                  onChange={e => update('actual_cost', e.target.value)}
                  className={inputCls} placeholder="ej. 435000000" />
              </Field>

              {/* Google Drive */}
              <Field label="Link a Google Drive" hint="Carpeta compartida del proyecto (opcional)">
                <div className="flex gap-2">
                  <input type="url" value={form.google_drive_link}
                    onChange={e => update('google_drive_link', e.target.value)}
                    className={inputCls} placeholder="https://drive.google.com/..." />
                  {form.google_drive_link && (
                    <a href={form.google_drive_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center px-3 border border-gray-200 rounded-md text-gray-400 hover:text-gray-700 transition-colors">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </Field>

              {/* Logline */}
              <Field label="Logline / Idea" hint="Una línea que resuma el concepto">
                <textarea value={form.logline} onChange={e => update('logline', e.target.value)}
                  rows={2} className={inputCls + ' resize-none'}
                  placeholder="Una mujer cansada de estafadores conoce a otra que..." />
              </Field>

              {/* Status note */}
              <Field label="Status actual (headline para Slack)" hint='Frase corta tipo "EN ESPERA DE VIX"'>
                <input type="text" value={form.status_note}
                  onChange={e => update('status_note', e.target.value)}
                  className={inputCls}
                  placeholder="EN ESPERA DE LA RESPUESTA DE NBC UNIVERSAL" />
              </Field>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════
            SECCIONES POR ETAPA — Solo para Elite/Independiente (serie/película)
        ════════════════════════════════════════════ */}
        {useEliteForm && stageGte(stage, 'desarrollo') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#6b7d6e]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Desarrollo</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Productor responsable">
                <input type="text" value={form.producer}
                  onChange={e => update('producer', e.target.value)}
                  className={inputCls} placeholder="Nombre del productor" />
              </Field>
              <Field label="Escritor(a)">
                <input type="text" value={form.writers}
                  onChange={e => update('writers', e.target.value)}
                  className={inputCls} placeholder="Nombre(s)" />
              </Field>
            </div>

            <Field label="Materiales existentes" hint="Selecciona todos los que apliquen">
              <div className="flex flex-wrap gap-2 mt-1">
                {MATERIALS_OPTIONS.map(mat => (
                  <button key={mat} type="button" onClick={() => toggleMaterial(mat)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      materials.includes(mat)
                        ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    {mat}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Proceso de desarrollo">
                <select value={form.dev_process} onChange={e => update('dev_process', e.target.value)} className={inputCls}>
                  <option value="">— seleccionar —</option>
                  {DEV_PROCESSES.map(d => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Canal de distribución pensado">
                <select value={form.distribution_channel} onChange={e => update('distribution_channel', e.target.value)} className={inputCls}>
                  <option value="">— seleccionar —</option>
                  {DISTRIBUTION_CHANNELS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div className="flex items-center gap-4">
              <Field label="¿Tiene Green Light?">
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => update('green_light', true)}
                    className={`text-xs px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                      form.green_light === true
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>Sí</button>
                  <button type="button" onClick={() => update('green_light', false)}
                    className={`text-xs px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                      form.green_light === false
                        ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>No</button>
                </div>
              </Field>
            </div>

            <Field label="Costo de etapa de desarrollo">
              <input type="number" value={form.cost_desarrollo}
                onChange={e => update('cost_desarrollo', e.target.value)}
                className={inputCls} placeholder="ej. 5000000" />
            </Field>
          </div>
        )}

        {useEliteForm && stageGte(stage, 'preproduccion') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#d4c5a9]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preproducción</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha de inicio">
                <input type="date" value={form.start_date}
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

            <div className="grid grid-cols-2 gap-4">
              <Field label="Director">
                <input type="text" value={form.director}
                  onChange={e => update('director', e.target.value)}
                  className={inputCls} placeholder="Nombre del director" />
              </Field>
              <Field label="Talento confirmado">
                <input type="text" value={form.confirmed_talent}
                  onChange={e => update('confirmed_talent', e.target.value)}
                  className={inputCls} placeholder="Actores confirmados..." />
              </Field>
            </div>

            <Field label="Costo de preproducción">
              <input type="number" value={form.cost_preproduccion}
                onChange={e => update('cost_preproduccion', e.target.value)}
                className={inputCls} placeholder="ej. 15000000" />
            </Field>
          </div>
        )}

        {useEliteForm && stageGte(stage, 'produccion') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#BE1E2D]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Producción</p>
            </div>
            <Field label="Costo de producción">
              <input type="number" value={form.cost_produccion}
                onChange={e => update('cost_produccion', e.target.value)}
                className={inputCls} placeholder="ej. 200000000" />
            </Field>
          </div>
        )}

        {useEliteForm && stageGte(stage, 'postproduccion') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#c4a882]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postproducción</p>
            </div>
            <Field label="Costo de postproducción">
              <input type="number" value={form.cost_postproduccion}
                onChange={e => update('cost_postproduccion', e.target.value)}
                className={inputCls} placeholder="ej. 50000000" />
            </Field>
          </div>
        )}

        {useEliteForm && stageGte(stage, 'distribucion') && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#2d2d2d]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distribución</p>
            </div>
            <Field label="Costos de distribución">
              <input type="number" value={form.cost_distribucion}
                onChange={e => update('cost_distribucion', e.target.value)}
                className={inputCls} placeholder="ej. 10000000" />
            </Field>
          </div>
        )}

        {/* ════════════════════════════════════════════
            NOTAS — Siempre
        ════════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <Field label="Notas adicionales">
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} placeholder="Opcional" />
          </Field>
        </div>

        {/* ════════════════════════════════════════════
            Errores y botones
        ════════════════════════════════════════════ */}
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

/* ─── Helpers ─── */
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

