import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader, Breadcrumb } from '../components/Layout'
import { fmtDate, fmtMXN, STATUS_LABELS, PROGRAM_STATUS_LABELS, calcEndDate, nextWorkday } from '../lib/utils'
import { parseISO, format } from 'date-fns'
import { Plus, ChevronDown, CheckCircle2, Circle, AlertCircle, Clock, DollarSign, Trash2, Pencil, X } from 'lucide-react'

const STATUS_ICONS = {
  pending:     <Circle size={14} className="text-gray-400" />,
  in_progress: <Clock  size={14} className="text-blue-500" />,
  delivered:   <CheckCircle2 size={14} className="text-green-500" />,
  blocked:     <AlertCircle  size={14} className="text-red-500" />,
}

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [program, setProgram]       = useState(null)
  const [activities, setActivities] = useState([])
  const [participants, setParticipants] = useState([])
  const [catalog, setCatalog]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [editingActivity, setEditingActivity]       = useState(null)
  const [confirmDeleteActId, setConfirmDeleteActId] = useState(null)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [progRes, actRes, partRes, catRes] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id).single(),
      supabase.from('activities').select('*, responsible:participants(id,name)')
               .eq('program_id', id).order('order_index'),
      supabase.from('participants').select('id,name').eq('is_active', true),
      supabase.from('activity_catalog').select('name,default_duration,default_daily_cost,cost_type,stage').order('name'),
    ])
    setProgram(progRes.data)
    setActivities(actRes.data ?? [])
    setParticipants(partRes.data ?? [])
    setCatalog(catRes.data ?? [])
    setLoading(false)
  }

  async function updateStatus(activityId, newStatus) {
    await supabase.from('activities').update({ status: newStatus }).eq('id', activityId)
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: newStatus } : a))
  }

  async function deleteActivity(actId) {
    await supabase.from('activities').delete().eq('id', actId)
    setActivities(prev => prev.filter(a => a.id !== actId))
    setConfirmDeleteActId(null)
  }

  async function deleteProgram() {
    setDeleting(true)
    // Primero borramos las actividades (FK constraint)
    await supabase.from('activities').delete().eq('program_id', id)
    const { error } = await supabase.from('programs').delete().eq('id', id)
    if (error) {
      setDeleting(false)
      setShowDeleteConfirm(false)
      alert('Error al eliminar el programa. Intenta de nuevo.')
      return
    }
    navigate('/')
  }

  if (loading) return <PageLoading />
  if (!program) return <div className="p-8 text-gray-500">Programa no encontrado.</div>

  const calcImporte = (a) => a.cost_type === 'fixed'
    ? (a.daily_cost || 0)
    : (a.daily_cost || 0) * (a.duration_days || 1)
  const totalBudget = activities.reduce((s, a) => s + calcImporte(a), 0)
  const delivered   = activities.filter(a => a.status === 'delivered').length
  const progress    = activities.length > 0 ? Math.round((delivered / activities.length) * 100) : 0
  const statusCfg   = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active

  return (
    <div className="p-8">
      <Breadcrumb items={['Programas', program.name]} />

      <PageHeader
        title={program.name}
        subtitle={`Inicio: ${fmtDate(program.start_date)} · ${program.work_modality}`}
        action={
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700
                         border border-red-200 hover:border-red-400 rounded-md px-3 py-1.5
                         transition-all hover:bg-red-50"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
        }
      />

      {/* Modal confirmación eliminar */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1a1a1a]">Eliminar programa</h3>
                <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás segura de que querés eliminar <span className="font-semibold text-[#1a1a1a]">{program.name}</span>?
              Se borrarán también todas sus actividades ({activities.length} en total).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-md
                           border border-gray-200 hover:border-gray-400 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={deleteProgram}
                disabled={deleting}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded-md
                           hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Actividades" value={`${activities.length}`} />
        <SummaryCard label="Completadas" value={`${delivered} (${progress}%)`} highlight />
        <SummaryCard label="Presupuesto" value={fmtMXN(totalBudget)} />
        <SummaryCard label="Inicio" value={fmtDate(program.start_date)} />
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Avance general</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div className="h-2 bg-[#1a1a1a] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Activities table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Actividades</h2>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1a1a1a]
                       border border-gray-200 rounded-md px-3 py-1.5 hover:border-gray-400 transition-all"
          >
            <Plus size={14} />
            Agregar actividad
          </button>
        </div>

        {showAddForm && (
          <AddActivityForm
            programId={id}
            programStartDate={program.start_date}
            programStage={program.stage}
            activities={activities}
            participants={participants}
            catalog={catalog}
            onSaved={() => { loadAll(); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {activities.length === 0 && !showAddForm ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Sin actividades. Agregá la primera.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actividad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsable</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Días</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fin</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Importe</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => {
                const statusCfg = STATUS_LABELS[act.status] ?? STATUS_LABELS.pending
                const importe   = calcImporte(act)
                const isConfirmingDelete = confirmDeleteActId === act.id
                return (
                  <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-[#1a1a1a]">{act.name}</div>
                      {act.predecessor_id && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          ↳ {activities.find(a => a.id === act.predecessor_id)?.name ?? '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">
                      {act.responsible?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{act.duration_days}</td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtDate(act.start_date)}</td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtDate(act.end_date)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-700">{importe > 0 ? fmtMXN(importe) : '—'}</td>
                    <td className="px-4 py-3.5">
                      <StatusDropdown
                        current={act.status}
                        onChange={s => updateStatus(act.id, s)}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                          <button
                            onClick={() => deleteActivity(act.id)}
                            className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 transition-colors"
                          >Sí</button>
                          <button
                            onClick={() => setConfirmDeleteActId(null)}
                            className="text-xs text-gray-400 hover:text-gray-700"
                          ><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingActivity(act)}
                            className="p-1.5 text-gray-400 hover:text-[#1a1a1a] hover:bg-gray-100 rounded transition-colors"
                            title="Editar"
                          ><Pencil size={13} /></button>
                          <button
                            onClick={() => setConfirmDeleteActId(act.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          ><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-[#1a1a1a]">{fmtMXN(totalBudget)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      {/* Modal editar actividad */}
      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          activities={activities}
          participants={participants}
          programStartDate={program.start_date}
          onSaved={() => { loadAll(); setEditingActivity(null) }}
          onCancel={() => setEditingActivity(null)}
        />
      )}
    </div>
  )
}

/* ---- Edit Activity Modal ---- */
function EditActivityModal({ activity, activities, participants, programStartDate, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name:              activity.name,
    responsible_id:    activity.responsible_id ?? '',
    predecessor_id:    activity.predecessor_id ?? '',
    duration_days:     activity.duration_days,
    daily_cost:        activity.daily_cost ?? 0,
    cost_type:         activity.cost_type ?? 'time',
    notes:             activity.notes ?? '',
    use_forced_start:  !!activity.forced_start_date,
    forced_start_date: activity.forced_start_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)

    let start
    if (form.use_forced_start && form.forced_start_date) {
      start = parseISO(form.forced_start_date)
    } else if (form.predecessor_id) {
      const pred = activities.find(a => a.id === form.predecessor_id)
      start = pred?.end_date ? nextWorkday(parseISO(pred.end_date)) : parseISO(programStartDate)
    } else {
      start = parseISO(programStartDate)
    }
    const end = calcEndDate(start, form.duration_days)

    const payload = {
      name:              form.name.trim(),
      responsible_id:    form.responsible_id || null,
      predecessor_id:    form.predecessor_id || null,
      duration_days:     Number(form.duration_days),
      daily_cost:        Number(form.daily_cost),
      cost_type:         form.cost_type,
      start_date:        format(start, 'yyyy-MM-dd'),
      end_date:          format(end, 'yyyy-MM-dd'),
      forced_start_date: form.use_forced_start && form.forced_start_date ? form.forced_start_date : null,
      notes:             form.notes,
    }

    const { error: err } = await supabase.from('activities').update(payload).eq('id', activity.id)
    if (err) {
      setError('Error al guardar.')
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1a1a1a]">Editar actividad</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Predecesora */}
            <div>
              <label className={labelCls}>Predecesora</label>
              <select
                value={form.predecessor_id}
                onChange={e => setForm(f => ({ ...f, predecessor_id: e.target.value }))}
                className={selectCls}
              >
                <option value="">— ninguna —</option>
                {activities.filter(a => a.id !== activity.id).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {/* Responsable */}
            <div>
              <label className={labelCls}>Responsable</label>
              <select
                value={form.responsible_id}
                onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value }))}
                className={selectCls}
              >
                <option value="">— ninguno —</option>
                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duración */}
            <div>
              <label className={labelCls}>Duración (días)</label>
              <input
                type="number" min="1"
                value={form.duration_days}
                onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                className={inputCls}
              />
            </div>
            {/* Costo */}
            <div>
              <label className={labelCls}>
                {form.cost_type === 'fixed' ? 'Costo fijo ($)' : 'Costo diario ($)'}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min="0"
                  value={form.daily_cost}
                  onChange={e => setForm(f => ({ ...f, daily_cost: e.target.value }))}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, cost_type: f.cost_type === 'fixed' ? 'time' : 'fixed' }))}
                  className={`text-xs px-2 py-1.5 rounded border flex-shrink-0 transition-colors ${
                    form.cost_type === 'fixed'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {form.cost_type === 'fixed' ? 'Fijo' : 'x día'}
                </button>
              </div>
            </div>
          </div>

          {/* Fecha forzada */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={form.use_forced_start}
                onChange={e => setForm(f => ({ ...f, use_forced_start: e.target.checked }))}
                className="rounded"
              />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Forzar fecha de inicio
              </span>
            </label>
            {form.use_forced_start && (
              <input
                type="date"
                value={form.forced_start_date}
                onChange={e => setForm(f => ({ ...f, forced_start_date: e.target.value }))}
                className={inputCls + ' mt-2 max-w-xs'}
              />
            )}
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="Notas opcionales..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-md
                       border border-gray-200 hover:border-gray-400 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-[#1a1a1a] text-white px-5 py-2 rounded-md
                       hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Add Activity inline form ---- */
function AddActivityForm({ programId, programStartDate, programStage, activities, participants, catalog, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: '', predecessor_id: '', responsible_id: '',
    duration_days: 1, daily_cost: 0, cost_type: 'time', notes: '',
    forced_start_date: '', use_forced_start: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Filtrar catálogo por la etapa del programa
  const filteredCatalog = programStage
    ? catalog.filter(c => !c.stage || c.stage === programStage)
    : catalog

  function fillFromCatalog(name) {
    const item = catalog.find(c => c.name === name)
    if (item) setForm(f => ({
      ...f,
      name:          item.name,
      duration_days: item.default_duration,
      daily_cost:    item.default_daily_cost,
      cost_type:     item.cost_type ?? 'time',
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)

    // Calcular fechas — fecha forzada tiene prioridad
    let start
    if (form.use_forced_start && form.forced_start_date) {
      start = parseISO(form.forced_start_date)
    } else if (form.predecessor_id) {
      const pred = activities.find(a => a.id === form.predecessor_id)
      start = pred?.end_date ? nextWorkday(parseISO(pred.end_date)) : parseISO(programStartDate)
    } else {
      start = parseISO(programStartDate)
    }
    const end = calcEndDate(start, form.duration_days)

    const payload = {
      program_id:         programId,
      name:               form.name.trim(),
      predecessor_id:     form.predecessor_id || null,
      responsible_id:     form.responsible_id || null,
      duration_days:      Number(form.duration_days),
      daily_cost:         Number(form.daily_cost),
      cost_type:          form.cost_type,
      start_date:         format(start, 'yyyy-MM-dd'),
      end_date:           format(end, 'yyyy-MM-dd'),
      forced_start_date:  form.use_forced_start && form.forced_start_date ? form.forced_start_date : null,
      order_index:        activities.length,
      notes:              form.notes,
    }

    const { error: err } = await supabase.from('activities').insert([payload])
    if (err) {
      if (err.code === '23505') setError('Ya existe una actividad con ese nombre en este programa.')
      else setError('Error al guardar.')
      setSaving(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="border-b border-gray-100 bg-blue-50/30 px-6 py-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Nueva actividad</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Desde catálogo {programStage ? `(${programStage})` : ''}</label>
          <select onChange={e => fillFromCatalog(e.target.value)} className={selectCls}>
            <option value="">— seleccionar actividad base —</option>
            {filteredCatalog.map(c => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls}
            placeholder="Nombre de la actividad"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <label className={labelCls}>Predecesora</label>
          <select value={form.predecessor_id} onChange={e => setForm(f => ({ ...f, predecessor_id: e.target.value }))} className={selectCls}>
            <option value="">— ninguna —</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Responsable</label>
          <select value={form.responsible_id} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value }))} className={selectCls}>
            <option value="">— ninguno —</option>
            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Duración (días)</label>
          <input type="number" min="1" value={form.duration_days}
            onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
            className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>
            {form.cost_type === 'fixed' ? 'Costo fijo ($)' : 'Costo diario ($)'}
          </label>
          <div className="flex gap-2 items-center">
            <input type="number" min="0" value={form.daily_cost}
              onChange={e => setForm(f => ({ ...f, daily_cost: e.target.value }))}
              className={inputCls} />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, cost_type: f.cost_type === 'fixed' ? 'time' : 'fixed' }))}
              className={`text-xs px-2 py-1.5 rounded border flex-shrink-0 transition-colors ${
                form.cost_type === 'fixed'
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
              title="Cambiar entre costo diario y costo fijo"
            >
              {form.cost_type === 'fixed' ? 'Fijo' : 'x día'}
            </button>
          </div>
        </div>
      </div>

      {/* Fecha forzada */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.use_forced_start}
            onChange={e => setForm(f => ({ ...f, use_forced_start: e.target.checked }))}
            className="rounded"
          />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Forzar fecha de inicio
          </span>
        </label>
        {form.use_forced_start && (
          <input
            type="date"
            value={form.forced_start_date}
            onChange={e => setForm(f => ({ ...f, forced_start_date: e.target.value }))}
            className={inputCls + ' mt-2 max-w-xs'}
          />
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="bg-[#1a1a1a] text-white text-xs font-medium px-5 py-2 rounded-md
                     hover:bg-gray-800 transition-colors disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar actividad'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ---- Status dropdown ---- */
function StatusDropdown({ current, onChange }) {
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState({ top: 0, left: 0 })
  const btnRef            = useRef(null)
  const cfg = STATUS_LABELS[current] ?? STATUS_LABELS.pending

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
    setOpen(v => !v)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
                    cursor-pointer ${cfg.color}`}
      >
        {STATUS_ICONS[current]}
        {cfg.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-40 py-1 overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
          >
            {Object.entries(STATUS_LABELS).map(([key, val]) => (
              <button key={key} onClick={() => { onChange(key); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                {STATUS_ICONS[key]}
                {val.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`bg-white border rounded-lg px-5 py-4 ${highlight ? 'border-blue-200' : 'border-gray-200'}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#1a1a1a]">{value}</div>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-8 animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  )
}

const labelCls  = 'block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1'
const inputCls  = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] bg-white'
const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] bg-white'
