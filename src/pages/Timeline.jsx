import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { STATUS_LABELS, PROGRAM_STATUS_LABELS, fmtDate } from '../lib/utils'
import {
  parseISO, differenceInDays, format, startOfDay, addDays,
  endOfMonth, eachMonthOfInterval, startOfMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ZoomIn, ZoomOut, ChevronDown, ChevronRight, CalendarRange, Download, Check } from 'lucide-react'
import { exportGanttToExcel } from '../lib/exportExcel'

/* ---- Colores por programa (rotativos) ---- */
const PROG_COLORS = [
  { bg: '#1a1a1a', light: '#1a1a1a20' },
  { bg: '#2563eb', light: '#2563eb18' },
  { bg: '#059669', light: '#05966918' },
  { bg: '#dc2626', light: '#dc262618' },
  { bg: '#d97706', light: '#d9770618' },
  { bg: '#7c3aed', light: '#7c3aed18' },
  { bg: '#db2777', light: '#db277718' },
  { bg: '#0891b2', light: '#0891b218' },
]

/* ---- Color por estado de actividad ---- */
const ACT_COLORS = {
  pending:     { bar: '#d1d5db', text: '#374151' },
  in_progress: { bar: '#3b82f6', text: '#ffffff' },
  delivered:   { bar: '#10b981', text: '#ffffff' },
  blocked:     { bar: '#ef4444', text: '#ffffff' },
}

const LEFT_W   = 230   // ancho panel izquierdo (px)
const ROW_H    = 30    // alto fila actividad (px)
const PROG_H   = 38    // alto fila programa (px)
const HEADER_H = 52    // alto header fechas (px)

