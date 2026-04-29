import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useStages } from '../hooks/useStages'
import { PageHeader } from '../components/Layout'
import { STATUS_LABELS, PROGRAM_STATUS_LABELS, fmtDate, fmtMXN } from '../lib/utils'
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileText, Printer, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Circle,
  TrendingUp, AlertTriangle, CalendarClock, Filter
} from 'lucide-react'

const STATUS_COLORS = {
  pending:     { bg: 'rgba(199,191,239,0.08)', text: '#C7BFEF',  dot: '#C7BFEF'  },
  in_progress: { bg: 'rgba(75,82,235,0.1)',    text: '#4B52EB',  dot: '#4B52EB'  },
  delivered:   { bg: 'rgba(208,237,64,0.1)',   text: '#D0ED40',  dot: '#D0ED40'  },
  blocked:     { bg: 'rgba(249,45,151,0.1)',   text: '#F92D97',  dot: '#F92D97'  },
}

const STATUS_ICONS = {
  pending:     <Circle size={13} style={{ color: '#C7BFEF' }} />,
  in_progress: <Clock size={13} style={{ color: '#4B52EB' }} />,
  delivered:   <CheckCircle2 size={13} style={{ color: '#D0ED40' }} />,
  blocked:     <AlertCircle size={13} style={{ color: '#F92D97' }} />,
}

