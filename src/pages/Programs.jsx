import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS } from '../lib/utils'
import { Film, Plus, ArrowRight, Calendar, Search } from 'lucide-react'

const STAGE_LABELS = {
  all:             'Todos',
  incubadora:      'Incubadora',
  desarrollo:      'Desarrollo',
  preproduccion:   'Preproducción',
  produccion:      'Producción',
  postproduccion:  'Postproducción',
  distribucion:    'Distribución',
}

export default function Programs() {
  const [programs, setPrograms]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('programs')
        .select(`
          id, name, status, start_date, stage, created_at,
          activities(id, status, daily_cost, duration_days)
        `)
        .order('name', { ascending: true })

      if (data) setPrograms(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = programs.filter(p => {
    if (stageFilter !== 'all' && p.stage !== stageFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Count per stage
  const stageCounts = programs.reduce((acc, p) => {
    acc[p.stage] = (acc[p.stage] || 0) + 1
    return acc
  }, {})

  if (loading) return <PageLoading />

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Programas"
        subtitle={`${programs.length} programas en total`}
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

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar programa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md
                       bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>

        {/* Stage tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {Object.entries(STAGE_LABELS).map(([key, label]) => {
            const count = key === 'all' ? programs.length : (stageCounts[key] || 0)
            if (key !== 'all' && count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setStageFilter(key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap
                  ${stageFilter === key
                    ? 'bg-[#1a1a1a] text-white font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Programs list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Film size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search ? 'No se encontraron programas con ese nombre' : 'No hay programas en esta etapa'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(program => (
            <ProgramRow key={program.id} program={program} />
          ))}
        </div>
      )}
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
  const stageLabel = STAGE_LABELS[program.stage] || program.stage || '—'

  return (
    <Link
      to={`/programas/${program.id}`}
      className="flex items-center gap-5 bg-white border border-gray-200 rounded-lg px-5 py-4
                 hover:border-gray-400 hover:shadow-sm transition-all group"
    >
      {/* Name & meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="font-medium text-[#1a1a1a] truncate text-sm">{program.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium uppercase">
            {stageLabel}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {fmtDate(program.start_date)}
          </span>
        </div>
      </div>

      {/* Activities / Progress */}
      <div className="w-32">
        {total > 0 ? (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{delivered}/{total}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a1a1a] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <span className="text-xs text-gray-400">Sin actividades</span>
        )}
      </div>

      {/* Budget */}
      <div className="text-right w-24">
        <div className="text-xs text-gray-400 mb-0.5">Presupuesto</div>
        <div className="text-sm font-medium text-gray-700">{fmtMXN(budget)}</div>
      </div>

      <ArrowRight size={15} className="text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0" />
    </Link>
  )
}

function PageLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="h-10 bg-gray-200 rounded w-full" />
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
      </div>
    </div>
  )
}
