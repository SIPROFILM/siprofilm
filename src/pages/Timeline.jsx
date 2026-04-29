import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useStages } from '../hooks/useStages'
import { PageHeader } from '../components/Layout'
import { STATUS_LABELS, fmtDate } from '../lib/utils'
import {
  parseISO, differenceInDays, format, startOfDay, addDays,
  endOfMonth, eachMonthOfInterval, startOfMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ZoomIn, ZoomOut, ChevronDown, ChevronRight, CalendarRange,
  Download, Check, Filter, User, Clock, GripVertical,
} from 'lucide-react'
import { exportGanttToExcel } from '../lib/exportExcel'

/* ---- Colores por programa (rotativos) ---- */
const PROG_COLORS = [
  { bg: '#1a1a1a', light: '#1a1a1a12', border: '#1a1a1a30' },
  { bg: '#2563eb', light: '#2563eb10', border: '#2563eb25' },
  { bg: '#059669', light: '#05966910', border: '#05966925' },
  { bg: '#dc2626', light: '#dc262610', border: '#dc262625' },
  { bg: '#d97706', light: '#d9770610', border: '#d9770625' },
  { bg: '#7c3aed', light: '#7c3aed10', border: '#7c3aed25' },
  { bg: '#db2777', light: '#db277710', border: '#db277725' },
  { bg: '#0891b2', light: '#0891b210', border: '#0891b225' },
]

// STAGE_LABEL is now loaded dynamically via useStages hook

/* ---- Color por estado de actividad ---- */
const ACT_COLORS = {
  pending:     { bar: '#d1d5db', text: '#374151', label: 'Pendiente' },
  in_progress: { bar: '#3b82f6', text: '#ffffff', label: 'En curso' },
  delivered:   { bar: '#10b981', text: '#ffffff', label: 'Entregada' },
  blocked:     { bar: '#ef4444', text: '#ffffff', label: 'Bloqueada' },
}

