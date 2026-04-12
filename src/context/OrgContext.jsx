import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs]           = useState([])
  const [activeOrg, setActiveOrg] = useState(null)
  const [membership, setMembership] = useState(null) // { role }
  const [loading, setLoading]     = useState(true)

  // Fetch user's organizations when user changes
  useEffect(() => {
    if (!user) {
      setOrgs([])
      setActiveOrg(null)
      setMembership(null)
      setLoading(false)
      return
    }

    async function fetchOrgs() {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_organizations')
        .select('role, org:organizations(*)')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching orgs:', error)
        setOrgs([])
        setActiveOrg(null)
        setMembership(null)
        setLoading(false)
        return
      }

      const userOrgs = data.map(d => d.org)
      const roles = data.reduce((acc, d) => {
        acc[d.org.id] = d.role
        return acc
      }, {})

      setOrgs(userOrgs)

      // Restore last selected org from localStorage, or pick first
      const savedOrgId = localStorage.getItem('siprofilm_active_org')
      const savedOrg = userOrgs.find(o => o.id === savedOrgId)
      const selected = savedOrg || userOrgs[0] || null

      setActiveOrg(selected)
      setMembership(selected ? { role: roles[selected.id] } : null)
      setLoading(false)
    }

    fetchOrgs()
  }, [user])

  // Switch active org
  function switchOrg(orgId) {
    const org = orgs.find(o => o.id === orgId)
    if (org) {
      setActiveOrg(org)
      localStorage.setItem('siprofilm_active_org', orgId)
    }
  }

  const isAdmin = membership?.role === 'admin'

  return (
    <OrgContext.Provider value={{
      orgs,
      activeOrg,
      membership,
      isAdmin,
      loading,
      switchOrg,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  return useContext(OrgContext)
}
