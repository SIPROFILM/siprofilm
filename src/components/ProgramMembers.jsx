import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Plus, X, Trash2, Mail, Shield, Send, CheckCircle2 } from 'lucide-react'

const ROLE_LABELS = {
  admin: 'Administrador',
  producer: 'Productor',
  collaborator: 'Colaborador',
  viewer: 'Viewer',
}

const ROLE_DESC = {
  admin: 'Acceso total al proyecto',
  producer: 'Gestiona actividades y equipo',
  collaborator: 'Actualiza estado de sus tareas',
  viewer: 'Solo lectura',
}

export default function ProgramMembers({ programId, programName, slackChannelId, canManage }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('collaborator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadMembers() }, [programId])

  async function loadMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('program_members')
      .select('id, user_id, role, created_at')
      .eq('program_id', programId)
      .order('created_at')

    if (data && data.length > 0) {
      // fetch emails via RPC or direct query on auth.users is not available from client
      // Instead, fetch profiles if we have a profiles table, else use user_id only
      const userIds = data.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', userIds)

      const emailMap = {}
      ;(profiles || []).forEach(p => { emailMap[p.user_id] = p.email })
      setMembers(data.map(m => ({
        ...m,
        email: emailMap[m.user_id] || m.user_id.slice(0, 8) + '…',
        invitedToSlack: !!m.slack_member_id,
      })))
    } else {
      setMembers([])
    }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const cleanEmail = email.trim().toLowerCase()

      // Lookup user by email via RPC function
      const { data: userData, error: rpcErr } = await supabase
        .rpc('get_user_id_by_email', { p_email: cleanEmail })

      if (rpcErr) throw rpcErr
      if (!userData) {
        setError('No existe un usuario con ese correo en SIPROFILM. Pídele que se registre primero.')
        setSaving(false)
        return
      }

      // Confirmación explícita antes de agregar al proyecto
      const confirmed = confirm(
        `¿Agregar a ${cleanEmail} al proyecto "${programName}" con rol de ${ROLE_LABELS[role]}?\n\n` +
        `Esta persona podrá entrar y ver este proyecto en SIPROFILM.\n\n` +
        `(No se enviará ninguna invitación de Slack. Eso es aparte.)`
      )
      if (!confirmed) {
        setSaving(false)
        return
      }

      const { error: insertErr } = await supabase
        .from('program_members')
        .insert({ program_id: programId, user_id: userData, role })

      if (insertErr) {
        if (insertErr.code === '23505') {
          setError('Este usuario ya es miembro del proyecto.')
        } else {
          setError(insertErr.message)
        }
        setSaving(false)
        return
      }

      setEmail('')
      setRole('collaborator')
      setShowAdd(false)
      await loadMembers()
    } catch (err) {
      setError(err.message || 'Error al agregar miembro')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(memberId) {
    if (!confirm('¿Quitar a este miembro del proyecto?')) return
    await supabase.from('program_members').delete().eq('id', memberId)
    await loadMembers()
  }

  async function handleRoleChange(memberId, newRole) {
    await supabase.from('program_members').update({ role: newRole }).eq('id', memberId)
    await loadMembers()
  }

  async function handleSlackInvite(member) {
    const ok = confirm(
      `¿Invitar a ${member.email} al canal de Slack de este proyecto?\n\n` +
      `Esto enviará una invitación de Slack. Solo funciona si la persona ya tiene cuenta de Slack en tu workspace con ese correo.`
    )
    if (!ok) return

    try {
      const { inviteMemberToChannel } = await import('../lib/slack')
      const result = await inviteMemberToChannel({ channelId: slackChannelId, email: member.email })
      if (result.success) {
        // Save slack_member_id if returned
        if (result.data?.slack_user_id) {
          await supabase
            .from('program_members')
            .update({ slack_member_id: result.data.slack_user_id })
            .eq('id', member.id)
        }
        alert(result.data?.already_in_channel
          ? 'Esta persona ya estaba en el canal de Slack.'
          : 'Invitación enviada a Slack.')
        await loadMembers()
      } else {
        alert(`No se pudo invitar: ${result.error || result.reason || 'error desconocido'}`)
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Equipo del proyecto</h2>
          <span className="text-xs text-gray-400">({members.length})</span>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1a1a1a]
                       border border-gray-200 rounded-md px-3 py-1.5 hover:border-gray-400 transition-all"
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Cancelar' : 'Invitar miembro'}
          </button>
        )}
      </div>

      {showAdd && canManage && (
        <form onSubmit={handleAdd} className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-500 mb-1">Correo del miembro</label>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2">
                <Mail size={14} className="text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-sm outline-none"
                />
              </div>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs text-gray-500 mb-1">Rol</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="admin">Administrador</option>
                <option value="producer">Productor</option>
                <option value="collaborator">Colaborador</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#1a1a1a] text-white text-sm rounded-md px-4 py-2 hover:bg-black disabled:opacity-50"
            >
              {saving ? 'Agregando…' : 'Revisar y agregar'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">{ROLE_DESC[role]}</p>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <p className="text-xs text-gray-400 mt-1">Solo se agrega al proyecto en SIPROFILM. La invitación a Slack es aparte.</p>
        </form>
      )}

      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Cargando miembros…</div>
        ) : members.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Aún no hay miembros asignados.</div>
        ) : (
          members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                  {(m.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-[#1a1a1a]">{m.email}</div>
                  <div className="text-xs text-gray-400">{ROLE_DESC[m.role]}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="producer">Productor</option>
                    <option value="collaborator">Colaborador</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Shield size={12} /> {ROLE_LABELS[m.role]}
                  </span>
                )}
                {canManage && slackChannelId && (
                  m.invitedToSlack ? (
                    <span className="text-xs text-green-600 flex items-center gap-1" title="Ya invitado a Slack">
                      <CheckCircle2 size={12} /> Slack
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSlackInvite(m)}
                      className="text-xs text-gray-500 hover:text-[#1a1a1a] border border-gray-200 rounded px-2 py-1 flex items-center gap-1"
                      title="Invitar al canal de Slack del proyecto"
                    >
                      <Send size={11} /> Invitar a Slack
                    </button>
                  )
                )}
                {canManage && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Quitar del proyecto"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
