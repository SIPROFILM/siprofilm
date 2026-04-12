import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import {
  Film, Lightbulb, PenTool, SlidersHorizontal,
  Clapperboard, Scissors, Truck, FileText, Target,
  Package, Megaphone, Eye, Send, ClipboardList
} from 'lucide-react'

// Map icon name strings from DB to actual Lucide components
const ICON_MAP = {
  Film, Lightbulb, PenTool, SlidersHorizontal,
  Clapperboard, Scissors, Truck, FileText, Target,
  Package, Megaphone, Eye, Send, ClipboardList,
}

/**
 * Hook that loads org-specific stages from the database.
 * Returns an array of stage objects compatible with the old STAGE_CONFIG format.
 */
export function useStages() {
  const { activeOrg } = useOrg()
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeOrg?.id) {
      setStages([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('org_stages')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('sort_order')

      if (error) {
        console.error('Error loading stages:', error)
        setStages([])
      } else {
        setStages((data || []).map(s => ({
          key:       s.key,
          label:     s.label,
          icon:      ICON_MAP[s.icon] || Film,
          iconName:  s.icon,
          color:     s.color,
          colorLight: s.color_light,
          // Tailwind-compatible classes derived from DB colors
          bg:        `bg-[${s.color}]`,
          bgLight:   `bg-[${s.color_light}]`,
          iconColor: `text-[${s.color}]`,
          border:    `border-[${s.color}]/20`,
          sortOrder: s.sort_order,
        })))
      }
      setLoading(false)
    }

    load()
  }, [activeOrg?.id])

  // Build a labels map { key: label } for convenience
  const stageLabels = stages.reduce((acc, s) => {
    acc[s.key] = s.label
    return acc
  }, {})

  // Stage keys in order
  const stageKeys = stages.map(s => s.key)

  // Helper: is stageA >= stageB in the order?
  function stageGte(a, b) {
    const ia = stageKeys.indexOf(a)
    const ib = stageKeys.indexOf(b)
    if (ia === -1 || ib === -1) return true
    return ia >= ib
  }

  return { stages, stageLabels, stageKeys, stageGte, loading }
}