export default function Timeline() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading]   = useState(true)
  const [dayWidth, setDayWidth] = useState(8)
  const [expanded, setExpanded] = useState({})
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedForExport, setSelectedForExport] = useState({})
  const [exporting, setExporting] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('programs')
      .select(`
        id, name, status, start_date,
        activities(id, name, start_date, end_date, status, duration_days, responsible:participants(name))
      `)
      .order('start_date', { ascending: true, nullsFirst: false })

    if (data) {
      // Filtrar incubadora — no están activos
      const active = data.filter(p => p.stage !== 'incubadora')
      setPrograms(active)
      const exp = {}
      active.forEach(p => { exp[p.id] = true })
      setExpanded(exp)
    }
    setLoading(false)
  }

  function toggleExportProgram(id) {
    setSelectedForExport(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function selectAllForExport() {
    const allSelected = programs.every(p => selectedForExport[p.id])
    const next = {}
    programs.forEach(p => { next[p.id] = !allSelected })
    setSelectedForExport(next)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const selected = Object.keys(selectedForExport).filter(k => selectedForExport[k])
      const toExport = selected.length > 0
        ? programs.filter(p => selected.includes(String(p.id)))
        : programs
      await exportGanttToExcel(toExport)
    } catch (e) {
      console.error('Export error:', e)
    }
    setExporting(false)
    setShowExportMenu(false)
  }

  if (loading) return <PageLoading />

  /* ---- Calcular rango global de fechas ---- */
  const allDates = programs.flatMap(p =>
    (p.activities ?? []).flatMap(a => [
      a.start_date ? parseISO(a.start_date) : null,
      a.end_date   ? parseISO(a.end_date)   : null,
    ]).filter(Boolean)
  )

  if (allDates.length === 0) {
    return (
      <div className="p-8">
        <PageHeader
          title="Vista General"
          subtitle="Timeline multi-proyecto"
        />
        <div className="bg-white border border-gray-200 rounded-lg py-24 text-center">
          <CalendarRange size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-400">
            Aún no hay actividades con fechas. Agrega actividades a tus programas para verlas aquí.
          </p>
        </div>
      </div>
    )
  }

  const rangeStart  = startOfDay(new Date(Math.min(...allDates.map(d => d.getTime()))))
  const rangeEnd    = startOfDay(new Date(Math.max(...allDates.map(d => d.getTime()))))
  const totalDays   = differenceInDays(rangeEnd, rangeStart) + 1
  const totalWidth  = totalDays * dayWidth
  const months      = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })

  /* ---- Helpers ---- */
  function daysFrom(dateStr) {
    return differenceInDays(startOfDay(parseISO(dateStr)), rangeStart)
  }

  function todayLine() {
    const today  = startOfDay(new Date())
    const offset = differenceInDays(today, rangeStart)
    if (offset < 0 || offset > totalDays) return null
    return offset * dayWidth
  }

  const todayX = todayLine()

  /* ---- Render ---- */
  return (
    <div className="p-4 md:p-8 flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      <PageHeader
        title="Vista General"
        subtitle="Timeline multi-proyecto · todas las actividades en un solo lugar"
        action={
          <div className="flex items-center gap-3">
            {/* Leyenda */}
            <div className="flex items-center gap-4 mr-2">
              {Object.entries(ACT_COLORS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: v.bar }} />
                  <span className="text-xs text-gray-500">{STATUS_LABELS[k]?.label}</span>
                </div>
              ))}
            </div>
            {/* Zoom */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-md p-1">
              <button
                onClick={() => setDayWidth(v => Math.max(3, v - 2))}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Alejar"
              ><ZoomOut size={14} className="text-gray-500" /></button>
              <span className="text-xs text-gray-400 w-12 text-center">{dayWidth}px/día</span>
              <button
                onClick={() => setDayWidth(v => Math.min(28, v + 2))}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Acercar"
              ><ZoomIn size={14} className="text-gray-500" /></button>
            </div>

            {/* Export Excel */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-1.5
                           hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-600"
              >
                <Download size={14} />
                Excel
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-[#1a1a1a]">Descargar calendario Excel</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Selecciona los programas a incluir</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      <button
                        onClick={selectAllForExport}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          programs.every(p => selectedForExport[p.id])
                            ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-gray-300'
                        }`}>
                          {programs.every(p => selectedForExport[p.id]) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="font-semibold text-gray-700">Todos ({programs.length})</span>
                      </button>
                      {programs.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleExportProgram(p.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            selectedForExport[p.id]
                              ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-gray-300'
                          }`}>
                            {selectedForExport[p.id] && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-gray-600 truncate">{p.name}</span>
                          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                            {(p.activities || []).length} act.
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {Object.values(selectedForExport).filter(Boolean).length || 'Todos'} seleccionados
                      </span>
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="text-xs bg-[#1a1a1a] text-white px-4 py-1.5 rounded-md
                                   hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
                      >
                        {exporting ? 'Generando...' : 'Descargar .xlsx'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Gantt container: un solo scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto border border-gray-200 rounded-xl bg-white"
        style={{ minHeight: 0 }}
      >
        <div style={{ width: LEFT_W + totalWidth, minWidth: '100%' }}>

          {/* ---- Header fechas ---- */}
          <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200">
            {/* Esquina */}
            <div
              className="sticky left-0 z-40 bg-gray-50 border-r border-gray-200 flex items-end px-4 pb-2 flex-shrink-0"
              style={{ width: LEFT_W, height: HEADER_H }}
            >
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Proyecto / Actividad</span>
            </div>

            {/* Meses + semanas */}
            <div className="relative flex-1" style={{ width: totalWidth, height: HEADER_H }}>
              {/* Fila meses */}
              {months.map(m => {
                const mStart  = startOfMonth(m) < rangeStart ? rangeStart : startOfMonth(m)
                const mEnd    = endOfMonth(m)   > rangeEnd   ? rangeEnd   : endOfMonth(m)
                const dStart  = differenceInDays(mStart, rangeStart)
                const dLen    = differenceInDays(mEnd, mStart) + 1
                return (
                  <div
                    key={m.toISOString()}
                    className="absolute top-0 flex items-center px-2 border-r border-gray-100"
                    style={{ left: dStart * dayWidth, width: dLen * dayWidth, height: 28 }}
                  >
                    <span className="text-xs font-semibold text-gray-700 capitalize whitespace-nowrap">
                      {format(m, 'MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                )
              })}

              {/* Fila semanas */}
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => {
                const d = addDays(rangeStart, w * 7)
                return (
                  <div
                    key={w}
                    className="absolute bottom-0 flex items-center px-1 border-r border-gray-100"
                    style={{
                      left: w * 7 * dayWidth,
                      width: 7 * dayWidth,
                      height: 24,
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    {dayWidth >= 5 && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {format(d, 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---- Filas de programas y actividades ---- */}
          {programs.map((prog, pi) => {
            const color   = PROG_COLORS[pi % PROG_COLORS.length]
            const acts    = prog.activities ?? []
            const isOpen  = expanded[prog.id]

            /* Rango del programa (de sus actividades) */
            const actWithDates = acts.filter(a => a.start_date && a.end_date)
            const progLeft  = actWithDates.length
              ? Math.min(...actWithDates.map(a => daysFrom(a.start_date))) * dayWidth
              : null
            const progWidth = actWithDates.length
              ? (Math.max(...actWithDates.map(a => daysFrom(a.end_date))) -
                 Math.min(...actWithDates.map(a => daysFrom(a.start_date))) + 1) * dayWidth
              : null

            return (
              <div key={prog.id}>
                {/* Fila programa */}
                <div
                  className="flex border-b border-gray-100 cursor-pointer select-none"
                  style={{ height: PROG_H }}
                  onClick={() => setExpanded(e => ({ ...e, [prog.id]: !e[prog.id] }))}
                >
                  {/* Nombre programa */}
                  <div
                    className="sticky left-0 z-20 flex items-center gap-2 px-4 flex-shrink-0 border-r"
                    style={{
                      width: LEFT_W,
                      backgroundColor: color.bg,
                      borderColor: color.bg,
                    }}
                  >
                    <span className="text-white/70">
                      {isOpen
                        ? <ChevronDown size={13} />
                        : <ChevronRight size={13} />
                      }
                    </span>
                    <span className="text-white text-xs font-semibold truncate">{prog.name}</span>
                    <span className="ml-auto text-white/50 text-[10px] flex-shrink-0">
                      {acts.length} act.
                    </span>
                  </div>

                  {/* Barra resumen del programa */}
                  <div
                    className="relative flex-1"
                    style={{ backgroundColor: color.light, width: totalWidth }}
                  >
                    {progLeft !== null && progWidth !== null && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-md opacity-60"
                        style={{
                          left: progLeft,
                          width: Math.max(progWidth, 4),
                          height: PROG_H - 14,
                          backgroundColor: color.bg,
                        }}
                      />
                    )}
                    {/* Today line */}
                    {todayX !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px z-10"
                        style={{ left: todayX, backgroundColor: '#ef4444', opacity: 0.5 }}
                      />
                    )}
                    {/* Grid lines semanas */}
                    {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                      <div
                        key={w}
                        className="absolute top-0 bottom-0"
                        style={{ left: (w + 1) * 7 * dayWidth, width: 1, backgroundColor: '#e5e7eb40' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Filas de actividades */}
                {isOpen && acts.map(act => {
                  const hasDate = act.start_date && act.end_date
                  const col     = ACT_COLORS[act.status] ?? ACT_COLORS.pending
                  const barLeft = hasDate ? daysFrom(act.start_date) * dayWidth : 0
                  const barW    = hasDate
                    ? Math.max(
                        (differenceInDays(parseISO(act.end_date), parseISO(act.start_date)) + 1) * dayWidth,
                        4
                      )
                    : 0

                  return (
                    <div
                      key={act.id}
                      className="flex border-b border-gray-50 hover:bg-gray-50/60 transition-colors group"
                      style={{ height: ROW_H }}
                    >
                      {/* Nombre actividad */}
                      <div
                        className="sticky left-0 z-20 flex items-center px-4 gap-2 flex-shrink-0 border-r border-gray-100 bg-white group-hover:bg-gray-50/60"
                        style={{ width: LEFT_W }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: col.bar }}
                        />
                        <span className="text-xs text-gray-600 truncate" title={act.name}>
                          {act.name}
                        </span>
                      </div>

                      {/* Barra de actividad */}
                      <div className="relative flex-1" style={{ width: totalWidth }}>
                        {/* Grid semanas */}
                        {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                          <div
                            key={w}
                            className="absolute top-0 bottom-0"
                            style={{ left: (w + 1) * 7 * dayWidth, width: 1, backgroundColor: '#f3f4f6' }}
                          />
                        ))}

                        {/* Today */}
                        {todayX !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px z-10"
                            style={{ left: todayX, backgroundColor: '#ef4444', opacity: 0.35 }}
                          />
                        )}

                        {/* Barra */}
                        {hasDate && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-sm cursor-default"
                            style={{
                              left: barLeft,
                              width: barW,
                              height: ROW_H - 10,
                              backgroundColor: col.bar,
                            }}
                            title={`${act.name}\n${fmtDate(act.start_date)} → ${fmtDate(act.end_date)} · ${act.duration_days} días${act.responsible ? '\n' + act.responsible.name : ''}`}
                          >
                            {barW > 50 && (
                              <span
                                className="block h-full flex items-center px-2 text-[10px] font-medium truncate leading-none"
                                style={{ color: col.text, lineHeight: `${ROW_H - 10}px` }}
                              >
                                {act.name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Línea today en espacio vacío final (si hay) */}
          {programs.length === 0 && (
            <div className="py-20 text-center text-gray-400 text-sm">
              Sin programas para mostrar.
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-3 flex items-center gap-6 text-xs text-gray-400">
        <span>{programs.length} proyectos</span>
        <span>·</span>
        <span>{programs.reduce((s, p) => s + (p.activities?.length ?? 0), 0)} actividades totales</span>
        <span>·</span>
        <span>
          {format(rangeStart, "d 'de' MMMM yyyy", { locale: es })} →{' '}
          {format(rangeEnd,   "d 'de' MMMM yyyy", { locale: es })}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="w-3 h-px bg-red-400 inline-block" />
          Hoy
        </span>
      </div>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-[70vh] bg-gray-100 rounded-xl" />
    </div>
  )
}
