import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'

/**
 * Hook that loads org-specific project types from the database.
 * Returns an array of { key, label } objects.
 */
export function useProjectTypes() {
  const { activeOrg } = useOrg()
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeOrg?.id) {
      setTypes([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('org_project_types')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('sort_order')

      if (error) {
        console.error('Error loading project types:', error)
        setTypes([])
      } else {
        setTypes((data || []).map(t => ({
          key:   t.key,
          label: t.label,
        })))
      }
      setLoading(false)
    }

    load()
  }, [activeOrg?.id])

  // Build a labels map { key: label }
  const typeLabels = types.reduce((acc, t) => {
    acc[t.key] = t.label
    return acc
  }, {})

  return { types, typeLabels, loading }
}
