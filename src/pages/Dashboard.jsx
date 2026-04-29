import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useStages } from '../hooks/useStages'
import { useProgramAccess } from '../hooks/useProgramAccess'
import { PageHeader } from '../components/Layout'
import BrandHero from '../components/BrandHero'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS, STATUS_LABELS } from '../lib/utils'
import { exportTodoDocx } from '../lib/exportTodoDocx'
import {
  Film, Plus, ArrowRight, DollarSign, Calendar,
  ChevronDown, ChevronRight,
  ListChecks, AlertCircle, Clock, CheckCircle2, Circle,
  FileDown
} from 'lucide-react'
import { parseISO, differenceInCalendarDays } from 'date-fns'

const STATUS_ICONS = {
  pending:     <Circle size={12} className="text-sf-lavender" />,
  in_progress: <Clock size={12} style={{ color: '#4B52EB' }} />,
  delivered:   <CheckCircle2 size={12} style={{ color: '#D0ED40' }} />,
  blocked:     <AlertCircle size={12} style={{ color: '#F92D97' }} />,
}

export default function Dashboard() {
  const [programs, setPrograms] = useState([])
  const [allActivities, setAllActivities] = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})
  const [exportingTodo, setExportingTodo] = useState(false)

  const { activeOrg, isAdmin } = useOrg()
  const { stages: STAGE_CONFIG } = useStages()
  const { memberPrograms, isAdmin: isProgramAdmin } = useProgramAccess()

  useEffect(() => {
    async function load() {
      let progQuery = supabase
        .from('programs')
        .select('id, name, status, start_date, stage, created_at, actual_cost, estimated_cost, cost_category_id, cost_categories(estimated_cost), activities(id, status, daily_cost, duration_days, cost_type)')
        .order('name', { ascending: true })

      let actQuery = supabase
        .from('activities')
        .select('id, name, status, start_date, end_date, duration_days, program_id, responsible:participants(name), programs!inner(name)')
        .order('end_date', { ascending: true })

      // Filter by org if available
      if (activeOrg?.id) {
        progQuery = progQuery.eq('org_id', activeOrg.id)
      }

      const [progRes, actRes] = await Promise.all([progQuery, actQuery])

      let progs = progRes.data || []
      let acts = actRes.data || []

      // Filter activities to only those belonging to org's programs
      if (activeOrg?.id) {
        if (progs.length > 0) {
          const progIds = new Set(progs.map(p => p.id))
          acts = acts.filter(a => progIds.has(a.program_id))
        } else {
          acts = []
        }
      }

      // If user is not an org admin, filter to only programs they're a member of
      if (!isProgramAdmin && memberPrograms.length > 0) {
        const accessibleProgIds = new Set(memberPrograms)
        progs = progs.filter(p => accessibleProgIds.has(p.id))
        acts = acts.filter(a => accessibleProgIds.has(a.program_id))
      }

      setPrograms(progs)
      setAllActivities(acts)
      setLoading(false)
    }
    load()
  }, [activeOrg?.id, isProgramAdmin, memberPrograms])

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
  // Costo de un programa: actual_cost > categoría estimada > suma de actividades
  function programCost(p) {
    if (p.actual_cost) return Number(p.actual_cost)
    if (p.cost_categories?.estimated_cost) return Number(p.cost_categories.estimated_cost)
    // Fallback: sumar costos de actividades
    return (p.activities?.reduce((s, a) => {
      if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
      return s + (a.daily_cost || 0) * (a.duration_days || 1)
    }, 0) ?? 0)
  }
  const totalBudget = programs.reduce((sum, p) => sum + programCost(p), 0)

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
      <BrandHero
        subtitle={`${programs.length} ${programs.length === 1 ? 'programa activo' : 'programas activos'}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (exportingTodo) return
                setExportingTodo(true)
                try { await exportTodoDocx(activeOrg?.id, activeOrg?.name) }
                catch (e) { console.error('TODO export error:', e) }
                setExportingTodo(false)
              }}
              disabled={exportingTodo}
              className="flex items-center gap-2 text-sf-cream text-sm
                         px-4 py-2.5 rounded-md transition-colors font-medium font-mono disabled:opacity-50"
              style={{ background: 'rgba(199,191,239,0.08)', border: '1px solid rgba(199,191,239,0.15)' }}
            >
              <FileDown size={16} />
              <span className="hidden sm:inline">{exportingTodo ? 'Generando...' : 'TODO List'}</span>
            </button>
            <Link
              to="/programas/nuevo"
              className="flex items-center gap-2 text-sf-cream text-sm
                         px-4 py-2.5 rounded-md transition-colors font-medium backdrop-blur-sm"
              style={{ background: 'rgba(199,191,239,0.08)', border: '1px solid rgba(199,191,239,0.15)' }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo programa</span>
            </Link>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {/* Programs */}
        <div className="bg-sf-surface rounded-lg p-3.5 sm:p-5" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Film size={16} className="text-sf-muted sm:w-[18px] sm:h-[18px]" />
            <span className="text-[10px] sm:text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Programas</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-sf-cream mb-1.5 sm:mb-2 font-display">{programs.length}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {grouped.map(({ key, label, bg, programs: sp }) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${bg}`} />
                <span className="text-[10px] text-sf-muted font-mono">{sp.length} {label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-sf-surface rounded-lg p-3.5 sm:p-5" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <DollarSign size={16} style={{ color: '#D0ED40' }} />
            <span className="text-[10px] sm:text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Presupuesto total</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-sf-cream font-display">{fmtMXN(totalBudget)}</div>
        </div>

        {/* Activities */}
        <div className="bg-sf-surface rounded-lg p-3.5 sm:p-5 col-span-2 sm:col-span-1" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <ListChecks size={16} style={{ color: '#4B52EB' }} />
            <span className="text-[10px] sm:text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Actividades</span>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-sf-cream mb-1.5 sm:mb-2 font-display">{actStats.total}</div>
          {actStats.total > 0 ? (
            <>
              <div className="h-2 rounded-full overflow-hidden flex mb-2" style={{ background: 'rgba(199,191,239,0.06)' }}>
                {actStats.delivered > 0 && (
                  <div className="h-full" style={{ width: `${(actStats.delivered / actStats.total) * 100}%`, background: '#D0ED40' }} />
                )}
                {actStats.in_progress > 0 && (
                  <div className="h-full" style={{ width: `${(actStats.in_progress / actStats.total) * 100}%`, background: '#4B52EB' }} />
                )}
                {actStats.blocked > 0 && (
                  <div className="h-full" style={{ width: `${(actStats.blocked / actStats.total) * 100}%`, background: '#F92D97' }} />
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-1 text-[10px] text-sf-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#D0ED40' }} />{actStats.delivered} entregadas
                </span>
                <span className="flex items-center gap-1 text-[10px] text-sf-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4B52EB' }} />{actStats.in_progress} en proceso
                </span>
                <span className="flex items-center gap-1 text-[10px] text-sf-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-sf-lavender" />{actStats.pending} pendientes
                </span>
                {actStats.blocked > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium font-mono" style={{ color: '#F92D97' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F92D97' }} />{actStats.blocked} bloqueadas
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-sf-muted font-mono">Sin actividades aún</div>
          )}
        </div>
      </div>

      {/* Alerts section: blocked, overdue, upcoming */}
      {(blocked.length > 0 || overdue.length > 0 || upcoming.length > 0) && (
        <div className="mb-6 space-y-3">
          {/* Blocked */}
          {blocked.length > 0 && (
            <div className="rounded-lg px-4 sm:px-5 py-3" style={{ background: 'rgba(249,45,151,0.06)', border: '1px solid rgba(249,45,151,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} style={{ color: '#F92D97' }} />
                <span className="text-xs font-semibold uppercase tracking-wide font-mono" style={{ color: '#F92D97' }}>
                  Bloqueadas ({blocked.length})
                </span>
              </div>
              <div className="space-y-1">
                {blocked.slice(0, 5).map(a => (
                  <ActivityAlertRow key={a.id} activity={a} colorStyle={{ color: '#F92D97' }} />
                ))}
                {blocked.length > 5 && (
                  <p className="text-[10px] pt-1" style={{ color: 'rgba(249,45,151,0.5)' }}>+ {blocked.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="rounded-lg px-4 sm:px-5 py-3" style={{ background: 'rgba(208,237,64,0.06)', border: '1px solid rgba(208,237,64,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} style={{ color: '#D0ED40' }} />
                <span className="text-xs font-semibold uppercase tracking-wide font-mono" style={{ color: '#D0ED40' }}>
                  Vencidas ({overdue.length})
                </span>
              </div>
              <div className="space-y-1">
                {overdue.slice(0, 5).map(a => {
                  const days = Math.abs(differenceInCalendarDays(parseISO(a.end_date), today))
                  return (
                    <ActivityAlertRow key={a.id} activity={a} colorStyle={{ color: '#D0ED40' }}
                      extra={<span className="text-[10px] font-medium" style={{ color: 'rgba(208,237,64,0.7)' }}>{days}d vencida</span>} />
                  )
                })}
                {overdue.length > 5 && (
                  <p className="text-[10px] pt-1" style={{ color: 'rgba(208,237,64,0.5)' }}>+ {overdue.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="rounded-lg px-4 sm:px-5 py-3" style={{ background: 'rgba(75,82,235,0.06)', border: '1px solid rgba(75,82,235,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} style={{ color: '#4B52EB' }} />
                <span className="text-xs font-semibold uppercase tracking-wide font-mono" style={{ color: '#4B52EB' }}>
                  Próximas a vencer ({upcoming.length})
                </span>
              </div>
              <div className="space-y-1">
                {upcoming.slice(0, 5).map(a => {
                  const days = differenceInCalendarDays(parseISO(a.end_date), today)
                  return (
                    <ActivityAlertRow key={a.id} activity={a} colorStyle={{ color: '#4B52EB' }}
                      extra={<span className="text-[10px]" style={{ color: 'rgba(75,82,235,0.7)' }}>{days === 0 ? 'Hoy' : `${days}d`}</span>} />
                  )
                })}
                {upcoming.length > 5 && (
                  <p className="text-[10px] pt-1" style={{ color: 'rgba(75,82,235,0.5)' }}>+ {upcoming.length - 5} más</p>
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
            <div key={key} className="bg-sf-surface rounded-xl overflow-hidden" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
              <button
                onClick={() => toggleStage(key)}
                className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 text-left transition-colors"
                style={{ '--tw-hover-bg': 'rgba(199,191,239,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${bgLight} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-sm font-semibold text-sf-cream truncate font-display">{label}</span>
                    <div className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-[10px] font-bold text-white">{stagePrograms.length}</span>
                    </div>
                  </div>
                  <StageProgressBar programs={stagePrograms} />
                </div>
                <div className="hidden sm:block text-right mr-2">
                  <div className="text-xs text-sf-muted font-mono">Presupuesto</div>
                  <div className="text-sm font-medium font-mono" style={{ color: 'rgba(240,231,228,0.5)' }}>
                    {fmtMXN(stagePrograms.reduce((sum, p) => sum + programCost(p), 0))}
                  </div>
                </div>
                {expanded[key]
                  ? <ChevronDown size={16} className="text-sf-muted flex-shrink-0" />
                  : <ChevronRight size={16} className="text-sf-muted flex-shrink-0" />
                }
              </button>

              {expanded[key] && (
                <div style={{ borderTop: '1px solid rgba(199,191,239,0.06)', background: 'rgba(199,191,239,0.02)' }}>
                  {stagePrograms.map((program, i) => (
                    <ProgramRow key={program.id} program={program} last={i === stagePrograms.length - 1} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {ungrouped.length > 0 && (
            <div className="bg-sf-surface rounded-xl overflow-hidden" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
              <button
                onClick={() => toggleStage('_other')}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(199,191,239,0.06)' }}>
                  <Film size={18} className="text-sf-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-sf-cream font-display">Sin etapa</span>
                    <div className="w-5 h-5 rounded-full bg-sf-lavender flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{ungrouped.length}</span>
                    </div>
                  </div>
                </div>
                {expanded['_other']
                  ? <ChevronDown size={16} className="text-sf-muted" />
                  : <ChevronRight size={16} className="text-sf-muted" />
                }
              </button>
              {expanded['_other'] && (
                <div style={{ borderTop: '1px solid rgba(199,191,239,0.06)', background: 'rgba(199,191,239,0.02)' }}>
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
function ActivityAlertRow({ activity, colorStyle, extra }) {
  const programName = activity.programs?.name || '—'
  return (
    <Link
      to={`/programas/${activity.program_id}`}
      className="flex items-center gap-2 sm:gap-3 text-xs hover:underline py-1 active:opacity-70"
      style={colorStyle}
    >
      <span className="font-medium truncate min-w-0">{activity.name}</span>
      <span className="text-[10px] text-sf-muted flex-shrink-0 hidden sm:inline">— {programName}</span>
      {activity.responsible?.name && (
        <span className="text-[10px] text-sf-muted flex-shrink-0 hidden sm:inline">· {activity.responsible.name}</span>
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
    return <div className="text-[10px] text-sf-muted mt-0.5 font-mono">Sin actividades aún</div>
  }

  const pctDone = (delivered / totalActs) * 100
  const pctProg = (inProgress / totalActs) * 100

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[180px]" style={{ background: 'rgba(199,191,239,0.06)' }}>
        <div className="h-full flex">
          <div className="rounded-l-full" style={{ width: `${pctDone}%`, background: '#D0ED40' }} />
          <div style={{ width: `${pctProg}%`, background: '#4B52EB' }} />
        </div>
      </div>
      <span className="text-[10px] text-sf-muted font-mono">{delivered}/{totalActs} entregadas</span>
    </div>
  )
}

function ProgramRow({ program, last }) {
  const { activities = [] } = program
  const total     = activities.length
  const delivered = activities.filter(a => a.status === 'delivered').length
  const progress  = total > 0 ? Math.round((delivered / total) * 100) : 0
  const budget = program.actual_cost ? Number(program.actual_cost)
    : program.cost_categories?.estimated_cost ? Number(program.cost_categories.estimated_cost)
    : activities.reduce((s, a) => {
        if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
        return s + (a.daily_cost || 0) * (a.duration_days || 1)
      }, 0)
  const statusCfg = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active

  return (
    <Link
      to={`/programas/${program.id}`}
      className={`block sm:flex sm:items-center gap-3 sm:gap-5 px-4 sm:px-5 py-3 transition-colors group`}
      style={!last ? { borderBottom: '1px solid rgba(199,191,239,0.06)' } : undefined}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {/* Top row: name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sf-cream truncate text-sm">{program.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <ArrowRight size={14} className="text-sf-muted group-hover:text-sf-cream transition-colors flex-shrink-0 ml-auto sm:hidden" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-sf-muted mt-0.5 font-mono">
          <Calendar size={10} />
          <span>{fmtDate(program.start_date)}</span>
        </div>
      </div>

      {/* Bottom row on mobile: progress + budget inline */}
      <div className="flex items-center gap-3 mt-2 sm:mt-0 sm:contents">
        {total > 0 ? (
          <div className="flex-1 sm:flex-none sm:w-28">
            <div className="flex justify-between text-[10px] text-sf-muted mb-1 font-mono">
              <span>{delivered}/{total}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(199,191,239,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#D0ED40' }} />
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-sf-muted flex-1 sm:flex-none sm:w-28 font-mono">Sin actividades</span>
        )}

        <div className="text-right flex-shrink-0">
          <div className="text-xs sm:text-sm font-medium font-mono" style={{ color: 'rgba(240,231,228,0.5)' }}>{fmtMXN(budget)}</div>
        </div>
      </div>

      <ArrowRight size={14} className="text-sf-muted group-hover:text-sf-cream transition-colors flex-shrink-0 hidden sm:block" />
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <Film size={40} className="text-sf-muted mx-auto mb-4" />
      <h3 className="text-sm font-medium text-sf-muted mb-2 font-display">Sin programas todavía</h3>
      <p className="text-xs text-sf-muted mb-6 font-mono">Crea tu primer programa de producción para empezar.</p>
      <Link
        to="/programas/nuevo"
        className="inline-flex items-center gap-2 text-white text-sm
                   px-4 py-2.5 rounded-md transition-colors"
        style={{ background: '#F92D97' }}
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
        <div className="h-8 rounded w-1/4" style={{ background: 'rgba(199,191,239,0.08)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg" style={{ background: 'rgba(199,191,239,0.08)' }} />)}
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: 'rgba(199,191,239,0.08)' }} />)}
      </div>
    </div>
  )
}
