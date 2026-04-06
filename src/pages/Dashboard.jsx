import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS } from '../lib/utils'
import {
  Film, Plus, ArrowRight, DollarSign, Calendar,
  ChevronDown, ChevronRight, Lightbulb, PenTool,
  Clapperboard, Scissors, Truck, SlidersHorizontal
} from 'lucide-react'

const STAGE_CONFIG = [
  { key: 'produccion',     label: 'Producción',      icon: Clapperboard,      bg: 'bg-[#BE1E2D]', bgLight: 'bg-red-50',        iconColor: 'text-[#BE1E2D]', border: 'border-[#BE1E2D]/20' },
  { key: 'postproduccion', label: 'Postproducción',   icon: Scissors,          bg: 'bg-[#c4a882]', bgLight: 'bg-amber-50',      iconColor: 'text-[#a08560]', border: 'border-[#c4a882]/30' },
  { key: 'preproduccion',  label: 'Preproducción',    icon: SlidersHorizontal, bg: 'bg-[#d4c5a9]', bgLight: 'bg-[#f5f0e6]',     iconColor: 'text-[#9a8b6f]', border: 'border-[#d4c5a9]/40' },
  { key: 'desarrollo',     label: 'Desarrollo',       icon: PenTool,           bg: 'bg-[#6b7d6e]', bgLight: 'bg-[#eef2ef]',     iconColor: 'text-[#6b7d6e]', border: 'border-[#6b7d6e]/20' },
  { key: 'incubadora',     label: 'Incubadora',       icon: Lightbulb,         bg: 'bg-[#8c9490]', bgLight: 'bg-[#f0f1f0]',     iconColor: 'text-[#6b7370]', border: 'border-[#8c9490]/20' },
  { key: 'distribucion',   label: 'Distribución',     icon: Truck,             bg: 'bg-[#2d2d2d]', bgLight: 'bg-gray-50',       iconColor: 'text-[#2d2d2d]', border: 'border-gray-200' },
]

export default function Dashboard() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('programs')
        .select(`
          id, name, status, start_date, stage, created_at,
          activities(id, status, daily_cost, duration_days, cost_type)
        `)
        .order('name', { ascending: true })

      if (data) setPrograms(data)
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

  // Ungrouped
  const ungrouped = programs.filter(p => !STAGE_CONFIG.some(s => s.key === p.stage))

  // Global stats
  const totalBudget = programs.reduce((sum, p) =>
    sum + (p.activities?.reduce((s, a) => {
      if (a.cost_type === 'fixed') return s + (a.daily_cost || 0)
      return s + (a.daily_cost || 0) * (a.duration_days || 1)
    }, 0) ?? 0)
  , 0)

  if (loading) return <PageLoading />

  return (
    <div className="p-8">
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

      {/* Stage summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Total card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Film size={18} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total programas</span>
          </div>
          <div className="text-2xl font-semibold text-[#1a1a1a]">{programs.length}</div>
        </div>

        {/* Budget card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign size={18} className="text-green-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Presupuesto total</span>
          </div>
          <div className="text-2xl font-semibold text-[#1a1a1a]">{fmtMXN(totalBudget)}</div>
        </div>

        {/* Stage breakdown mini */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clapperboard size={18} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Por etapa</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {grouped.map(({ key, label, bg, programs: sp }) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${bg}`} />
                <span className="text-xs text-gray-600">{sp.length}</span>
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stage sections */}
      {programs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ key, label, icon: Icon, bg, bgLight, iconColor, border, programs: stagePrograms }) => (
            <div key={key} className={`bg-white border ${border} rounded-xl overflow-hidden`}>
              {/* Stage card header */}
              <button
                onClick={() => toggleStage(key)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/50`}
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

              {/* Expanded program list */}
              {expanded[key] && (
                <div className="border-t border-gray-100 bg-[#fafaf8]">
                  {stagePrograms.map((program, i) => (
                    <ProgramRow key={program.id} program={program} last={i === stagePrograms.length - 1} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped */}
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
          <div className="bg-[#2d2d2d] rounded-l-full" style={{ width: `${pctDone}%` }} />
          <div className="bg-[#c4a882]" style={{ width: `${pctProg}%` }} />
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
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  )
}
