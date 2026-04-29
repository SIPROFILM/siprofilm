import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useStages } from '../hooks/useStages'
import { useProjectTypes } from '../hooks/useProjectTypes'
import { useProgramAccess } from '../hooks/useProgramAccess'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMXN, PROGRAM_STATUS_LABELS } from '../lib/utils'
import { Film, Plus, ArrowRight, Calendar, Search } from 'lucide-react'

export default function Programs() {
  const [programs, setPrograms]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch]         = useState('')
  const { activeOrg, isAdmin } = useOrg()
  const { stageLabels } = useStages()
  const { typeLabels } = useProjectTypes()
  const { memberPrograms, isAdmin: isProgramAdmin } = useProgramAccess()

  // Build dynamic STAGE_LABELS: { all: 'Todos', ...orgStages }
  const STAGE_LABELS = { all: 'Todos', ...stageLabels }

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('programs')
        .select(`
          id, name, status, start_date, stage, created_at,
          activities(id, status, daily_cost, duration_days)
        `)
        .order('name', { ascending: true })

      if (activeOrg?.id) {
        query = query.eq('org_id', activeOrg.id)
      }

      const { data } = await query
      if (data) setPrograms(data)
      setLoading(false)
    }
    load()
  }, [activeOrg?.id])

  const filtered = programs.filter(p => {
    if (stageFilter !== 'all' && p.stage !== stageFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    // If user is not an org admin, filter to only programs they're a member of
    if (!isProgramAdmin && !memberPrograms.includes(p.id)) return false
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
            className="flex items-center gap-2 text-white text-sm
                       px-4 py-2.5 rounded-md transition-colors font-medium font-mono"
            style={{ background: '#F92D97' }}
          >
            <Plus size={16} />
            Nuevo programa
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" />
          <input
            type="text"
            placeholder="Buscar programa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 sm:py-2 text-sm rounded-md
                       focus:outline-none font-mono"
            style={{
              background: '#141213',
              border: '1px solid rgba(199,191,239,0.1)',
              color: '#F0E7E4',
            }}
          />
        </div>

        {/* Stage tabs — horizontal scroll on mobile */}
        <div
          className="flex items-center gap-1 bg-sf-surface rounded-lg p-1 overflow-x-auto no-scrollbar"
          style={{ border: '1px solid rgba(199,191,239,0.08)' }}
        >
          {Object.entries(STAGE_LABELS).map(([key, label]) => {
            const count = key === 'all' ? programs.length : (stageCounts[key] || 0)
            if (key !== 'all' && count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setStageFilter(key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap flex-shrink-0 font-mono
                  ${stageFilter === key
                    ? 'bg-sf-pink text-white font-medium'
                    : 'text-sf-muted'
                  }`}
                style={stageFilter !== key ? { ['--hover-bg']: 'rgba(199,191,239,0.04)' } : undefined}
                onMouseEnter={e => { if (stageFilter !== key) e.currentTarget.style.background = 'rgba(199,191,239,0.04)' }}
                onMouseLeave={e => { if (stageFilter !== key) e.currentTarget.style.background = '' }}
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
          <Film size={36} className="text-sf-muted mx-auto mb-3" />
          <p className="text-sm text-sf-muted font-mono">
            {search ? 'No se encontraron programas con ese nombre' : 'No hay programas en esta etapa'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(program => (
            <ProgramRow key={program.id} program={program} STAGE_LABELS={STAGE_LABELS} typeLabels={typeLabels} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProgramRow({ program, STAGE_LABELS = {}, typeLabels = {} }) {
  const { activities = [] } = program
  const total     = activities.length
  const delivered = activities.filter(a => a.status === 'delivered').length
  const progress  = total > 0 ? Math.round((delivered / total) * 100) : 0
  const budget    = activities.reduce((s, a) => s + (a.daily_cost || 0) * (a.duration_days || 1), 0)
  const statusCfg = PROGRAM_STATUS_LABELS[program.status] ?? PROGRAM_STATUS_LABELS.active
  const stageLabel = STAGE_LABELS[program.stage] || program.stage || '—'
  const typeLabel = typeLabels[program.project_type] || typeLabels[program.project_format] || ''

  return (
    <Link
      to={`/programas/${program.id}`}
      className="block bg-sf-surface rounded-lg px-4 sm:px-5 py-3.5 sm:py-4
                 transition-all group"
      style={{ border: '1px solid rgba(199,191,239,0.08)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(199,191,239,0.15)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(199,191,239,0.08)' }}
    >
      {/* Top: Name + status + arrow */}
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-sf-cream truncate text-sm flex-1 min-w-0 font-display">{program.name}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 font-mono ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
        <ArrowRight size={15} className="text-sf-muted group-hover:text-sf-cream transition-colors flex-shrink-0" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs text-sf-muted mb-2.5 font-mono">
        <span
          className="text-sf-lavender px-2 py-0.5 rounded text-[10px] font-medium uppercase flex-shrink-0 font-mono"
          style={{ background: 'rgba(199,191,239,0.06)' }}
        >
          {stageLabel}
        </span>
        {typeLabel && (
          <span className="text-[10px] text-sf-muted truncate font-mono">{typeLabel}</span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0">
          <Calendar size={10} />
          {fmtDate(program.start_date)}
        </span>
      </div>

      {/* Bottom: Progress + Budget inline */}
      <div className="flex items-center gap-4">
        {total > 0 ? (
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[10px] sm:text-xs text-sf-muted mb-1 font-mono">
              <span>{delivered}/{total} actividades</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(199,191,239,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: '#D0ED40' }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs text-sf-muted flex-1 font-mono">Sin actividades</span>
        )}

        <div className="text-right flex-shrink-0">
          <div className="text-xs sm:text-sm font-medium font-mono" style={{ color: 'rgba(240,231,228,0.5)' }}>{fmtMXN(budget)}</div>
        </div>
      </div>
    </Link>
  )
}

function PageLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 rounded w-1/4" style={{ background: 'rgba(199,191,239,0.08)' }} />
        <div className="h-10 rounded w-full" style={{ background: 'rgba(199,191,239,0.08)' }} />
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-lg" style={{ background: 'rgba(199,191,239,0.08)' }} />)}
      </div>
    </div>
  )
}
