import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'

/**
 * Hook to manage program-level access control
 * Loads the current user's program_members entries for the active org
 *
 * Returns: { memberPrograms, userRole(programId), isAdmin, loading }
 * - memberPrograms: array of program IDs user has access to
 * - userRole(programId): returns the user's role for a specific program ('admin', 'producer', 'collaborator', 'viewer'), or null if no access
 * - isAdmin: true if user is org admin OR if no program_members entries exist yet (backward compatibility)
 * - loading: boolean indicating if data is still loading
 */
export function useProgramAccess() {
  const { user } = useAuth()
  const { activeOrg, isAdmin: isOrgAdmin } = useOrg()
  const [memberPrograms, setMemberPrograms] = useState([])
  const [roleMap, setRoleMap] = useState({}) // { programId: role }
  const [loading, setLoading] = useState(true)
  const [hasLoadedYet, setHasLoadedYet] = useState(false)

  useEffect(() => {
    if (!user || !activeOrg?.id) {
      setMemberPrograms([])
      setRoleMap({})
      setLoading(false)
      return
    }

    async function loadAccess() {
      setLoading(true)

      try {
        // Fetch all program_members for this user in the active org
        const { data, error } = await supabase
          .from('program_members')
          .select('program_id, role')
          .eq('user_id', user.id)

        if (error) {
          console.error('Error loading program access:', error)
          setMemberPrograms([])
          setRoleMap({})
          setLoading(false)
          setHasLoadedYet(true)
          return
        }

        const progs = (data || []).map(d => d.program_id)
        const roles = {}
        ;(data || []).forEach(d => {
          roles[d.program_id] = d.role
        })

        setMemberPrograms(progs)
        setRoleMap(roles)
        setHasLoadedYet(true)
      } catch (err) {
        console.error('Unexpected error in useProgramAccess:', err)
        setMemberPrograms([])
        setRoleMap({})
        setHasLoadedYet(true)
      }

      setLoading(false)
    }

    loadAccess()
  }, [user?.id, activeOrg?.id])

  function userRole(programId) {
    return roleMap[programId] || null
  }

  // If org admin, they see everything. Otherwise, if backward compat mode (no entries loaded yet)
  // treat as admin to maintain backward compatibility.
  const isAdmin = isOrgAdmin || (!hasLoadedYet && !loading)

  return {
    memberPrograms,
    userRole,
    isAdmin,
    loading,
  }
}

