import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useProgramAccess } from '../hooks/useProgramAccess'
import { PageHeader, Breadcrumb } from '../components/Layout'
import { fmtDate, fmtMXN, STATUS_LABELS, PROGRAM_STATUS_LABELS, calcEndDate, nextWorkday } from '../lib/utils'
import { parseISO, format } from 'date-fns'
import { Plus, ChevronDown, ChevronUp, CheckCircle2, Circle, AlertCircle, Clock, DollarSign, Trash2, Pencil, X, Lightbulb, Film, PenTool, Users, FileText, Target, Banknote } from 'lucide-react'
import { useStages } from '../hooks/useStages'
import { useProjectTypes } from '../hooks/useProjectTypes'
import ProgramMembers from '../components/ProgramMembers'

const STATUS_ICONS = {
  pending:     <Circle size={14} className="text-gray-400" />,
  in_progress: <Clock  size={14} className="text-blue-500" />,
  delivered:   <CheckCircle2 size={14} className="text-green-500" />,
  blocked:     <AlertCircle  size={14} className="text-red-500" />,
}

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeOrg } = useOrg()
  const { memberPrograms, userRole, isAdmin: isProgramAdmin } = useProgramAccess()
  const { stageLabels: STAGE_LABELS, stages: orgStages, stageKeys, stageGte } = useStages()
  const { typeLabels, types: projectTypes } = useProjectTypes()
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
  const [showFicha, setShowFicha]                   = useState(true)
  const [editingProgram, setEditingProgram]         = useState(false)
  const [accessDenied, setAccessDenied]             = useState(false)
  const [statusFilter, setStatusFilter]             = useState('active') // 'all' | 'active' | 'pending' | 'in_progress' | 'delivered' | 'blocked'

  useEffect(() => { loadAll() }, [id, activeOrg?.id])

  useEffect(() => {
    // Check access: if user is not an org admin and not a member of this program, deny access
    if (!isProgramAdmin && !memberPrograms.includes(id)) {
      setAccessDenied(true)
    } else {
      setAccessDenied(false)
    }
  }, [id, memberPrograms, isProgramAdmin])

  async function loadAll() {
    let partQuery = supabase.from('participants').select('id,name').eq('is_active', true)
    if (activeOrg?.id) {
      partQuery = partQuery.eq('org_id', activeOrg.id)
    }

    let catQuery = supabase.from('activity_catalog').select('name,default_duration,default_daily_cost,cost_type,stage').order('name')
    if (activeOrg?.id) {
      catQuery = catQuery.eq('org_id', activeOrg.id)
    }

    const [progRes, actRes, partRes, catRes] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id).single(),
      supabase.from('activities').select('*, responsible:participants(id,name)')
               .eq('program_id', id).order('order_index'),
      partQuery,
      catQuery,
    ])
    setProgram(progRes.data)
    setActivities(actRes.data ?? [])
    setParticipants(partRes.data ?? [])
    setCatalog(catRes.data ?? [])
    setLoading(false)
  }

  async function updateStatus(activityId, newStatus) {
    const prev = activities.find(a => a.id === activityId)
    await supabase.from('activities').update({ status: newStatus }).eq('id', activityId)
    // Registrar cambio en historial
    await supabase.from('activity_log').insert([{
      activity_id:   activityId,
      field_changed: 'status',
      old_value:     prev?.status ?? '',
      new_value:     newStatus,
    }])
    setActivities(acts => acts.map(a => a.id === activityId ? { ...a, status: newStatus } : a))

    // Notificar a Slack al canal del proyecto (async, no bloquea)
    import('../lib/slack').then(({ notifyStatusChange, notifyBlocked }) => {
      const channelId = program.slack_channel_id
      notifyStatusChange({
        channelId,
        programName: program.name,
        activityName: prev?.name ?? '',
        oldStatus: prev?.status ?? '',
        newStatus,
        responsible: prev?.responsible?.name,
      })
      if (newStatus === 'blocked') {
        notifyBlocked({
          channelId,
          programName: program.name,
          activityName: prev?.name ?? '',
          responsible: prev?.responsible?.name,
        })
      }
    }).catch(() => {}) // Silently fail if Slack not configured
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
  if (accessDenied) return <div className="p-8 text-center"><p className="text-gray-500">No tienes acceso a este proyecto.</p></div>

  // Determine edit permissions based on role
  const userRoleInProgram = userRole(id)
  const canEditProgram = isProgramAdmin || userRoleInProgram === 'admin' || userRoleInProgram === 'producer'
  const canDeleteProgram = isProgramAdmin || userRoleInProgram === 'admin'
  const canAddActivity = isProgramAdmin || userRoleInProgram === 'admin' || userRoleInProgram === 'producer'
  const canEditActivity = isProgramAdmin || userRoleInProgram === 'admin' || userRoleInProgram === 'producer'
  const canDeleteActivity = isProgramAdmin || userRoleInProgram === 'admin' || userRoleInProgram === 'producer'

  const calcImporte = (a) => a.cost_type === 'fixed'
    ? (a.daily_cost || 0)
    : (a.daily_cost || 0) * (a.duration_days || 1)
  const totalBudget = activities.reduce((s, a) => s + calcImporte(a), 0)
  const delivered   = activities.filter(a => a.status === 'delivered').length
  const progress    = activities.length > 0 ? Math.round((delivered / activities.length) * 100) : 0
  const statusCfg   = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active

  return (
    <div className="p-4 md:p-8">
      <Breadcrumb items={['Programas', program.name]} />

      <PageHeader
        title={program.name}
        subtitle={`Inicio: ${fmtDate(program.start_date)}${program.project_type ? ` · ${typeLabels[program.project_type] || program.project_type}` : ''}${program.stage ? ` · ${STAGE_LABELS[program.stage] || program.stage}` : ''}${program.work_modality ? ` · ${program.work_modality}` : ''}`}
        action={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            {canEditProgram && (
              <button
                onClick={() => setEditingProgram(true)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#1a1a1a]
                           border border-gray-200 hover:border-gray-400 rounded-md px-2.5 sm:px-3 py-1.5
                           transition-all hover:bg-gray-50 active:bg-gray-100"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Editar</span>
              </button>
            )}
            {canDeleteProgram && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700
                           border border-red-200 hover:border-red-400 rounded-md px-2.5 sm:px-3 py-1.5
                           transition-all hover:bg-red-50 active:bg-red-100"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
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

      {/* Modal editar programa */}
      {editingProgram && (
        <EditProgramModal
          program={program}
          onSaved={() => { loadAll(); setEditingProgram(false) }}
          onCancel={() => setEditingProgram(false)}
          orgStages={orgStages}
          stageGte={stageGte}
          projectTypes={projectTypes}
        />
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

      {/* Ficha del proyecto */}
      <ProjectFicha program={program} show={showFicha} onToggle={() => setShowFicha(v => !v)} stageLabels={STAGE_LABELS} typeLabels={typeLabels} />

      {/* Equipo del proyecto */}
      <ProgramMembers
        programId={program.id}
        programName={program.name}
        slackChannelId={program.slack_channel_id}
        canManage={isProgramAdmin || userRole(program.id) === 'admin' || userRole(program.id) === 'producer'}
      />

      {/* Activities table */}
      {(() => {
        const filteredActivities = activities.filter(a => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'active') return a.status !== 'delivered'
          return a.status === statusFilter
        })
        const counts = activities.reduce((acc, a) => {
          acc.all++
          if (a.status !== 'delivered') acc.active++
          acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        }, { all: 0, active: 0, pending: 0, in_progress: 0, delivered: 0, blocked: 0 })
        const FILTERS = [
          { key: 'active',      label: 'Activas' },
          { key: 'all',         label: 'Todas' },
          { key: 'pending',     label: 'Pendientes' },
          { key: 'in_progress', label: 'En proceso' },
          { key: 'delivered',   label: 'Entregadas' },
          { key: 'blocked',     label: 'Bloqueadas' },
        ]
        return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Actividades</h2>
            <div className="flex items-center gap-1 flex-wrap">
              {FILTERS.map(f => {
                const active = statusFilter === f.key
                const count = counts[f.key] ?? 0
                return (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      active
                        ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {f.label}
                    <span className={`ml-1 ${active ? 'text-white/60' : 'text-gray-400'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {canAddActivity && (
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1a1a1a]
                         border border-gray-200 rounded-md px-3 py-1.5 hover:border-gray-400 transition-all"
            >
              <Plus size={14} />
              Agregar actividad
            </button>
          )}
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
        ) : filteredActivities.length === 0 && !showAddForm ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Sin actividades en este filtro.{' '}
            <button onClick={() => setStatusFilter('all')} className="text-[#1a1a1a] underline hover:no-underline">
              Ver todas
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actividad</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsable</th>
                <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Días</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Inicio</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fin</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</th>
                <th className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Importe</th>
                <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-3 sm:px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredActivities.map((act) => {
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
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {act.deadline ? (() => {
                        const today = new Date(); today.setHours(0,0,0,0)
                        const dl = parseISO(act.deadline); dl.setHours(0,0,0,0)
                        const diffDays = Math.round((dl - today) / 86400000)
                        const isDelivered = act.status === 'delivered'
                        const isOverdue = !isDelivered && diffDays < 0
                        const isAtRisk = !isDelivered && diffDays >= 0 && diffDays <= 3
                        const endDate = act.end_date ? parseISO(act.end_date) : null
                        const endAfterDeadline = endDate && endDate > dl
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                            isOverdue ? 'bg-red-100 text-red-700' :
                            isAtRisk ? 'bg-amber-100 text-amber-700' :
                            endAfterDeadline && !isDelivered ? 'bg-orange-100 text-orange-700' :
                            isDelivered ? 'bg-gray-100 text-gray-500' :
                            'bg-gray-100 text-gray-600'
                          }`} title={
                            isOverdue ? `Vencida hace ${-diffDays}d` :
                            isAtRisk ? `Vence en ${diffDays}d` :
                            endAfterDeadline ? 'Plan termina después del deadline' : ''
                          }>
                            {(isOverdue || isAtRisk || endAfterDeadline) && !isDelivered && <AlertCircle size={11} />}
                            {fmtDate(act.deadline)}
                          </span>
                        )
                      })() : <span className="text-gray-300">—</span>}
                    </td>
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
                          {canEditActivity && (
                            <button
                              onClick={() => setEditingActivity(act)}
                              className="p-1.5 text-gray-400 hover:text-[#1a1a1a] hover:bg-gray-100 rounded transition-colors"
                              title="Editar"
                            ><Pencil size={13} /></button>
                          )}
                          {canDeleteActivity && (
                            <button
                              onClick={() => setConfirmDeleteActId(act.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar"
                            ><Trash2 size={13} /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={6} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-[#1a1a1a]">{fmtMXN(totalBudget)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
      )})()}
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
    deadline:          activity.deadline ?? '',
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
      deadline:          form.deadline || null,
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

          {/* Deadline / fecha crítica */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle size={12} className="text-red-500" />
                Deadline (fecha crítica de cierre)
              </span>
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className={inputCls + ' max-w-xs'}
            />
            <p className="text-xs text-gray-400 mt-1">
              Fecha obligatoria para cerrar esta actividad. Se marca en rojo si se cumple sin haberla cerrado.
            </p>
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
    forced_start_date: '', use_forced_start: false, deadline: '',
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
      deadline:           form.deadline || null,
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

      {/* Deadline / fecha crítica */}
      <div className="mb-4">
        <label className={labelCls}>
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-500" />
            Deadline (fecha crítica de cierre)
          </span>
        </label>
        <input
          type="date"
          value={form.deadline}
          onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
          className={inputCls + ' max-w-xs'}
        />
        <p className="text-xs text-gray-400 mt-1">
          Opcional. Fecha límite obligatoria para cerrar. Se marca en rojo si se cumple sin haberla cerrado.
        </p>
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

/* ---- Edit Program Modal ---- */
const DEV_PROCESSES = [
  'Investigación', 'Desarrollo narrativo', 'Escritura',
  'Desarrollo conceptual', 'Diseño de proyecto', 'Estrategia de venta',
]
const DISTRIBUTION_CHANNELS = ['Plataforma', 'EFICINE', 'Independiente', 'Canal TV', 'Otro']
const MATERIALS_OPTIONS = [
  'Idea escrita', 'Investigación', 'Tratamiento', 'Biblia',
  'Guion (primer draft)', 'Guion (avanzado)', 'Pitch deck', 'Teaser',
]
const MODALITIES_EDIT = ['Lunes a Viernes', 'Lunes a Sábado', 'Flexible']

function EditProgramModal({ program, onSaved, onCancel, orgStages, stageGte: editStageGte, projectTypes }) {
  const EDIT_STAGES = (orgStages || []).map(s => ({ value: s.key, label: s.label, color: s.bg }))
  const [form, setForm] = useState({
    name:                       program.name || '',
    stage:                      program.stage || (EDIT_STAGES[0]?.value || ''),
    status:                     program.status || 'active',
    project_format:             program.project_format || '',
    project_genre:              program.project_genre || '',
    cost_category_id:           program.cost_category_id || '',
    estimated_cost:             program.estimated_cost || '',
    actual_cost:                program.actual_cost || '',
    google_drive_link:          program.google_drive_link || '',
    logline:                    program.logline || '',
    status_note:                program.status_note || '',
    // Desarrollo+
    producer:                   program.producer || '',
    writers:                    program.writers || '',
    existing_materials:         program.existing_materials || '',
    dev_process:                program.dev_process || '',
    distribution_channel:       program.distribution_channel || '',
    green_light:                program.green_light || false,
    cost_desarrollo:            program.cost_desarrollo || '',
    // Preproducción+
    start_date:                 program.start_date || '',
    target_end_date:            program.target_end_date || '',
    work_modality:              program.work_modality || '',
    director:                   program.director || '',
    confirmed_talent:           program.confirmed_talent || '',
    cost_preproduccion:         program.cost_preproduccion || '',
    // Producción+
    cost_produccion:            program.cost_produccion || '',
    // Postproducción+
    cost_postproduccion:        program.cost_postproduccion || '',
    // Distribución
    cost_distribucion:          program.cost_distribucion || '',
    // Extras
    notes:                      program.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [costCategories, setCostCategories] = useState([])
  const [matList, setMatList] = useState((program.existing_materials || '').split(', ').filter(Boolean))

  useEffect(() => {
    supabase.from('cost_categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCostCategories(data)
    })
  }, [])

  const stage = form.stage
  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }
  function toggleMaterial(mat) {
    setMatList(prev => {
      const next = prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
      setForm(f => ({ ...f, existing_materials: next.join(', ') }))
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)

    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === 'string' && v.trim() === '') payload[k] = null
      else if (v === false && k === 'green_light') payload[k] = false
      else payload[k] = v
    }
    payload.name = form.name.trim()
    // Map project_format to project_type column
    if (payload.project_format) {
      payload.project_type = payload.project_format
    }

    const { error: err } = await supabase.from('programs').update(payload).eq('id', program.id)
    if (err) {
      setError('Error al guardar.')
      setSaving(false)
    } else {
      onSaved()
    }
  }

  const filteredCats = costCategories.filter(c =>
    c.format === form.project_format && c.genre === form.project_genre
  )
  const selectedCat = filteredCats.find(c => String(c.id) === String(form.cost_category_id))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-[#1a1a1a]">Editar programa</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* ── BASE ── */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Datos del proyecto</p>

          <div>
            <label className={labelCls}>Título *</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className={selectCls}>
                {Object.entries(PROGRAM_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Etapa — chips de color */}
          <div>
            <label className={labelCls}>Etapa</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {EDIT_STAGES.map(s => (
                <button key={s.value} type="button" onClick={() => update('stage', s.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border-2 transition-all font-medium ${
                    form.stage === s.value
                      ? `${s.color} text-white border-transparent`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de proyecto + Género */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de proyecto</label>
              <select value={form.project_format} onChange={e => {
                update('project_format', e.target.value); update('cost_category_id', '')
              }} className={selectCls}>
                <option value="">—</option>
                {(projectTypes || []).map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Género</label>
              <select value={form.project_genre} onChange={e => {
                update('project_genre', e.target.value); update('cost_category_id', '')
              }} className={selectCls}>
                <option value="">—</option>
                <option value="ficcion">Ficción</option>
                <option value="documental">Documental</option>
              </select>
            </div>
          </div>

          {/* Categoría de costo chips */}
          {form.project_format && form.project_genre && filteredCats.length > 0 && (
            <div>
              <label className={labelCls}>Categoría de costo</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {filteredCats.map(cat => (
                  <button key={cat.id} type="button"
                    onClick={() => {
                      update('cost_category_id', cat.id)
                      if (!form.actual_cost) update('estimated_cost', String(cat.estimated_cost))
                    }}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      String(form.cost_category_id) === String(cat.id)
                        ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    <span className="font-medium">{cat.category_name}</span>
                    <span className="ml-1.5 opacity-70">${(cat.estimated_cost / 1000000).toFixed(0)}M</span>
                  </button>
                ))}
              </div>
              {selectedCat && (
                <p className="text-[10px] text-gray-400 mt-1.5">Estimado: ${(selectedCat.estimated_cost / 1000000).toFixed(0)}M MXN</p>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>Presupuesto total real</label>
            <input type="number" value={form.actual_cost} onChange={e => update('actual_cost', e.target.value)}
              className={inputCls} placeholder="ej. 435000000" />
          </div>

          <div>
            <label className={labelCls}>Link a Google Drive</label>
            <input type="url" value={form.google_drive_link} onChange={e => update('google_drive_link', e.target.value)}
              className={inputCls} placeholder="https://drive.google.com/..." />
          </div>

          <div>
            <label className={labelCls}>Logline / Idea</label>
            <textarea value={form.logline} onChange={e => update('logline', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} />
          </div>

          <div>
            <label className={labelCls}>Status actual <span className="text-gray-400 font-normal normal-case">(headline para Slack)</span></label>
            <input type="text" value={form.status_note} onChange={e => update('status_note', e.target.value)}
              className={inputCls} placeholder='Ej: "EN ESPERA DE VIX" o "REVISANDO PRESUPUESTO"' />
            <p className="text-[10px] text-gray-400 mt-1">Frase corta que aparece en mayúsculas en el resumen diario de Slack</p>
          </div>

          {/* ── DESARROLLO+ ── */}
          {editStageGte(stage, 'desarrollo') && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#6b7d6e]" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Desarrollo</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Productor responsable</label>
                    <input type="text" value={form.producer} onChange={e => update('producer', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Escritor(a)</label>
                    <input type="text" value={form.writers} onChange={e => update('writers', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Materiales existentes</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {MATERIALS_OPTIONS.map(mat => (
                      <button key={mat} type="button" onClick={() => toggleMaterial(mat)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          matList.includes(mat)
                            ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>{mat}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Proceso de desarrollo</label>
                    <select value={form.dev_process} onChange={e => update('dev_process', e.target.value)} className={selectCls}>
                      <option value="">—</option>
                      {DEV_PROCESSES.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Canal de distribución</label>
                    <select value={form.distribution_channel} onChange={e => update('distribution_channel', e.target.value)} className={selectCls}>
                      <option value="">—</option>
                      {DISTRIBUTION_CHANNELS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>¿Tiene Green Light?</label>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => update('green_light', true)}
                      className={`text-xs px-4 py-1.5 rounded-lg border-2 font-medium ${
                        form.green_light === true ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'
                      }`}>Sí</button>
                    <button type="button" onClick={() => update('green_light', false)}
                      className={`text-xs px-4 py-1.5 rounded-lg border-2 font-medium ${
                        form.green_light === false ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-500 border-gray-200'
                      }`}>No</button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Costo de etapa de desarrollo</label>
                  <input type="number" value={form.cost_desarrollo} onChange={e => update('cost_desarrollo', e.target.value)}
                    className={inputCls} placeholder="ej. 5000000" />
                </div>
              </div>
            </div>
          )}

          {/* ── PREPRODUCCIÓN+ ── */}
          {editStageGte(stage, 'preproduccion') && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#d4c5a9]" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Preproducción</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Fecha de inicio</label>
                    <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha aprox. fin</label>
                    <input type="date" value={form.target_end_date} onChange={e => update('target_end_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Modalidad de trabajo</label>
                  <select value={form.work_modality} onChange={e => update('work_modality', e.target.value)} className={selectCls}>
                    <option value="">—</option>
                    {MODALITIES_EDIT.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Director</label>
                    <input type="text" value={form.director} onChange={e => update('director', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Talento confirmado</label>
                    <input type="text" value={form.confirmed_talent} onChange={e => update('confirmed_talent', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Costo de preproducción</label>
                  <input type="number" value={form.cost_preproduccion} onChange={e => update('cost_preproduccion', e.target.value)}
                    className={inputCls} placeholder="ej. 15000000" />
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCCIÓN+ ── */}
          {editStageGte(stage, 'produccion') && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#BE1E2D]" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Producción</p>
              </div>
              <div>
                <label className={labelCls}>Costo de producción</label>
                <input type="number" value={form.cost_produccion} onChange={e => update('cost_produccion', e.target.value)}
                  className={inputCls} placeholder="ej. 200000000" />
              </div>
            </div>
          )}

          {/* ── POSTPRODUCCIÓN+ ── */}
          {editStageGte(stage, 'postproduccion') && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#c4a882]" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Postproducción</p>
              </div>
              <div>
                <label className={labelCls}>Costo de postproducción</label>
                <input type="number" value={form.cost_postproduccion} onChange={e => update('cost_postproduccion', e.target.value)}
                  className={inputCls} placeholder="ej. 50000000" />
              </div>
            </div>
          )}

          {/* ── DISTRIBUCIÓN ── */}
          {editStageGte(stage, 'distribucion') && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#2d2d2d]" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Distribución</p>
              </div>
              <div>
                <label className={labelCls}>Costos de distribución</label>
                <input type="number" value={form.cost_distribucion} onChange={e => update('cost_distribucion', e.target.value)}
                  className={inputCls} placeholder="ej. 10000000" />
              </div>
            </div>
          )}

          {/* ── NOTAS ── */}
          <div className="border-t border-gray-100 pt-5">
            <div>
              <label className={labelCls}>Notas generales</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
                rows={3} className={inputCls + ' resize-none'} />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-md
                       border border-gray-200 hover:border-gray-400 transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-sm bg-[#1a1a1a] text-white px-5 py-2 rounded-md
                       hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Ficha del proyecto ---- */
function ProjectFicha({ program, show, onToggle, stageLabels: STAGE_LABELS = {}, typeLabels = {} }) {
  const p = program
  const hasData = p.synopsis || p.logline || p.writers || p.genre || p.script_notes ||
                  p.commercial_potential || p.cinematographic_potential || p.producer ||
                  p.confirmed_talent || p.estimated_cost || p.actual_cost || p.distribution_channel ||
                  p.existing_materials || p.whats_needed || p.treatment_status || p.dev_process ||
                  p.project_format

  // If no structured data, try to show notes
  if (!hasData && !p.notes) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Ficha del proyecto</h2>
          {p.project_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              {p.project_type}
            </span>
          )}
          {p.content_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              {p.content_type}
            </span>
          )}
          {p.stage && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0f1f0] text-[#6b7370] font-medium uppercase">
              {STAGE_LABELS[p.stage] || p.stage}
            </span>
          )}
        </div>
        {show ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {show && (
        <div className="border-t border-gray-100 px-6 py-5">
          {hasData ? (
            <div className="space-y-6">
              {/* Row 1: Logline / Synopsis */}
              {(p.logline || p.synopsis) && (
                <div>
                  {p.logline && (
                    <div className="mb-4">
                      <FichaLabel icon={<Lightbulb size={13} />} label="Logline / Idea" />
                      <p className="text-sm text-gray-700 leading-relaxed">{p.logline}</p>
                    </div>
                  )}
                  {p.synopsis && (
                    <div>
                      <FichaLabel icon={<Film size={13} />} label="Sinopsis" />
                      <p className="text-sm text-gray-700 leading-relaxed">{p.synopsis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Row 2: Grid of metadata */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                {p.writers && (
                  <FichaField icon={<PenTool size={12} />} label="Escritor(a)" value={p.writers} />
                )}
                {p.genre && (
                  <FichaField icon={<Film size={12} />} label="Formato / Género" value={p.genre} />
                )}
                {p.producer && (
                  <FichaField icon={<Users size={12} />} label="Productor responsable" value={p.producer} />
                )}
                {p.confirmed_talent && (
                  <FichaField icon={<Users size={12} />} label="Talento confirmado" value={p.confirmed_talent} />
                )}
                {p.treatment_status && (
                  <FichaField icon={<FileText size={12} />} label="Tratamiento" value={p.treatment_status} />
                )}
                {p.dev_process && (
                  <FichaField icon={<Target size={12} />} label="Proceso de desarrollo" value={p.dev_process} />
                )}
                {p.commercial_potential && (
                  <FichaField icon={<Target size={12} />} label="Potencial comercial" value={p.commercial_potential} />
                )}
                {p.cinematographic_potential && (
                  <FichaField icon={<Target size={12} />} label="Potencial cinematográfico" value={p.cinematographic_potential} />
                )}
                {p.actual_cost && (
                  <FichaField icon={<Banknote size={12} />} label="Costo real" value={`$${(Number(p.actual_cost) / 1000000).toFixed(0)}M MXN`} />
                )}
                {!p.actual_cost && p.estimated_cost && (
                  <FichaField icon={<Banknote size={12} />} label="Costo estimado" value={`$${(Number(p.estimated_cost) / 1000000).toFixed(0)}M MXN`} />
                )}
                {(p.project_format || p.project_type) && (
                  <FichaField icon={<Film size={12} />} label="Tipo / Género"
                    value={`${typeLabels[p.project_type] || typeLabels[p.project_format] || p.project_format || ''}${p.project_genre ? ` · ${p.project_genre === 'ficcion' ? 'Ficción' : p.project_genre === 'documental' ? 'Documental' : p.project_genre}` : ''}`} />
                )}
                {p.has_investment && (
                  <FichaField icon={<DollarSign size={12} />} label="Inversión previa" value={p.has_investment} />
                )}
                {p.distribution_channel && (
                  <FichaField icon={<Target size={12} />} label="Canal de distribución" value={p.distribution_channel} />
                )}
                {p.existing_materials && (
                  <FichaField icon={<FileText size={12} />} label="Materiales existentes" value={p.existing_materials} />
                )}
                {p.target_end_date && (
                  <FichaField icon={<Clock size={12} />} label="Fecha aprox. finalización" value={fmtDate(p.target_end_date)} />
                )}
              </div>

              {/* Row 3: Longer text fields */}
              {p.whats_needed && (
                <div>
                  <FichaLabel icon={<AlertCircle size={13} />} label="¿Qué falta para avanzar?" />
                  <p className="text-sm text-gray-700 leading-relaxed">{p.whats_needed}</p>
                </div>
              )}

              {p.script_notes && (
                <div>
                  <FichaLabel icon={<PenTool size={13} />} label="Notas de guión" />
                  <p className="text-sm text-gray-600 leading-relaxed bg-[#fafaf8] rounded-lg p-4 border border-gray-100">
                    {p.script_notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Fallback: show raw notes if no structured fields */
            <div>
              <FichaLabel icon={<FileText size={13} />} label="Notas" />
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-[#fafaf8] rounded-lg p-4 border border-gray-100">
                {p.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FichaLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function FichaField({ icon, label, value }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-gray-400">{icon}</span>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm text-gray-700">{value}</div>
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
