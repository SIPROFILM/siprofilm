import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS } from '../lib/utils'
import { Film, Plus, ArrowRight, ListChecks, DollarSign, Calendar, ChevronDown, ChevronRight } from 'lucide-react'

const STAGE_ORDER = [
  { key: 'produccion',     label: 'Producción',      color: 'bg-[#BE1E2D]' },
  { key: 'postproduccion', label: 'Postproducción',   color: 'bg-[#c4a882]' },
  { key: 'preproduccion',  label: 'Preproducción',    color: 'bg-[#d4c5a9]' },
  { key: 'desarrollo',     label: 'Desarrollo',       color: 'bg-[#6b7d6e]' },
  { key: 'incubadora',     label: 'Incubadora',       color: 'bg-[#8c9490]' },
  { key: 'distribucion',   label: 'Distribución',     color: 'bg-[#2d2d2d]' },
]

export default function Dashboard() {
  const [programs, setPrograms] = useState([])
  const [stats, setStats]       = useState({ total: 0, active: 0, totalBudget: 0 })
  const [loading, setLoading]   = useState(true)
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('programs')
        .select(`
          id, name, status, start_date, stage, created_at,
          activities(id, status, daily_cost, duration_days)
        `)
        .order('name', { ascending: true })

      if (data) {
        setPrograms(data)
        const active = data.filter(p => p.status === 'active').length
        const totalBudget = data.reduce((sum, p) =>
          sum + (p.activities?.reduce((s, a) => s + (a.daily_cost || 0) * (a.duration_days || 1), 0) ?? 0)
        , 0)
        setStats({ total: data.length, active, totalBudget })
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleStage(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Group programs by stage
  const grouped = STAGE_ORDER.map(stage => ({
    ...stage,
    programs: programs.filter(p => p.stage === stage.key),
  })).filter(g => g.programs.length > 0)

  // Programs without a recognized stage
  const ungrouped = programs.filter(p => !STAGE_ORDER.some(s => s.key === p.stage))

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Film size={18} className="text-gray-500" />}
          label="Programas totales"
          value={stats.total}
        />
        <StatCard
          icon={<ListChecks size={18} className="text-blue-500" />}
          label="Activos"
          value={stats.active}
          highlight
        />
        <StatCard
          icon={<DollarSign size={18} className="text-green-600" />}
          label="Presupuesto total"
          value={fmtMXN(stats.totalBudget)}
        />
      </div>

      {/* Programs grouped by stage */}
      {programs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ key, label, color, programs: stagePrograms }) => (
            <div key={key}>
              {/* Stage header */}
              <button
                onClick={() => toggleStage(key)}
                className="flex items-center gap-3 mb-3 group w-full text-left"
              >
                {collapsed[key]
                  ? <ChevronRight size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />
                }
                <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
                <span className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wide">
                  {label}
                </span>
                <span className="text-xs text-gray-400 font-normal">
                  {stagePrograms.length} programa{stagePrograms.length !== 1 ? 's' : ''}
                </span>
                <div className="flex-1 border-b border-gray-200 ml-2" />
              </button>

              {/* Programs in this stage */}
              {!collapsed[key] && (
                <div className="space-y-2 ml-7">
                  {stagePrograms.map(program => (
                    <ProgramRow key={program.id} program={program} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped programs (no stage set) */}
          {ungrouped.length > 0 && (
            <div>
              <button
                onClick={() => toggleStage('_other')}
                className="flex items-center gap-3 mb-3 group w-full text-left"
              >
                {collapsed['_other']
                  ? <ChevronRight size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />
                }
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wide">
                  Sin etapa
                </span>
                <span className="text-xs text-gray-400 font-normal">
                  {ungrouped.length} programa{ungrouped.length !== 1 ? 's' : ''}
                </span>
                <div className="flex-1 border-b border-gray-200 ml-2" />
              </button>
              {!collapsed['_other'] && (
                <div className="space-y-2 ml-7">
                  {ungrouped.map(program => (
                    <ProgramRow key={program.id} program={program} />
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

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`bg-white border rounded-lg p-5 ${highlight ? 'border-blue-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-[#1a1a1a]">{value}</div>
    </div>
  )
}

function ProgramRow({ program }) {
  const { activities = [] } = program
  const total     = activities.length
  const delivered = activities.filter(a => a.status === 'delivered').length
  const progress  = total > 0 ? Math.round((delivered / total) * 100) : 0
  const budget    = activities.reduce((s, a) => s + (a.daily_cost || 0) * (a.duration_days || 1), 0)
  const statusCfg = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active

  return (
    <Link
      to={`/programas/${program.id}`}
      className="flex items-center gap-6 bg-white border border-gray-200 rounded-lg px-6 py-4
                 hover:border-gray-400 hover:shadow-sm transition-all group"
    >
      {/* Name & status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-medium text-[#1a1a1a] truncate">{program.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={11} />
          <span>Inicio: {fmtDate(program.start_date)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-36">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{delivered}/{total} actividades</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1a1a1a] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Budget */}
      <div className="text-right w-28">
        <div className="text-xs text-gray-400 mb-0.5">Presupuesto</div>
        <div className="text-sm font-medium text-gray-700">{fmtMXN(budget)}</div>
      </div>

      <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0" />
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <Film size={40} className="text-gray-300 mx-auto mb-4" />
      <h3 className="text-sm font-medium text-gray-500 mb-2">Sin programas todavía</h3>
      <p className="text-xs text-gray-400 mb-6">Creá tu primer programa de producción para empezar.</p>
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
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
      </div>
    </div>
  )
}
