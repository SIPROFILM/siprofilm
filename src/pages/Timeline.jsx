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
  { bg: '#F92D97', light: 'rgba(249,45,151,0.06)', border: 'rgba(249,45,151,0.2)' },
  { bg: '#4B52EB', light: 'rgba(75,82,235,0.06)',  border: 'rgba(75,82,235,0.2)' },
  { bg: '#D0ED40', light: 'rgba(208,237,64,0.04)', border: 'rgba(208,237,64,0.15)', textDark: true },
  { bg: '#C7BFEF', light: 'rgba(199,191,239,0.05)', border: 'rgba(199,191,239,0.15)', textDark: true },
  { bg: '#0891b2', light: 'rgba(8,145,178,0.06)',  border: 'rgba(8,145,178,0.2)' },
  { bg: '#d97706', light: 'rgba(217,119,6,0.06)',  border: 'rgba(217,119,6,0.2)' },
  { bg: '#7c3aed', light: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.2)' },
  { bg: '#059669', light: 'rgba(5,150,105,0.06)',  border: 'rgba(5,150,105,0.2)' },
]

// STAGE_LABEL is now loaded dynamically via useStages hook

/* ---- Color por estado de actividad ---- */
const ACT_COLORS = {
  pending:     { bar: '#C7BFEF', text: '#141213', label: 'Pendiente' },
  in_progress: { bar: '#4B52EB', text: '#ffffff', label: 'En curso' },
  delivered:   { bar: '#D0ED40', text: '#141213', label: 'Entregada' },
  blocked:     { bar: '#F92D97', text: '#ffffff', label: 'Bloqueada' },
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
      <div className="p-4 md:p-8">
        <PageHeader title="Vista General" subtitle="Timeline multi-proyecto" />
        <div className="bg-sf-surface rounded-lg py-24 text-center" style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <CalendarRange size={40} className="text-sf-muted mx-auto mb-4" />
          <p className="text-sm text-sf-muted font-mono">
            {allPrograms.length === 0
              ? 'Aún no hay actividades con fechas. Agrega actividades a tus programas para verlas aquí.'
              : 'El proyecto seleccionado no tiene actividades con fechas.'}
          </p>
          {filterProg !== 'all' && (
            <button
              onClick={() => setFilterProg('all')}
              className="mt-4 text-xs text-sf-pink hover:underline font-mono"
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
              <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(199,191,239,0.08)', color: 'rgba(240,231,228,0.5)' }}>
                {stats.total} actividades
              </span>
              {stats.inProgress > 0 && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(75,82,235,0.12)', color: '#4B52EB' }}>
                  {stats.inProgress} en curso
                </span>
              )}
              {stats.overdue > 0 && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(249,45,151,0.1)', color: '#F92D97' }}>
                  {stats.overdue} vencidas
                </span>
              )}
              {stats.blocked > 0 && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(249,45,151,0.08)', color: '#F92D97' }}>
                  {stats.blocked} bloqueadas
                </span>
              )}
            </div>

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(v => !v)}
                className="flex items-center gap-1.5 text-xs sm:text-sm rounded-md px-2 sm:px-3 py-1.5 transition-all font-mono"
                style={{
                  border: filterProg !== 'all' ? '1px solid rgba(249,45,151,0.3)' : '1px solid rgba(199,191,239,0.1)',
                  background: filterProg !== 'all' ? 'rgba(249,45,151,0.08)' : 'transparent',
                  color: filterProg !== 'all' ? '#F92D97' : 'rgba(240,231,228,0.5)',
                }}
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
                  <div className="absolute right-0 top-full mt-2 bg-sf-surface rounded-lg shadow-xl z-50 w-72 overflow-hidden"
                       style={{ border: '1px solid rgba(199,191,239,0.1)' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
                      <p className="text-xs font-semibold text-sf-cream font-mono">Filtrar por proyecto</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      <button
                        onClick={() => { setFilterProg('all'); setShowFilter(false) }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left font-mono
                          ${filterProg === 'all' ? 'text-sf-cream font-semibold' : 'text-sf-muted'}`}
                        style={filterProg === 'all' ? { background: 'rgba(249,45,151,0.06)' } : {}}
                        onMouseEnter={e => { if (filterProg !== 'all') e.currentTarget.style.background = 'rgba(199,191,239,0.04)' }}
                        onMouseLeave={e => { if (filterProg !== 'all') e.currentTarget.style.background = '' }}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: filterProg === 'all' ? '#F92D97' : 'rgba(199,191,239,0.15)' }} />
                        Todos los proyectos ({allPrograms.length})
                      </button>
                      {allPrograms.map((p, i) => {
                        const color = PROG_COLORS[i % PROG_COLORS.length]
                        const isActive = String(p.id) === filterProg
                        return (
                          <button
                            key={p.id}
                            onClick={() => { setFilterProg(String(p.id)); setShowFilter(false) }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left font-mono
                              ${isActive ? 'text-sf-cream font-semibold' : 'text-sf-muted'}`}
                            style={isActive ? { background: 'rgba(249,45,151,0.06)' } : {}}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(199,191,239,0.04)' }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
                          >
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color.bg }} />
                            <span className="truncate">{p.name}</span>
                            <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'rgba(240,231,228,0.3)' }}>
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
            <div className="flex items-center gap-1 rounded-md p-1" style={{ border: '1px solid rgba(199,191,239,0.1)' }}>
              <button
                onClick={() => setDayWidth(v => Math.max(3, v - 2))}
                className="p-1 rounded transition-colors"
                style={{ color: 'rgba(240,231,228,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
                title="Alejar"
              ><ZoomOut size={14} /></button>
              <span className="text-xs w-12 text-center font-mono" style={{ color: 'rgba(240,231,228,0.3)' }}>{dayWidth}px</span>
              <button
                onClick={() => setDayWidth(v => Math.min(28, v + 2))}
                className="p-1 rounded transition-colors"
                style={{ color: 'rgba(240,231,228,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
                title="Acercar"
              ><ZoomIn size={14} /></button>
            </div>

            {/* Export Excel */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs sm:text-sm rounded-md px-2 sm:px-3 py-1.5 transition-all font-mono"
                style={{ border: '1px solid rgba(199,191,239,0.1)', color: 'rgba(240,231,228,0.5)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(199,191,239,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(199,191,239,0.1)'}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Excel</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-sf-surface rounded-lg shadow-xl z-50 w-72 overflow-hidden"
                       style={{ border: '1px solid rgba(199,191,239,0.1)' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
                      <p className="text-xs font-semibold text-sf-cream font-mono">Descargar calendario Excel</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(240,231,228,0.3)' }}>Selecciona los programas a incluir</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      <button
                        onClick={selectAllForExport}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left font-mono"
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                             style={{
                               background: allPrograms.every(p => selectedForExport[p.id]) ? '#F92D97' : 'transparent',
                               border: allPrograms.every(p => selectedForExport[p.id]) ? '1px solid #F92D97' : '1px solid rgba(199,191,239,0.2)',
                             }}>
                          {allPrograms.every(p => selectedForExport[p.id]) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="font-semibold text-sf-cream">Todos ({allPrograms.length})</span>
                      </button>
                      {allPrograms.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleExportProgram(p.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-1.5 text-xs text-left font-mono text-sf-muted"
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(199,191,239,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                               style={{
                                 background: selectedForExport[p.id] ? '#F92D97' : 'transparent',
                                 border: selectedForExport[p.id] ? '1px solid #F92D97' : '1px solid rgba(199,191,239,0.2)',
                               }}>
                            {selectedForExport[p.id] && <Check size={10} className="text-white" />}
                          </div>
                          <span className="truncate">{p.name}</span>
                          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'rgba(240,231,228,0.3)' }}>
                            {(p.activities || []).length} act.
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(199,191,239,0.08)' }}>
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(240,231,228,0.3)' }}>
                        {Object.values(selectedForExport).filter(Boolean).length || 'Todos'} seleccionados
                      </span>
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="text-xs text-white px-4 py-1.5 rounded-md transition-colors disabled:opacity-50 font-medium font-mono"
                        style={{ background: '#F92D97' }}
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
            <span className="text-[9px] sm:text-[10px] text-sf-muted font-mono">{v.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-4 h-px" style={{ background: '#D0ED40' }} />
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: 'rgba(240,231,228,0.3)' }}>Hoy ({format(todayD, "d MMM", { locale: es })})</span>
        </div>
      </div>

      {/* Gantt container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto rounded-xl"
        style={{ minHeight: 0, background: '#141213', border: '1px solid rgba(199,191,239,0.08)' }}
      >
        <div style={{ width: LEFT_W + totalWidth, minWidth: '100%' }}>

          {/* Header fechas */}
          <div className="sticky top-0 z-30 flex" style={{ background: '#1c1a1b', borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
            <div
              className="sticky left-0 z-40 flex items-end px-4 pb-2 flex-shrink-0"
              style={{ width: LEFT_W, height: HEADER_H, background: '#1c1a1b', borderRight: '1px solid rgba(199,191,239,0.08)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest font-mono" style={{ color: 'rgba(240,231,228,0.3)' }}>
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
                    className="absolute top-0 flex items-center px-3"
                    style={{ left: dStart * dayWidth, width: dLen * dayWidth, height: 30, borderRight: '1px solid rgba(199,191,239,0.06)' }}
                  >
                    <span className="text-xs font-semibold text-sf-cream capitalize whitespace-nowrap font-mono">
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
                    className="absolute bottom-0 flex items-center px-1"
                    style={{ left: w * 7 * dayWidth, width: 7 * dayWidth, height: 26, borderRight: '1px solid rgba(199,191,239,0.06)', borderTop: '1px solid rgba(199,191,239,0.04)' }}
                  >
                    {dayWidth >= 5 && (
                      <span className="text-[10px] whitespace-nowrap font-mono" style={{ color: 'rgba(240,231,228,0.25)' }}>
                        {format(d, 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Today marker header */}
              {todayX !== null && (
                <div className="absolute top-0 bottom-0 z-20 flex flex-col items-center" style={{ left: todayX - 1 }}>
                  <div className="w-0.5 h-full" style={{ background: '#D0ED40', opacity: 0.7 }} />
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
                  className="flex cursor-pointer select-none"
                  style={{ height: PROG_H, borderBottom: '1px solid rgba(199,191,239,0.06)' }}
                  onClick={() => setExpanded(e => ({ ...e, [prog.id]: !e[prog.id] }))}
                >
                  <div
                    className="sticky left-0 z-20 flex items-center gap-2 px-4 flex-shrink-0"
                    style={{ width: LEFT_W, backgroundColor: color.bg, borderRight: `1px solid ${color.border}` }}
                  >
                    <span style={{ color: color.textDark ? 'rgba(20,18,19,0.6)' : 'rgba(255,255,255,0.7)' }}>
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    <span className="text-xs font-semibold truncate flex-1 font-display"
                          style={{ color: color.textDark ? '#141213' : '#ffffff' }}>{prog.name}</span>
                    <span className="text-[10px] flex-shrink-0 font-mono"
                          style={{ color: color.textDark ? 'rgba(20,18,19,0.5)' : 'rgba(255,255,255,0.5)' }}>
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
                          style={{ left: progLeft, width: Math.max(progWidth, 6), height: PROG_H - 16, backgroundColor: color.bg, opacity: 0.12 }}
                        />
                        {/* Progress fill */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-md"
                          style={{ left: progLeft, width: Math.max(progWidth * (pct / 100), 3), height: PROG_H - 16, backgroundColor: color.bg, opacity: 0.45 }}
                        />
                      </>
                    )}
                    {/* Today */}
                    {todayX !== null && (
                      <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: todayX, background: '#D0ED40', opacity: 0.35 }} />
                    )}
                    {/* Week grid */}
                    {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                      <div key={w} className="absolute top-0 bottom-0" style={{ left: (w + 1) * 7 * dayWidth, width: 1, background: 'rgba(199,191,239,0.04)' }} />
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
                      className={`flex transition-colors group
                        ${isDragging ? 'opacity-40' : ''}`}
                      style={{
                        height: ROW_H,
                        borderBottom: '1px solid rgba(199,191,239,0.04)',
                        ...(dragState && dragState.progId === prog.id && !isDragging ? { borderTop: '2px solid transparent' } : {}),
                      }}
                    >
                      {/* Nombre actividad + responsable + drag handle */}
                      <div
                        className="sticky left-0 z-20 flex items-center px-2 gap-1.5 flex-shrink-0 transition-colors"
                        style={{ width: LEFT_W, background: '#141213', borderRight: '1px solid rgba(199,191,239,0.06)' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1c1a1b'}
                        onMouseLeave={e => e.currentTarget.style.background = '#141213'}
                      >
                        <GripVertical size={12} className="flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'rgba(199,191,239,0.2)' }} />
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.bar }} />
                        <span
                          className="text-xs truncate flex-1 font-mono"
                          style={{ color: isOverdue ? '#F92D97' : 'rgba(240,231,228,0.6)' }}
                          title={act.name}
                        >
                          {act.name}
                        </span>
                        {responsible && (
                          <span className="text-[9px] flex-shrink-0 max-w-[60px] truncate font-mono" style={{ color: 'rgba(240,231,228,0.25)' }} title={responsible}>
                            {responsible.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Barra */}
                      <div className="relative flex-1" style={{ width: totalWidth }}>
                        {/* Week grid */}
                        {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                          <div key={w} className="absolute top-0 bottom-0" style={{ left: (w + 1) * 7 * dayWidth, width: 1, background: 'rgba(199,191,239,0.04)' }} />
                        ))}
                        {/* Today */}
                        {todayX !== null && (
                          <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: todayX, background: '#D0ED40', opacity: 0.2 }} />
                        )}
                        {/* Activity bar */}
                        {hasDate && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-sm cursor-default transition-all"
                            style={{
                              left: barLeft,
                              width: barW,
                              height: ROW_H - 10,
                              backgroundColor: isOverdue ? 'rgba(249,45,151,0.4)' : col.bar,
                              border: isOverdue ? '1px solid #F92D97' : 'none',
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
                                className="block h-full flex items-center px-2 text-[10px] font-medium truncate leading-none font-mono"
                                style={{ color: isOverdue ? '#F92D97' : col.text, lineHeight: `${ROW_H - 10}px` }}
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
      <div className="mt-3 flex items-center gap-6 text-xs font-mono" style={{ color: 'rgba(240,231,228,0.25)' }}>
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
      <div className="h-8 rounded w-48" style={{ background: 'rgba(199,191,239,0.08)' }} />
      <div className="h-[70vh] rounded-xl" style={{ background: 'rgba(199,191,239,0.06)' }} />
    </div>
  )
}