const ROW_H    = 32
const PROG_H   = 40
const HEADER_H = 56

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function Timeline() {
  const isMobile = useIsMobile()
  const LEFT_W = isMobile ? 140 : 260
  const { activeOrg } = useOrg()
  const { stageLabels: STAGE_LABEL } = useStages()
  const [allPrograms, setAllPrograms] = useState([])
  const [loading, setLoading]         = useState(true)
  const [dayWidth, setDayWidth]       = useState(8)
  const [expanded, setExpanded]       = useState({})
  const [filterProg, setFilterProg]   = useState('all')
  const [showFilter, setShowFilter]   = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedForExport, setSelectedForExport] = useState({})
  const [exporting, setExporting]     = useState(false)
  const scrollRef = useRef(null)

  /* ---- Drag-and-drop state ---- */
  const [dragState, setDragState] = useState(null) // { progId, actId, fromIdx }
  const [localOrder, setLocalOrder] = useState({}) // { [progId]: [actId, ...] }

  useEffect(() => { load() }, [activeOrg?.id])

  async function load() {
    let query = supabase
      .from('programs')
      .select(`
        id, name, status, start_date, stage,
        activities(id, name, start_date, end_date, status, duration_days, sort_order, responsible:participants(name))
      `)
      .order('start_date', { ascending: true, nullsFirst: false })

    if (activeOrg?.id) {
      query = query.eq('org_id', activeOrg.id)
    }

    const { data } = await query

    if (data) {
      const active = data.filter(p => p.stage !== 'incubadora' && (p.activities || []).length > 0)
      // Sort activities by sort_order if present, then by start_date
      active.forEach(p => {
        if (p.activities) {
          p.activities.sort((a, b) => {
            const sa = a.sort_order ?? 999
            const sb = b.sort_order ?? 999
            if (sa !== sb) return sa - sb
            return (a.start_date || '').localeCompare(b.start_date || '')
          })
        }
      })
      setAllPrograms(active)
      const exp = {}
      active.forEach(p => { exp[p.id] = true })
      setExpanded(exp)
    }
    setLoading(false)
  }

  /* ---- Filtro de programas ---- */
  const programs = useMemo(() => {
    if (filterProg === 'all') return allPrograms
    return allPrograms.filter(p => String(p.id) === filterProg)
  }, [allPrograms, filterProg])

  /* ---- Stats rápidos ---- */
  const stats = useMemo(() => {
    const allActs = programs.flatMap(p => p.activities || [])
    const today = new Date()
    return {
      total: allActs.length,
      inProgress: allActs.filter(a => a.status === 'in_progress').length,
      delivered: allActs.filter(a => a.status === 'delivered').length,
      blocked: allActs.filter(a => a.status === 'blocked').length,
      overdue: allActs.filter(a =>
        a.status !== 'delivered' && a.end_date && parseISO(a.end_date) < today
      ).length,
    }
  }, [programs])

  /* ---- Export helpers ---- */
  function toggleExportProgram(id) {
    setSelectedForExport(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function selectAllForExport() {
    const allSelected = allPrograms.every(p => selectedForExport[p.id])
    const next = {}
    allPrograms.forEach(p => { next[p.id] = !allSelected })
    setSelectedForExport(next)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const selected = Object.keys(selectedForExport).filter(k => selectedForExport[k])
      const toExport = selected.length > 0
        ? allPrograms.filter(p => selected.includes(String(p.id)))
        : allPrograms
      await exportGanttToExcel(toExport)
    } catch (e) { console.error('Export error:', e) }
    setExporting(false)
    setShowExportMenu(false)
  }

  /* ---- Auto-scroll to today on first render ---- */
  const todayScrollDone = useRef(false)
  useEffect(() => {
    if (loading || todayScrollDone.current || !scrollRef.current) return
    // We need todayX calculated below, so we do a quick calc here
    const allD = allPrograms.flatMap(p =>
      (p.activities ?? []).flatMap(a => [
        a.start_date ? parseISO(a.start_date) : null,
        a.end_date   ? parseISO(a.end_date)   : null,
      ]).filter(Boolean)
    )
    if (allD.length === 0) return
    const rStart = startOfDay(addDays(new Date(Math.min(...allD.map(d => d.getTime()))), -3))
    const todayOff = differenceInDays(startOfDay(new Date()), rStart)
    if (todayOff < 0) return
    const scrollTarget = todayOff * dayWidth - 200 // 200px left margin so today is visible but not flush
    scrollRef.current.scrollLeft = Math.max(0, scrollTarget)
    todayScrollDone.current = true
  }, [loading, allPrograms, dayWidth])

  /* ---- Drag-and-drop handlers ---- */
  function getOrderedActs(prog) {
    const acts = prog.activities ?? []
    const order = localOrder[prog.id]
    if (!order) return acts
    const map = new Map(acts.map(a => [a.id, a]))
    const ordered = order.map(id => map.get(id)).filter(Boolean)
    // append any acts not in order list (newly added)
    const inOrder = new Set(order)
    acts.forEach(a => { if (!inOrder.has(a.id)) ordered.push(a) })
    return ordered
  }

  function handleDragStart(progId, actId, idx) {
    setDragState({ progId, actId, fromIdx: idx })
  }

  function handleDragOver(e, progId, toIdx) {
    if (!dragState || dragState.progId !== progId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e, progId, toIdx) {
    e.preventDefault()
    if (!dragState || dragState.progId !== progId) return
    const prog = programs.find(p => p.id === progId)
    if (!prog) return

    const acts = getOrderedActs(prog)
    const ids = acts.map(a => a.id)
    const fromIdx = ids.indexOf(dragState.actId)
    if (fromIdx === -1 || fromIdx === toIdx) { setDragState(null); return }

    const newIds = [...ids]
    const [moved] = newIds.splice(fromIdx, 1)
    newIds.splice(toIdx, 0, moved)

    setLocalOrder(prev => ({ ...prev, [progId]: newIds }))

    // Persist sort_order to DB
    const updates = newIds.map((id, i) => ({ id, sort_order: i }))
    Promise.all(
      updates.map(u => supabase.from('activities').update({ sort_order: u.sort_order }).eq('id', u.id))
    ).catch(err => console.error('Sort order save error:', err))

    setDragState(null)
  }

  function handleDragEnd() { setDragState(null) }

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
        <PageHeader title="Vista General" subtitle="Timeline multi-proyecto" />
        <div className="bg-white border border-gray-200 rounded-lg py-24 text-center">
          <CalendarRange size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-400">
            {allPrograms.length === 0
              ? 'Aún no hay actividades con fechas. Agrega actividades a tus programas para verlas aquí.'
              : 'El proyecto seleccionado no tiene actividades con fechas.'}
          </p>
          {filterProg !== 'all' && (
            <button
              onClick={() => setFilterProg('all')}
              className="mt-4 text-xs text-blue-600 hover:underline"
            >
              Ver todos los proyectos
            </button>
          )}
        </div>
      </div>
    )
  }

  const rangeStart  = startOfDay(addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -3))
  const rangeEnd    = startOfDay(addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 7))
  const totalDays   = differenceInDays(rangeEnd, rangeStart) + 1
  const totalWidth  = totalDays * dayWidth
  const months      = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })

  function daysFrom(dateStr) {
    return differenceInDays(startOfDay(parseISO(dateStr)), rangeStart)
  }

  const todayD = startOfDay(new Date())
  const todayOffset = differenceInDays(todayD, rangeStart)
  const todayX = (todayOffset >= 0 && todayOffset <= totalDays) ? todayOffset * dayWidth : null

  return (
    <div className="p-4 md:p-8 flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      <PageHeader
        title="Vista General"
        subtitle="Timeline multi-proyecto"
        action={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Stats pills */}
            <div className="hidden lg:flex items-center gap-2 mr-2">
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                {stats.total} actividades
              </span>
              {stats.inProgress > 0 && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                  {stats.inProgress} en curso
                </span>
              )}
              {stats.overdue > 0 && (
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-full">
                  {stats.overdue} vencidas
                </span>
              )}
              {stats.blocked > 0 && (
                <span className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded-full">
                  {stats.blocked} bloqueadas
                </span>
              )}
            </div>

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(v => !v)}
                className={`flex items-center gap-1.5 text-xs sm:text-sm border rounded-md px-2 sm:px-3 py-1.5
                  hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all
                  ${filterProg !== 'all' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
              >
                <Filter size={14} />
                <span className="hidden sm:inline">
                  {filterProg === 'all'
                    ? `Todos (${allPrograms.length})`
                    : allPrograms.find(p => String(p.id) === filterProg)?.name || 'Proyecto'}
                </span>
                <span className="sm:hidden">
                  {filterProg === 'all' ? allPrograms.length : '1'}
                </span>
              </button>
              {showFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-[#1a1a1a]">Filtrar por proyecto</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      <button
                        onClick={() => { setFilterProg('all'); setShowFilter(false) }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-gray-50 text-left
                          ${filterProg === 'all' ? 'bg-gray-50 font-semibold' : ''}`}
                      >
                        <div className={`w-3 h-3 rounded-full ${filterProg === 'all' ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`} />
                        Todos los proyectos ({allPrograms.length})
                      </button>
                      {allPrograms.map((p, i) => {
                        const color = PROG_COLORS[i % PROG_COLORS.length]
                        return (
                          <button
                            key={p.id}
                            onClick={() => { setFilterProg(String(p.id)); setShowFilter(false) }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-gray-50 text-left
                              ${String(p.id) === filterProg ? 'bg-gray-50 font-semibold' : ''}`}
                          >
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color.bg }} />
                            <span className="truncate">{p.name}</span>
                            <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                              {STAGE_LABEL[p.stage] || p.stage} · {(p.activities || []).length} act.
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-md p-1">
              <button
                onClick={() => setDayWidth(v => Math.max(3, v - 2))}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Alejar"
              ><ZoomOut size={14} className="text-gray-500" /></button>
              <span className="text-xs text-gray-400 w-12 text-center">{dayWidth}px</span>
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
                className="flex items-center gap-1.5 text-xs sm:text-sm border border-gray-200 rounded-md px-2 sm:px-3 py-1.5
                           hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all text-gray-600"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Excel</span>
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
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-gray-50 text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          allPrograms.every(p => selectedForExport[p.id])
                            ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'border-gray-300'
                        }`}>
                          {allPrograms.every(p => selectedForExport[p.id]) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="font-semibold text-gray-700">Todos ({allPrograms.length})</span>
                      </button>
                      {allPrograms.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleExportProgram(p.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-1.5 text-xs hover:bg-gray-50 text-left"
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

      {/* Leyenda de estados */}
      <div className="flex items-center gap-3 sm:gap-5 mb-3 flex-wrap">
        {Object.entries(ACT_COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-2.5 sm:w-3 h-1.5 rounded-sm" style={{ backgroundColor: v.bar }} />
            <span className="text-[9px] sm:text-[10px] text-gray-500">{v.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-4 h-px bg-red-500" />
          <span className="text-[9px] sm:text-[10px] text-gray-400">Hoy ({format(todayD, "d MMM", { locale: es })})</span>
        </div>
      </div>

      {/* Gantt container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto border border-gray-200 rounded-xl bg-white"
        style={{ minHeight: 0 }}
      >
        <div style={{ width: LEFT_W + totalWidth, minWidth: '100%' }}>

          {/* Header fechas */}
          <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200">
            <div
              className="sticky left-0 z-40 bg-gray-50 border-r border-gray-200 flex items-end px-4 pb-2 flex-shrink-0"
              style={{ width: LEFT_W, height: HEADER_H }}
            >
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Proyecto / Actividad
              </span>
            </div>

            <div className="relative flex-1" style={{ width: totalWidth, height: HEADER_H }}>
              {/* Meses */}
              {months.map(m => {
                const mStart = startOfMonth(m) < rangeStart ? rangeStart : startOfMonth(m)
                const mEnd   = endOfMonth(m)   > rangeEnd   ? rangeEnd   : endOfMonth(m)
                const dStart = differenceInDays(mStart, rangeStart)
                const dLen   = differenceInDays(mEnd, mStart) + 1
                return (
                  <div
                    key={m.toISOString()}
                    className="absolute top-0 flex items-center px-3 border-r border-gray-100"
                    style={{ left: dStart * dayWidth, width: dLen * dayWidth, height: 30 }}
                  >
                    <span className="text-xs font-semibold text-gray-700 capitalize whitespace-nowrap">
                      {format(m, 'MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                )
              })}

              {/* Semanas */}
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => {
                const d = addDays(rangeStart, w * 7)
                return (
                  <div
                    key={w}
                    className="absolute bottom-0 flex items-center px-1 border-r border-gray-100"
                    style={{ left: w * 7 * dayWidth, width: 7 * dayWidth, height: 26, borderTop: '1px solid #f3f4f6' }}
                  >
                    {dayWidth >= 5 && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {format(d, 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Today marker header */}
              {todayX !== null && (
                <div className="absolute top-0 bottom-0 z-20 flex flex-col items-center" style={{ left: todayX - 1 }}>
                  <div className="w-0.5 h-full bg-red-500 opacity-70" />
                </div>
              )}
            </div>
          </div>

          {/* Filas de programas y actividades */}
          {programs.map((prog, pi) => {
            const colorIdx = allPrograms.findIndex(p => p.id === prog.id)
            const color = PROG_COLORS[(colorIdx >= 0 ? colorIdx : pi) % PROG_COLORS.length]
            const acts  = prog.activities ?? []
            const isOpen = expanded[prog.id]
            const delivered = acts.filter(a => a.status === 'delivered').length
            const pct = acts.length > 0 ? Math.round((delivered / acts.length) * 100) : 0

            const actWithDates = acts.filter(a => a.start_date && a.end_date)
            const progLeft = actWithDates.length
              ? Math.min(...actWithDates.map(a => daysFrom(a.start_date))) * dayWidth
              : null
            const progRight = actWithDates.length
              ? Math.max(...actWithDates.map(a => daysFrom(a.end_date))) * dayWidth
              : null
            const progWidth = progLeft !== null && progRight !== null
              ? progRight - progLeft + dayWidth : null

            return (
              <div key={prog.id}>
                {/* Fila programa */}
                <div
                  className="flex border-b border-gray-200 cursor-pointer select-none"
                  style={{ height: PROG_H }}
                  onClick={() => setExpanded(e => ({ ...e, [prog.id]: !e[prog.id] }))}
                >
                  <div
                    className="sticky left-0 z-20 flex items-center gap-2 px-4 flex-shrink-0 border-r"
                    style={{ width: LEFT_W, backgroundColor: color.bg, borderColor: color.bg }}
                  >
                    <span className="text-white/70">
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    <span className="text-white text-xs font-semibold truncate flex-1">{prog.name}</span>
                    <span className="text-white/50 text-[10px] flex-shrink-0">
                      {pct}% · {acts.length}
                    </span>
                  </div>

                  <div className="relative flex-1" style={{ backgroundColor: color.light, width: totalWidth }}>
                    {/* Barra resumen */}
                    {progLeft !== null && progWidth !== null && (
                      <>
                        {/* Track */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-md"
                          style={{ left: progLeft, width: Math.max(progWidth, 6), height: PROG_H - 16, backgroundColor: color.bg, opacity: 0.15 }}
                        />
                        {/* Progress fill */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-md"
                          style={{ left: progLeft, width: Math.max(progWidth * (pct / 100), 3), height: PROG_H - 16, backgroundColor: color.bg, opacity: 0.5 }}
                        />
                      </>
                    )}
                    {/* Today */}
                    {todayX !== null && (
                      <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: todayX, backgroundColor: '#ef4444', opacity: 0.4 }} />
                    )}
                    {/* Week grid */}
                    {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                      <div key={w} className="absolute top-0 bottom-0" style={{ left: (w + 1) * 7 * dayWidth, width: 1, backgroundColor: '#e5e7eb30' }} />
                    ))}
                  </div>
                </div>

                {/* Actividades */}
                {isOpen && getOrderedActs(prog).map((act, actIdx) => {
                  const hasDate = act.start_date && act.end_date
                  const col     = ACT_COLORS[act.status] ?? ACT_COLORS.pending
                  const barLeft = hasDate ? daysFrom(act.start_date) * dayWidth : 0
                  const barW    = hasDate
                    ? Math.max((differenceInDays(parseISO(act.end_date), parseISO(act.start_date)) + 1) * dayWidth, 4)
                    : 0
                  const isOverdue = act.status !== 'delivered' && act.end_date && parseISO(act.end_date) < todayD
                  const responsible = act.responsible?.[0]?.name || null
                  const isDragging = dragState?.actId === act.id

                  return (
                    <div
                      key={act.id}
                      draggable
                      onDragStart={() => handleDragStart(prog.id, act.id, actIdx)}
                      onDragOver={(e) => handleDragOver(e, prog.id, actIdx)}
                      onDrop={(e) => handleDrop(e, prog.id, actIdx)}
                      onDragEnd={handleDragEnd}
                      className={`flex border-b border-gray-50 hover:bg-gray-50/60 transition-colors group
                        ${isDragging ? 'opacity-40' : ''}
                        ${dragState && dragState.progId === prog.id && !isDragging ? 'border-t-2 border-t-transparent hover:border-t-blue-300' : ''}`}
                      style={{ height: ROW_H }}
                    >
                      {/* Nombre actividad + responsable + drag handle */}
                      <div
                        className="sticky left-0 z-20 flex items-center px-2 gap-1.5 flex-shrink-0 border-r border-gray-100 bg-white group-hover:bg-gray-50/60"
                        style={{ width: LEFT_W }}
                      >
                        <GripVertical size={12} className="text-gray-300 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.bar }} />
                        <span
                          className={`text-xs truncate flex-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}
                          title={act.name}
                        >
                          {act.name}
                        </span>
                        {responsible && (
                          <span className="text-[9px] text-gray-400 flex-shrink-0 max-w-[60px] truncate" title={responsible}>
                            {responsible.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Barra */}
                      <div className="relative flex-1" style={{ width: totalWidth }}>
                        {/* Week grid */}
                        {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                          <div key={w} className="absolute top-0 bottom-0" style={{ left: (w + 1) * 7 * dayWidth, width: 1, backgroundColor: '#f3f4f6' }} />
                        ))}
                        {/* Today */}
                        {todayX !== null && (
                          <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: todayX, backgroundColor: '#ef4444', opacity: 0.25 }} />
                        )}
                        {/* Activity bar */}
                        {hasDate && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-sm cursor-default transition-all"
                            style={{
                              left: barLeft,
                              width: barW,
                              height: ROW_H - 10,
                              backgroundColor: isOverdue ? '#fca5a5' : col.bar,
                              border: isOverdue ? '1px solid #ef4444' : 'none',
                            }}
                            title={[
                              act.name,
                              `${fmtDate(act.start_date)} → ${fmtDate(act.end_date)}`,
                              `${act.duration_days || differenceInDays(parseISO(act.end_date), parseISO(act.start_date)) + 1} días`,
                              responsible ? `Responsable: ${responsible}` : null,
                              `Estado: ${col.label}`,
                              isOverdue ? '⚠️ VENCIDA' : null,
                            ].filter(Boolean).join('\n')}
                          >
                            {barW > 60 && (
                              <span
                                className="block h-full flex items-center px-2 text-[10px] font-medium truncate leading-none"
                                style={{ color: isOverdue ? '#991b1b' : col.text, lineHeight: `${ROW_H - 10}px` }}
                              >
                                {act.name}
                                {responsible && barW > 140 && (
                                  <span style={{ opacity: 0.7 }}> · {responsible.split(' ')[0]}</span>
                                )}
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
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-6 text-xs text-gray-400">
        <span>{programs.length} proyectos</span>
        <span>·</span>
        <span>{programs.reduce((s, p) => s + (p.activities?.length ?? 0), 0)} actividades</span>
        <span>·</span>
        <span>
          {format(rangeStart, "d MMM yyyy", { locale: es })} → {format(rangeEnd, "d MMM yyyy", { locale: es })}
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
