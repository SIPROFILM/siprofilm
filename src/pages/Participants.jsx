import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

export default function Participants() {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]    = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .order('name')
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
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="Participantes"
        subtitle="Equipo de producción disponible para asignar a actividades"
        action={
          <button
            onClick={() => { setShowForm(true); setEditId(null) }}
            className="flex items-center gap-2 bg-[#1a1a1a] text-white text-sm
                       px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors font-medium"
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
        />
      )}

      {participants.length === 0 && !showForm ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Activo</th>
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
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center
                                        text-xs font-semibold text-gray-600">
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-[#1a1a1a]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{p.role || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-gray-500">{p.email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => toggleActive(p.id, p.is_active)}>
                        {p.is_active
                          ? <Check size={16} className="text-green-500 mx-auto" />
                          : <X size={16} className="text-gray-300 mx-auto" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditId(p.id)}
                          className="text-gray-400 hover:text-gray-700 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(p.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors">
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

function ParticipantForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ name: '', role: '', email: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    const { error: err } = await supabase.from('participants').insert([{
      name: form.name.trim(), role: form.role, email: form.email || null,
    }])
    if (err) { setError('Error al guardar. ¿Email duplicado?'); setSaving(false) }
    else onSaved()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Nuevo participante</p>
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
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="bg-[#1a1a1a] text-white text-xs font-medium px-5 py-2 rounded-md
                     hover:bg-gray-800 transition-colors disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
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
    <tr className="border-b border-blue-100 bg-blue-50/20">
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
            className="text-green-600 hover:text-green-800"><Check size={16} /></button>
          <button onClick={onCancel}
            className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
      </td>
    </tr>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-20">
      <Users size={40} className="text-gray-300 mx-auto mb-4" />
      <h3 className="text-sm font-medium text-gray-500 mb-2">Sin participantes todavía</h3>
      <p className="text-xs text-gray-400 mb-6">Agregá los integrantes del equipo de producción.</p>
      <button onClick={onAdd}
        className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-sm
                   px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors">
        <Plus size={15} />
        Agregar participante
      </button>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="p-8 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-200 rounded-lg" />
    </div>
  )
}

const labelCls = 'block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1'
const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] bg-white'