export default function StatusReport() {
  const { activeOrg } = useOrg()
  const { stages: orgStages, stageKeys } = useStages()
  const [programs, setPrograms] = useState([])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})
  const [stageFilters, setStageFilters] = useState({})
  const [onlyActive, setOnlyActive] = useState(true)

  // Init stage filters when org stages load
  useEffect(() => {
    if (stageKeys.length > 0 && Object.keys(stageFilters).length === 0) {
      setStageFilters(stageKeys.reduce((acc, k) => { acc[k] = true; return acc }, {}))
    }
  }, [stageKeys])

  useEffect(() => { load() }, [activeOrg?.id])

  async function load() {
    let progQuery = supabase
      .from('programs')
      .select(`
        id, name, status, start_date, stage,
        activities(id, name, status, start_date, end_date, duration_days,
                   daily_cost, cost_type, notes,
                   responsible:participants(id, name))
        `)
      .order('start_date', { ascending: true })

    if (activeOrg?.id) {
      progQuery = progQuery.eq('org_id', activeOrg.id)
    }

    const [progRes, logRes] = await Promise.all([
      progQuery,
      supabase
        .from('activity_log')
        .select('id, activity_id, field_changed, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (progRes.data) {
      setPrograms(progRes.data)
      const exp = {}
      progRes.data.forEach(p => { exp[p.id] = true })
      setExpanded(exp)
    }
    setLogs(logRes.data ?? [])
    setLoading(false)
  }

  if (loading) return <PageLoading />

  const today = startOfDay(new Date())
  const reportDate = format(today, "EEEE d 'de' MMMM, yyyy", { locale: es })

  /* ---- Métricas globales ---- */
  const allActs     = programs.flatMap(p => p.activities ?? [])
  const totalActs   = allActs.length
  const delivered   = allActs.filter(a => a.status === 'delivered').length
  const inProgress  = allActs.filter(a => a.status === 'in_progress').length
  const blocked     = allActs.filter(a => a.status === 'blocked').length
  const pending     = allActs.filter(a => a.status === 'pending').length
  const overallPct  = totalActs > 0 ? Math.round((delivered / totalActs) * 100) : 0

  /* ---- Próximos vencimientos (7 días) ---- */
  const upcoming = allActs
    .filter(a => a.end_date && a.status !== 'delivered')
    .filter(a => {
      const diff = differenceInDays(parseISO(a.end_date), today)
      return diff >= 0 && diff <= 7
    })
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  /* ---- Actividades vencidas ---- */
  const overdue = allActs
    .filter(a => a.end_date && a.status !== 'delivered')
    .filter(a => differenceInDays(parseISO(a.end_date), today) < 0)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  /* ---- Helper: encontrar programa de una actividad ---- */
  function programForAct(actId) {
    return programs.find(p => (p.activities ?? []).some(a => a.id === actId))
  }

  /* ---- Filtrar programas ---- */
  const STAGE_OPTIONS = orgStages.map(s => ({ key: s.key, label: s.label }))

  const filteredPrograms = programs.filter(p => {
    // Stage filter
    if (p.stage && !stageFilters[p.stage]) return false
    if (!p.stage && stageKeys[0] && !stageFilters[stageKeys[0]]) return false
    // Only active filter
    if (onlyActive) {
      const acts = p.activities ?? []
      return acts.some(a => a.status === 'in_progress' || a.status === 'blocked' || a.status === 'pending')
    }
    return true
  })

  function toggleStageFilter(key) {
    setStageFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function selectAllStages() {
    const allOn = Object.values(stageFilters).every(v => v)
    const next = {}
    for (const k of Object.keys(stageFilters)) next[k] = !allOn
    setStageFilters(next)
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" id="status-report">
      {/* Print header — una sola línea */}
      <div className="hidden print:block print-header mb-6">
        <div className="flex items-center py-3 px-5 rounded-lg"
             style={{ backgroundColor: '#1c1a1b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div className="flex items-center gap-2">
            <img src="/capro-iso.svg" alt="CAPRO" className="w-5 h-5" />
            <span className="text-white text-[11px] tracking-[3px] uppercase font-mono">
              SIPRO<span className="font-bold">FILM</span>
            </span>
          </div>
          <span className="text-white text-xs font-semibold mx-auto font-display">Reporte de Status</span>
          <span className="text-white/60 text-[11px] font-mono">{reportDate}</span>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Reporte de Status"
          subtitle={reportDate}
          action={
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-sm rounded-md px-4 py-2 transition-all font-mono"
              style={{
                border: '1px solid rgba(199,191,239,0.08)',
                color: 'rgba(240,231,228,0.6)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
          }
        />
      </div>

      {/* Filtros — solo en pantalla */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'rgba(240,231,228,0.4)' }} />
          <span className="text-xs font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Filtrar:</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg p-1"
             style={{ background: '#1c1a1b', border: '1px solid rgba(199,191,239,0.08)' }}>
          <button
            onClick={selectAllStages}
            className="px-2.5 py-1 text-[10px] rounded-md transition-colors font-mono"
            style={
              Object.values(stageFilters).every(v => v)
                ? { background: '#F92D97', color: '#fff', fontWeight: 500 }
                : { color: 'rgba(240,231,228,0.4)' }
            }
            onMouseEnter={e => {
              if (!Object.values(stageFilters).every(v => v)) e.currentTarget.style.background = 'rgba(199,191,239,0.04)'
            }}
            onMouseLeave={e => {
              if (!Object.values(stageFilters).every(v => v)) e.currentTarget.style.background = 'transparent'
            }}
          >
            Todas
          </button>
          {STAGE_OPTIONS.map(({ key, label }) => {
            const count = programs.filter(p => p.stage === key).length
            if (count === 0) return null
            return (
              <button
                key={key}
                onClick={() => toggleStageFilter(key)}
                className="px-2.5 py-1 text-[10px] rounded-md transition-colors whitespace-nowrap font-mono"
                style={
                  stageFilters[key]
                    ? { background: '#F92D97', color: '#fff', fontWeight: 500 }
                    : { color: 'rgba(240,231,228,0.4)' }
                }
                onMouseEnter={e => {
                  if (!stageFilters[key]) e.currentTarget.style.background = 'rgba(199,191,239,0.04)'
                }}
                onMouseLeave={e => {
                  if (!stageFilters[key]) e.currentTarget.style.background = 'transparent'
                }}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={e => setOnlyActive(e.target.checked)}
            className="rounded"
            style={{ accentColor: '#F92D97' }}
          />
          <span className="text-[10px] font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Solo con actividad</span>
        </label>
        <span className="text-[10px] ml-auto font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>
          {filteredPrograms.length} de {programs.length} proyectos
        </span>
      </div>

      {/* ====== RESUMEN GENERAL ====== */}
      <section className="mb-10">
        <SectionTitle icon={<TrendingUp size={16} />} title="Resumen General" />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <MetricCard label="Proyectos" value={programs.length} />
          <MetricCard label="Completadas" value={delivered} sub={`de ${totalActs}`} color="green" />
          <MetricCard label="En proceso" value={inProgress} color="blue" />
          <MetricCard label="Bloqueadas" value={blocked} color="red" />
          <MetricCard label="Avance total" value={`${overallPct}%`} />
        </div>

        {/* Barra de avance */}
        <div className="rounded-lg p-5"
             style={{ background: '#1c1a1b', border: '1px solid rgba(199,191,239,0.08)' }}>
          <div className="flex justify-between text-xs mb-2 font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>
            <span>Progreso general</span>
            <span>{delivered}/{totalActs} actividades completadas</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(199,191,239,0.08)' }}>
            {delivered > 0 && (
              <div className="h-full transition-all"
                   style={{ width: `${(delivered / totalActs) * 100}%`, background: '#D0ED40' }} />
            )}
            {inProgress > 0 && (
              <div className="h-full transition-all"
                   style={{ width: `${(inProgress / totalActs) * 100}%`, background: '#4B52EB' }} />
            )}
            {blocked > 0 && (
              <div className="h-full transition-all"
                   style={{ width: `${(blocked / totalActs) * 100}%`, background: '#F92D97' }} />
            )}
          </div>
          <div className="flex gap-6 mt-3">
            <LegendDot color="#D0ED40" label={`Completadas (${delivered})`} />
            <LegendDot color="#4B52EB" label={`En proceso (${inProgress})`} />
            <LegendDot color="#F92D97" label={`Bloqueadas (${blocked})`} />
            <LegendDot color="#C7BFEF" label={`Pendientes (${pending})`} />
          </div>
        </div>
      </section>

      {/* ====== ALERTAS: VENCIDAS + PRÓXIMAS ====== */}
      {(overdue.length > 0 || upcoming.length > 0) && (
        <section className="mb-10">
          <SectionTitle icon={<AlertTriangle size={16} />} title="Alertas" />

          {overdue.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 font-mono"
                 style={{ color: '#F92D97' }}>
                Vencidas ({overdue.length})
              </p>
              <div className="space-y-1.5">
                {overdue.map(a => {
                  const prog = programForAct(a.id)
                  const days = Math.abs(differenceInDays(parseISO(a.end_date), today))
                  return (
                    <AlertRow key={a.id}
                      color="red"
                      program={prog?.name}
                      activity={a.name}
                      responsible={a.responsible?.name}
                      detail={`Venció hace ${days} día${days > 1 ? 's' : ''} · ${fmtDate(a.end_date)}`}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 font-mono"
                 style={{ color: '#C7BFEF' }}>
                Vencen esta semana ({upcoming.length})
              </p>
              <div className="space-y-1.5">
                {upcoming.map(a => {
                  const prog = programForAct(a.id)
                  const days = differenceInDays(parseISO(a.end_date), today)
                  return (
                    <AlertRow key={a.id}
                      color="amber"
                      program={prog?.name}
                      activity={a.name}
                      responsible={a.responsible?.name}
                      detail={days === 0 ? 'Vence hoy' : `Vence en ${days} día${days > 1 ? 's' : ''} · ${fmtDate(a.end_date)}`}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ====== DETALLE POR PROYECTO ====== */}
      <section className="mb-10">
        <SectionTitle icon={<FileText size={16} />} title="Detalle por Proyecto" />

        <div className="space-y-4">
          {filteredPrograms.map(prog => {
            const acts      = prog.activities ?? []
            const pDone     = acts.filter(a => a.status === 'delivered').length
            const pBlocked  = acts.filter(a => a.status === 'blocked').length
            const pProg     = acts.filter(a => a.status === 'in_progress').length
            const pPending  = acts.filter(a => a.status === 'pending').length
            const pPct      = acts.length > 0 ? Math.round((pDone / acts.length) * 100) : 0
            const isOpen    = expanded[prog.id]
            const statusCfg = PROGRAM_STATUS_LABELS[prog.status] ?? PROGRAM_STATUS_LABELS.active

            // Logs de este programa
            const actIds = new Set(acts.map(a => a.id))
            const progLogs = logs.filter(l => actIds.has(l.activity_id))

            return (
              <div key={prog.id} className="rounded-lg overflow-hidden"
                   style={{ background: '#1c1a1b', border: '1px solid rgba(199,191,239,0.08)' }}>
                {/* Header del programa */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors select-none"
                  onClick={() => setExpanded(e => ({ ...e, [prog.id]: !e[prog.id] }))}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: 'rgba(240,231,228,0.4)' }}>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-sf-cream font-display">{prog.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-mono ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {prog.stage && (
                        <span className="text-xs capitalize font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{prog.stage}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs font-mono">
                    <span className="font-medium" style={{ color: '#D0ED40' }}>{pDone} ok</span>
                    <span className="font-medium" style={{ color: '#4B52EB' }}>{pProg} proc.</span>
                    {pBlocked > 0 && <span className="font-semibold" style={{ color: '#F92D97' }}>{pBlocked} bloq.</span>}
                    <span className="text-sf-cream">{pPct}%</span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-24 h-1.5 rounded-full overflow-hidden flex-shrink-0"
                       style={{ background: 'rgba(199,191,239,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pPct}%`, background: '#F92D97' }} />
                  </div>
                </div>

                {/* Detalle */}
                {isOpen && (
                  <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(199,191,239,0.08)' }}>
                    {/* Tabla de actividades */}
                    <table className="w-full text-xs mb-4">
                      <thead>
                        <tr className="text-left uppercase tracking-wide"
                            style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
                          <th className="pb-2 font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Actividad</th>
                          <th className="pb-2 font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Responsable</th>
                          <th className="pb-2 font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Inicio</th>
                          <th className="pb-2 font-medium font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Fin</th>
                          <th className="pb-2 font-medium text-center font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acts.map(a => {
                          const stCfg = STATUS_COLORS[a.status] ?? STATUS_COLORS.pending
                          const isOverdue = a.end_date && a.status !== 'delivered' &&
                                            differenceInDays(parseISO(a.end_date), today) < 0
                          return (
                            <tr key={a.id} style={{ borderBottom: '1px solid rgba(199,191,239,0.04)' }}>
                              <td className="py-2.5 pr-3">
                                <span className="text-sf-cream font-medium">{a.name}</span>
                                {isOverdue && (
                                  <span className="ml-2 text-[10px] font-semibold uppercase font-mono" style={{ color: '#F92D97' }}>vencida</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-3 font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>
                                {a.responsible?.name ?? '—'}
                              </td>
                              <td className="py-2.5 pr-3 whitespace-nowrap font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{fmtDate(a.start_date)}</td>
                              <td className="py-2.5 pr-3 whitespace-nowrap font-mono"
                                  style={{ color: isOverdue ? '#F92D97' : 'rgba(240,231,228,0.4)', fontWeight: isOverdue ? 600 : 400 }}>
                                {fmtDate(a.end_date)}
                              </td>
                              <td className="py-2.5 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono"
                                      style={{ background: stCfg.bg, color: stCfg.text }}>
                                  {STATUS_ICONS[a.status]}
                                  {STATUS_LABELS[a.status]?.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Historial de cambios recientes */}
                    {progLogs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2 font-mono"
                           style={{ color: 'rgba(240,231,228,0.4)' }}>
                          <CalendarClock size={12} className="inline mr-1" />
                          Cambios recientes
                        </p>
                        <div className="space-y-1">
                          {progLogs.slice(0, 10).map(log => {
                            const act = acts.find(a => a.id === log.activity_id)
                            const oldLabel = STATUS_LABELS[log.old_value]?.label ?? log.old_value
                            const newLabel = STATUS_LABELS[log.new_value]?.label ?? log.new_value
                            return (
                              <div key={log.id} className="flex items-center gap-3 text-xs py-1 font-mono"
                                   style={{ color: 'rgba(240,231,228,0.4)' }}>
                                <span className="w-28 flex-shrink-0" style={{ color: 'rgba(199,191,239,0.3)' }}>
                                  {format(parseISO(log.created_at), "d MMM HH:mm", { locale: es })}
                                </span>
                                <span>
                                  <span className="font-medium text-sf-cream">{act?.name ?? '—'}</span>
                                  {' '}cambió de{' '}
                                  <span className="line-through" style={{ color: 'rgba(240,231,228,0.4)' }}>{oldLabel}</span>
                                  {' → '}
                                  <span className="font-medium text-sf-cream">{newLabel}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {progLogs.length === 0 && (
                      <p className="text-xs italic font-mono" style={{ color: 'rgba(199,191,239,0.3)' }}>Sin cambios registrados aún.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs mt-8 pt-4 font-mono"
           style={{ color: 'rgba(240,231,228,0.4)', borderTop: '1px solid rgba(199,191,239,0.08)' }}>
        SIPROFILM · CAPRO · Reporte generado el {reportDate}
      </div>
    </div>
  )
}

/* ---- Componentes auxiliares ---- */

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: 'rgba(240,231,228,0.4)' }}>{icon}</span>
      <h2 className="text-sm font-bold text-sf-cream uppercase tracking-wide font-display">{title}</h2>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  const colorStyles = {
    green: { border: '1px solid rgba(208,237,64,0.15)', background: 'rgba(208,237,64,0.06)' },
    blue:  { border: '1px solid rgba(75,82,235,0.15)',  background: 'rgba(75,82,235,0.06)' },
    red:   { border: '1px solid rgba(249,45,151,0.15)', background: 'rgba(249,45,151,0.06)' },
  }
  const defaultStyle = { border: '1px solid rgba(199,191,239,0.08)', background: '#1c1a1b' }
  return (
    <div className="rounded-lg px-4 py-3"
         style={colorStyles[color] ?? defaultStyle}>
      <div className="text-xs uppercase tracking-wide mb-1 font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{label}</div>
      <div className="text-xl font-bold text-sf-cream font-mono">
        {value}
        {sub && <span className="text-xs font-normal ml-1 font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-xs font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>{label}</span>
    </div>
  )
}

function AlertRow({ color, program, activity, responsible, detail }) {
  const styles = {
    red:   { border: '1px solid rgba(249,45,151,0.15)', background: 'rgba(249,45,151,0.06)' },
    amber: { border: '1px solid rgba(199,191,239,0.15)', background: 'rgba(199,191,239,0.06)' },
  }
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg text-xs font-mono"
         style={styles[color]}>
      <div className="flex-1 min-w-0">
        <span style={{ color: 'rgba(240,231,228,0.4)' }}>{program}</span>
        <span className="mx-1.5" style={{ color: 'rgba(199,191,239,0.3)' }}>›</span>
        <span className="font-semibold text-sf-cream">{activity}</span>
      </div>
      <span style={{ color: 'rgba(240,231,228,0.4)' }}>{responsible ?? '—'}</span>
      <span className="flex-shrink-0 font-medium"
            style={{ color: color === 'red' ? '#F92D97' : '#C7BFEF' }}>
        {detail}
      </span>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto animate-pulse space-y-4">
      <div className="h-8 rounded w-56" style={{ background: 'rgba(199,191,239,0.08)' }} />
      <div className="grid grid-cols-5 gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-lg" style={{ background: 'rgba(199,191,239,0.04)' }} />)}
      </div>
      <div className="h-48 rounded-lg" style={{ background: 'rgba(199,191,239,0.04)' }} />
    </div>
  )
}
