import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS, STATUS_LABELS } from '../lib/utils'
import {
  Film, Plus, ArrowRight, DollarSign, Calendar,
  ChevronDown, ChevronRight, Lightbulb, PenTool,
  Clapperboard, Scissors, Truck, SlidersHorizontal,
  ListChecks, AlertCircle, Clock, CheckCircle2, Circle
} from 'lucide-react'
import { parseISO, differenceInCalendarDays } from 'date-fns'

const STAGE_CONFIG = [
  { key: 'produccion',     label: 'Producción',      icon: Clapperboard,      bg: 'bg-[#BE1E2D]', bgLight: 'bg-red-50',        iconColor: 'text-[#BE1E2D]', border: 'border-[#BE1E2D]/20' },
  { key: 'postproduccion', label: 'Postproducción',   icon: Scissors,          bg: 'bg-[#c4a882]', bgLight: 'bg-amber-50',      iconColor: 'text-[#a08560]', border: 'border-[#c4a882]/30' },
  { key: 'preproduccion',  label: 'Preproducción',    icon: SlidersHorizontal, bg: 'bg-[#d4c5a9]', bgLight: 'bg-[#f5f0e6]',     iconColor: 'text-[#9a8b6f]', border: 'border-[#d4c5a9]/40' },
  { key: 'desarrollo',     label: 'Desarrollo',       icon: PenTool,           bg: 'bg-[#6b7d6e]', bgLight: 'bg-[#eef2ef]',     iconColor: 'text-[#6b7d6e]', border: 'border-[#6b7d6e]/20' },
  { key: 'incubadora',     label: 'Incubadora',       icon: Lightbulb,         bg: 'bg-[#8c9490]', bgLight: 'bg-[#f0f1f0]',     iconColor: 'text-[#6b7370]', border: 'border-[#8c9490]/20' },
  { key: 'distribucion',   label: 'Distribución',     icon: Truck,             bg: 'bg-[#2d2d2d]', bgLight: 'bg-gray-50',       iconColor: 'text-[#2d2d2d]', border: 'border-gray-200' },
]

const STATUS_ICONS = {
  pending:     <Circle size={12} className="text-gray-400" />,
  in_progress: <Clock size={12} className="text-blue-500" />,
  delivered:   <CheckCircle2 size={12} className="text-green-500" />,
  blocked:     <AlertCircle size={12} className="text-red-500" />,
}

