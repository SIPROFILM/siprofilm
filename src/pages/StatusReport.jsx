import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { STATUS_LABELS, PROGRAM_STATUS_LABELS, fmtDate, fmtMXN } from '../lib/utils'
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileText, Printer, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Circle,
  TrendingUp, AlertTriangle, CalendarClock
} from 'lucide-react'

const STATUS_COLORS = {
  pending:     { bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  in_progress: { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500'  },
  delivered:   { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
  blocked:     { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500'   },
}

const STATUS_ICONS = {
  pending:     <Circle size={13} className="text-gray-400" />,
  in_progress: <Clock size={13} className="text-blue-500" />,
  delivered:   <CheckCircle2 size={13} className="text-green-500" />,
  blocked:     <AlertCircle size={13} className="text-red-500" />,
}

export default function StatusReport() {
  const [programs, setPrograms] = useState([])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const [progRes, logRes] = await Promise.all([
      supabase
        .from('programs')
        .select(`
          id, name, status, start_date, stage,
          activities(id, name, status, start_date, end_date, duration_days,
                     daily_cost, cost_type, notes,
                     responsible:participants(id, name))
        `)
        .order('start_date', { ascending: true }),
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

  return (
    <div className="p-8 max-w-5xl mx-auto" id="status-report">
      <PageHeader
        title="Reporte de Status"
        subtitle={reportDate}
        action={
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm border border-gray-200 rounded-md px-4 py-2
                       hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-600 print:hidden"
          >
            <Printer size={15} />
            Imprimir / PDF
          </button>
        }
      />

      {/* ====== RESUMEN GENERAL ====== */}
      <section className="mb-10">
        <SectionTitle icon={<TrendingUp size={16} />} title="Resumen General" />

        <div className="grid grid-cols-5 gap-3 mb-6">
          <MetricCard label="Proyectos" value={programs.length} />
          <MetricCard label="Completadas" value={delivered} sub={`de ${totalActs}`} color="green" />
          <MetricCard label="En proceso" value={inProgress} color="blue" />
          <MetricCard label="Bloqueadas" value={blocked} color="red" />
          <MetricCard label="Avance total" value={`${overallPct}%`} />
        </div>

        {/* Barra de avance */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progreso general</span>
            <span>{delivered}/{totalActs} actividades completadas</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {delivered > 0 && (
              <div className="h-full bg-green-500 transition-all"
                   style={{ width: `${(delivered / totalActs) * 100}%` }} />
            )}
            {inProgress > 0 && (
              <div className="h-full bg-blue-400 transition-all"
                   style={{ width: `${(inProgress / totalActs) * 100}%` }} />
            )}
            {blocked > 0 && (
              <div className="h-full bg-red-400 transition-all"
                   style={{ width: `${(blocked / totalActs) * 100}%` }} />
            )}
          </div>
          <div className="flex gap-6 mt-3">
            <LegendDot color="bg-green-500" label={`Completadas (${delivered})`} />
            <LegendDot color="bg-blue-400" label={`En proceso (${inProgress})`} />
            <LegendDot color="bg-red-400" label={`Bloqueadas (${blocked})`} />
            <LegendDot color="bg-gray-200" label={`Pendientes (${pending})`} />
          </div>
        </div>
      </section>

      {/* ====== ALERTAS: VENCIDAS + PRÓXIMAS ====== */}
      {(overdue.length > 0 || upcoming.length > 0) && (
        <section className="mb-10">
          <SectionTitle icon={<AlertTriangle size={16} />} title="Alertas" />

          {overdue.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
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
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
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
          {programs.map(prog => {
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
              <div key={prog.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Header del programa */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  onClick={() => setExpanded(e => ({ ...e, [prog.id]: !e[prog.id] }))}
                >
                  <span className="text-gray-400">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-[#1a1a1a]">{prog.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {prog.stage && (
                        <span className="text-xs text-gray-400 capitalize">{prog.stage}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span className="text-green-600 font-medium">{pDone} ok</span>
                    <span className="text-blue-500 font-medium">{pProg} proc.</span>
                    {pBlocked > 0 && <span className="text-red-500 font-semibold">{pBlocked} bloq.</span>}
                    <span>{pPct}%</span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-[#1a1a1a] rounded-full" style={{ width: `${pPct}%` }} />
                  </div>
                </div>

                {/* Detalle */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {/* Tabla de actividades */}
                    <table className="w-full text-xs mb-4">
                      <thead>
                        <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="pb-2 font-medium">Actividad</th>
                          <th className="pb-2 font-medium">Responsable</th>
                          <th className="pb-2 font-medium">Inicio</th>
                          <th className="pb-2 font-medium">Fin</th>
                          <th className="pb-2 font-medium text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acts.map(a => {
                          const stCfg = STATUS_COLORS[a.status] ?? STATUS_COLORS.pending
                          const isOverdue = a.end_date && a.status !== 'delivered' &&
                                            differenceInDays(parseISO(a.end_date), today) < 0
                          return (
                            <tr key={a.id} className="border-b border-gray-50">
                              <td className="py-2.5 pr-3">
                                <span className="text-gray-800 font-medium">{a.name}</span>
                                {isOverdue && (
                                  <span className="ml-2 text-[10px] text-red-500 font-semibold uppercase">vencida</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-3 text-gray-500">
                                {a.responsible?.name ?? '—'}
                              </td>
                              <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{fmtDate(a.start_date)}</td>
                              <td className={`py-2.5 pr-3 whitespace-nowrap ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                                {fmtDate(a.end_date)}
                              </td>
                              <td className="py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${stCfg.bg} ${stCfg.text}`}>
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
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          <CalendarClock size={12} className="inline mr-1" />
                          Cambios recientes
                        </p>
                        <div className="space-y-1">
                          {progLogs.slice(0, 10).map(log => {
                            const act = acts.find(a => a.id === log.activity_id)
                            const oldLabel = STATUS_LABELS[log.old_value]?.label ?? log.old_value
                            const newLabel = STATUS_LABELS[log.new_value]?.label ?? log.new_value
                            return (
                              <div key={log.id} className="flex items-center gap-3 text-xs text-gray-500 py-1">
                                <span className="text-gray-300 w-28 flex-shrink-0">
                                  {format(parseISO(log.created_at), "d MMM HH:mm", { locale: es })}
                                </span>
                                <span>
                                  <span className="font-medium text-gray-700">{act?.name ?? '—'}</span>
                                  {' '}cambió de{' '}
                                  <span className="line-through text-gray-400">{oldLabel}</span>
                                  {' → '}
                                  <span className="font-medium text-gray-700">{newLabel}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {progLogs.length === 0 && (
                      <p className="text-xs text-gray-300 italic">Sin cambios registrados aún.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-gray-400 mt-8 pt-4 border-t">
        SIPROFILM · CAPRO · Reporte generado el {reportDate}
      </div>
    </div>
  )
}

/* ---- Componentes auxiliares ---- */

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">{title}</h2>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  const colors = {
    green: 'border-green-200 bg-green-50/50',
    blue:  'border-blue-200 bg-blue-50/50',
    red:   'border-red-200 bg-red-50/50',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 ${colors[color] ?? 'border-gray-200 bg-white'}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-[#1a1a1a]">
        {value}
        {sub && <span className="text-xs font-normal text-gray-400 ml-1">{sub}</span>}
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

function AlertRow({ color, program, activity, responsible, detail }) {
  const colors = {
    red:   'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
  }
  return (
    <div className={`flex items-center gap-4 px-4 py-2.5 rounded-lg border text-xs ${colors[color]}`}>
      <div className="flex-1 min-w-0">
        <span className="text-gray-400">{program}</span>
        <span className="mx-1.5 text-gray-300">›</span>
        <span className="font-semibold text-gray-800">{activity}</span>
      </div>
      <span className="text-gray-500">{responsible ?? '—'}</span>
      <span className={`flex-shrink-0 font-medium ${color === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
        {detail}
      </span>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-56" />
      <div className="grid grid-cols-5 gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-48 bg-gray-100 rounded-lg" />
    </div>
  )
}
