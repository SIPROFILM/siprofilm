import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { PageHeader } from '../components/Layout'
import { Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

export default function Participants() {
  const { activeOrg } = useOrg()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]    = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null)

  useEffect(() => { load() }, [activeOrg?.id])

  async function load() {
    let query = supabase
      .from('participants')
      .select('*')
      .order('name')
    if (activeOrg?.id) {
      query = query.eq('org_id', activeOrg.id)
    }
    const { data } = await query
    setParticipants(data ?? [])
    setLoading(false)
  }

  async function toggleActive(id, current) {
    await supabase.from('participants').update({ is_active: !current }).eq('id', id)
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este participante?')) return
    await supabase.from('participants').delete().eq('id', id)
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <PageLoading />

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        title="Participantes"
        subtitle="Equipo de producción disponible para asignar a actividades"
        action={
          <button
            onClick={() => { setShowForm(true); setEditId(null) }}
            className="flex items-center gap-2 text-white text-sm
                       px-4 py-2.5 rounded-md transition-colors font-mono font-medium"
            style={{ background: '#F92D97' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={16} />
            Agregar
          </button>
        }
      />

      {showForm && (
        <ParticipantForm
          onSaved={() => { load(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
          orgId={activeOrg?.id}
        />
      )}

      {participants.length === 0 && !showForm ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <div className="bg-sf-surface rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(199,191,239,0.04)', borderBottom: '1px solid rgba(199,191,239,0.08)' }}>
                <th className="text-left px-6 py-3 text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Email</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-sf-muted uppercase tracking-wide font-mono">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                editId === p.id ? (
                  <EditRow key={p.id} participant={p}
                    onSaved={() => { load(); setEditId(null) }}
                    onCancel={() => setEditId(null)} />
                ) : (
                  <tr key={p.id}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(199,191,239,0.08)',
                      background: hoveredRow === p.id ? 'rgba(199,191,239,0.04)' : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(p.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center
                                        text-xs font-semibold font-mono"
                          style={{ background: 'rgba(199,191,239,0.04)', color: 'rgba(240,231,228,0.6)' }}>
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-sf-cream">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono" style={{ color: 'rgba(240,231,228,0.6)' }}>
                      {p.role || <span style={{ color: 'rgba(240,231,228,0.4)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sf-muted font-mono">
                      {p.email || <span style={{ color: 'rgba(240,231,228,0.4)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => toggleActive(p.id, p.is_active)}>
                        {p.is_active
                          ? <Check size={16} style={{ color: '#D0ED40' }} className="mx-auto" />
                          : <X size={16} style={{ color: 'rgba(240,231,228,0.4)' }} className="mx-auto" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditId(p.id)}
                          className="transition-colors"
                          style={{ color: 'rgba(240,231,228,0.4)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#F0E7E4'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,231,228,0.4)'}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(p.id)}
                          className="transition-colors"
                          style={{ color: 'rgba(240,231,228,0.4)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#F92D97'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,231,228,0.4)'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ParticipantForm({ onSaved, onCancel, orgId }) {
  const [form, setForm] = useState({ name: '', role: '', email: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    const { error: err } = await supabase.from('participants').insert([{
      name: form.name.trim(), role: form.role, email: form.email || null,
      org_id: orgId || null,
    }])
    if (err) { setError('Error al guardar. ¿Email duplicado?'); setSaving(false) }
    else onSaved()
  }

  return (
    <div className="bg-sf-surface rounded-lg p-5 mb-5"
      style={{ border: '1px solid rgba(199,191,239,0.08)' }}>
      <p className="text-xs font-semibold text-sf-muted uppercase tracking-wide mb-4 font-display">Nuevo participante</p>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls} placeholder="Nombre completo" />
        </div>
        <div>
          <label className={labelCls}>Rol</label>
          <input type="text" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className={inputCls} placeholder="ej. Directora, Editor" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={inputCls} placeholder="opcional" />
        </div>
      </div>
      {error && <p className="text-xs mb-3" style={{ color: '#F92D97' }}>{error}</p>}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="text-white text-xs font-mono font-medium px-5 py-2 rounded-md
                     transition-colors disabled:opacity-50"
          style={{ background: '#F92D97' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel}
          className="text-xs text-sf-muted transition-colors font-mono"
          onMouseEnter={e => e.currentTarget.style.color = '#F0E7E4'}
          onMouseLeave={e => e.currentTarget.style.color = ''}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function EditRow({ participant, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: participant.name, role: participant.role ?? '', email: participant.email ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('participants').update({
      name: form.name.trim(), role: form.role, email: form.email || null,
    }).eq('id', participant.id)
    onSaved()
  }

  return (
    <tr style={{ borderBottom: '1px solid rgba(75,82,235,0.15)', background: 'rgba(75,82,235,0.05)' }}>
      <td className="px-6 py-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className={inputCls + ' py-1.5'} />
      </td>
      <td className="px-4 py-2">
        <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          className={inputCls + ' py-1.5'} placeholder="Rol" />
      </td>
      <td className="px-4 py-2">
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className={inputCls + ' py-1.5'} placeholder="Email" />
      </td>
      <td />
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 justify-end">
          <button onClick={handleSave} disabled={saving}
            style={{ color: '#D0ED40' }}
            className="transition-colors"
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}><Check size={16} /></button>
          <button onClick={onCancel}
            className="transition-colors"
            style={{ color: 'rgba(240,231,228,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#F0E7E4'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,231,228,0.4)'}><X size={16} /></button>
        </div>
      </td>
    </tr>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-20">
      <Users size={40} style={{ color: 'rgba(240,231,228,0.4)' }} className="mx-auto mb-4" />
      <h3 className="text-sm font-medium text-sf-muted mb-2 font-display">Sin participantes todavía</h3>
      <p className="text-xs mb-6 font-mono" style={{ color: 'rgba(240,231,228,0.4)' }}>Agregá los integrantes del equipo de producción.</p>
      <button onClick={onAdd}
        className="inline-flex items-center gap-2 text-white text-sm
                   px-4 py-2.5 rounded-md transition-colors font-mono"
        style={{ background: '#F92D97' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
        <Plus size={15} />
        Agregar participante
      </button>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'rgba(199,191,239,0.08)' }} />
      <div className="h-48 rounded-lg" style={{ background: 'rgba(199,191,239,0.08)' }} />
    </div>
  )
}

const labelCls = 'block text-xs font-medium text-sf-muted uppercase tracking-wide mb-1 font-mono'
const inputCls = 'w-full rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4B52EB]'
  + ' bg-[#141213] text-[#F0E7E4] border border-[#C7BFEF1A] placeholder:text-[#F0E7E466]'