export default function Dashboard() {
  const [programs, setPrograms] = useState([])
  const [allActivities, setAllActivities] = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    async function load() {
      const [progRes, actRes] = await Promise.all([
        supabase
          .from('programs')
          .select('id, name, status, start_date, stage, created_at, activities(id, status, daily_cost, duration_days, cost_type)')
          .order('name', { ascending: true }),
        supabase
          .from('activities')
          .select('id, name, status, start_date, end_date, duration_days, program_id, responsible:participants(name), programs!inner(name)')
          .order('end_date', { ascending: true }),
      ])

      if (progRes.data) setPrograms(progRes.data)
      if (actRes.data) setAllActivities(actRes.data)
      setLoading(false)
    }
    load()
  }, [])

  function toggleStage(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Group programs by stage
  const grouped = STAGE_CONFIG.map(stage => ({
    ...stage,
    programs: programs.filter(p => p.stage === stage.key),
  })).filter(g => g.programs.length > 0)

  const ungrouped = programs.filter(p => !STAGE_CONFIG.some(s => s.key === p.stage))

  // Global stats
  const totalBudget = programs.reduce((sum, p) =>
    sum + (p.activities?.reduce((s, a) => {
      if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
      return s + (a.daily_cost || 0) * (a.duration_days || 1)
    }, 0) ?? 0)
  , 0)

  // Activity stats
  const allActs = programs.flatMap(p => p.activities || [])
  const actStats = {
    total:       allActs.length,
    pending:     allActs.filter(a => a.status === 'pending').length,
    in_progress: allActs.filter(a => a.status === 'in_progress').length,
    delivered:   allActs.filter(a => a.status === 'delivered').length,
    blocked:     allActs.filter(a => a.status === 'blocked').length,
  }

  // Urgent activities: blocked + overdue + upcoming (7 days)
  const today = new Date()
  const blocked = allActivities.filter(a => a.status === 'blocked')
  const overdue = allActivities.filter(a =>
    a.status !== 'delivered' && a.status !== 'blocked' && a.end_date &&
    differenceInCalendarDays(parseISO(a.end_date), today) < 0
  )
  const upcoming = allActivities.filter(a => {
    if (a.status === 'delivered' || a.status === 'blocked') return false
    if (!a.end_date) return false
    const diff = differenceInCalendarDays(parseISO(a.end_date), today)
    return diff >= 0 && diff <= 7
  })

  if (loading) return <PageLoading />

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Dashboard"
        subtitle="Vista general de todos los programas de producción"
        action={
          <Link
            to="/programas/nuevo"
            className="flex items-center gap-2 bg-[#1a1a1a] text-white text-sm
                       px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus size={16} />
            Nuevo programa
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Programs */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Film size={18} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Programas</span>
          </div>
          <div className="text-2xl font-semibold text-[#1a1a1a] mb-2">{programs.length}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {grouped.map(({ key, label, bg, programs: sp }) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${bg}`} />
                <span className="text-[10px] text-gray-500">{sp.length} {label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign size={18} className="text-green-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Presupuesto total</span>
          </div>
          <div className="text-2xl font-semibold text-[#1a1a1a]">{fmtMXN(totalBudget)}</div>
        </div>

        {/* Activities */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <ListChecks size={18} className="text-blue-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actividades</span>
          </div>
          <div className="text-2xl font-semibold text-[#1a1a1a] mb-2">{actStats.total}</div>
          {actStats.total > 0 ? (
            <>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex mb-2">
                {actStats.delivered > 0 && (
                  <div className="bg-green-500 h-full" style={{ width: `${(actStats.delivered / actStats.total) * 100}%` }} />
                )}
                {actStats.in_progress > 0 && (
                  <div className="bg-blue-500 h-full" style={{ width: `${(actStats.in_progress / actStats.total) * 100}%` }} />
                )}
                {actStats.blocked > 0 && (
                  <div className="bg-red-500 h-full" style={{ width: `${(actStats.blocked / actStats.total) * 100}%` }} />
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{actStats.delivered} entregadas
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{actStats.in_progress} en proceso
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{actStats.pending} pendientes
                </span>
                {actStats.blocked > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{actStats.blocked} bloqueadas
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-gray-400">Sin actividades aún</div>
          )}
        </div>
      </div>

      {/* Alerts section: blocked, overdue, upcoming */}
      {(blocked.length > 0 || overdue.length > 0 || upcoming.length > 0) && (
        <div className="mb-6 space-y-3">
          {/* Blocked */}
          {blocked.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  Bloqueadas ({blocked.length})
                </span>
              </div>
              <div className="space-y-1">
                {blocked.slice(0, 5).map(a => (
                  <ActivityAlertRow key={a.id} activity={a} color="text-red-700" />
                ))}
                {blocked.length > 5 && (
                  <p className="text-[10px] text-red-400 pt-1">+ {blocked.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Vencidas ({overdue.length})
                </span>
              </div>
              <div className="space-y-1">
                {overdue.slice(0, 5).map(a => {
                  const days = Math.abs(differenceInCalendarDays(parseISO(a.end_date), today))
                  return (
                    <ActivityAlertRow key={a.id} activity={a} color="text-amber-800"
                      extra={<span className="text-[10px] text-amber-500 font-medium">{days}d vencida</span>} />
                  )
                })}
                {overdue.length > 5 && (
                  <p className="text-[10px] text-amber-400 pt-1">+ {overdue.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Próximas a vencer ({upcoming.length})
                </span>
              </div>
              <div className="space-y-1">
                {upcoming.slice(0, 5).map(a => {
                  const days = differenceInCalendarDays(parseISO(a.end_date), today)
                  return (
                    <ActivityAlertRow key={a.id} activity={a} color="text-blue-700"
                      extra={<span className="text-[10px] text-blue-400">{days === 0 ? 'Hoy' : `${days}d`}</span>} />
                  )
                })}
                {upcoming.length > 5 && (
                  <p className="text-[10px] text-blue-400 pt-1">+ {upcoming.length - 5} más</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stage sections */}
      {programs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ key, label, icon: Icon, bg, bgLight, iconColor, border, programs: stagePrograms }) => (
            <div key={key} className={`bg-white border ${border} rounded-xl overflow-hidden`}>
              <button
                onClick={() => toggleStage(key)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/50"
              >
                <div className={`w-9 h-9 rounded-lg ${bgLight} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#1a1a1a]">{label}</span>
                    <div className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center`}>
                      <span className="text-[10px] font-bold text-white">{stagePrograms.length}</span>
                    </div>
                  </div>
                  <StageProgressBar programs={stagePrograms} />
                </div>
                <div className="text-right mr-2">
                  <div className="text-xs text-gray-400">Presupuesto</div>
                  <div className="text-sm font-medium text-gray-700">
                    {fmtMXN(stagePrograms.reduce((sum, p) =>
                      sum + (p.activities?.reduce((s, a) => {
                        if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
                        return s + (a.daily_cost || 0) * (a.duration_days || 1)
                      }, 0) ?? 0)
                    , 0))}
                  </div>
                </div>
                {expanded[key]
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {expanded[key] && (
                <div className="border-t border-gray-100 bg-[#fafaf8]">
                  {stagePrograms.map((program, i) => (
                    <ProgramRow key={program.id} program={program} last={i === stagePrograms.length - 1} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {ungrouped.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleStage('_other')}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Film size={18} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#1a1a1a]">Sin etapa</span>
                    <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{ungrouped.length}</span>
                    </div>
                  </div>
                </div>
                {expanded['_other']
                  ? <ChevronDown size={16} className="text-gray-400" />
                  : <ChevronRight size={16} className="text-gray-400" />
                }
              </button>
              {expanded['_other'] && (
                <div className="border-t border-gray-100 bg-[#fafaf8]">
                  {ungrouped.map((program, i) => (
                    <ProgramRow key={program.id} program={program} last={i === ungrouped.length - 1} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* Activity alert row */
function ActivityAlertRow({ activity, color, extra }) {
  const programName = activity.programs?.name || '—'
  return (
    <Link
      to={`/programas/${activity.program_id}`}
      className={`flex items-center gap-3 text-xs ${color} hover:underline`}
    >
      <span className="font-medium truncate">{activity.name}</span>
      <span className="text-[10px] text-gray-400 flex-shrink-0">— {programName}</span>
      {activity.responsible?.name && (
        <span className="text-[10px] text-gray-400 flex-shrink-0">· {activity.responsible.name}</span>
      )}
      {extra}
    </Link>
  )
}

/* Mini progress bar for stage card header */
function StageProgressBar({ programs }) {
  const totalActs = programs.reduce((s, p) => s + (p.activities?.length || 0), 0)
  const delivered = programs.reduce((s, p) =>
    s + (p.activities?.filter(a => a.status === 'delivered').length || 0), 0)
  const inProgress = programs.reduce((s, p) =>
    s + (p.activities?.filter(a => a.status === 'in_progress').length || 0), 0)

  if (totalActs === 0) {
    return <div className="text-[10px] text-gray-400 mt-0.5">Sin actividades aún</div>
  }

  const pctDone = (delivered / totalActs) * 100
  const pctProg = (inProgress / totalActs) * 100

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[180px]">
        <div className="h-full flex">
          <div className="bg-green-500 rounded-l-full" style={{ width: `${pctDone}%` }} />
          <div className="bg-blue-500" style={{ width: `${pctProg}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-gray-400">{delivered}/{totalActs} entregadas</span>
    </div>
  )
}

function ProgramRow({ program, last }) {
  const { activities = [] } = program
  const total     = activities.length
  const delivered = activities.filter(a => a.status === 'delivered').length
  const progress  = total > 0 ? Math.round((delivered / total) * 100) : 0
  const budget    = activities.reduce((s, a) => {
    if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
    return s + (a.daily_cost || 0) * (a.duration_days || 1)
  }, 0)
  const statusCfg = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active

  return (
    <Link
      to={`/programas/${program.id}`}
      className={`flex items-center gap-5 px-5 py-3 hover:bg-[#f0efeb] transition-colors group
                  ${!last ? 'border-b border-gray-100' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-[#1a1a1a] truncate text-sm">{program.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
          <Calendar size={10} />
          <span>{fmtDate(program.start_date)}</span>
        </div>
      </div>

      {total > 0 ? (
        <div className="w-28">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>{delivered}/{total}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#1a1a1a] rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <span className="text-[10px] text-gray-400 w-28">Sin actividades</span>
      )}

      <div className="text-right w-24">
        <div className="text-sm font-medium text-gray-600">{fmtMXN(budget)}</div>
      </div>

      <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <Film size={40} className="text-gray-300 mx-auto mb-4" />
      <h3 className="text-sm font-medium text-gray-500 mb-2">Sin programas todavía</h3>
      <p className="text-xs text-gray-400 mb-6">Crea tu primer programa de producción para empezar.</p>
      <Link
        to="/programas/nuevo"
        className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-sm
                   px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
      >
        <Plus size={15} />
        Nuevo programa
      </Link>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  )
}
