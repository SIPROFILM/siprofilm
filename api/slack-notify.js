/**
 * Vercel Serverless Function: Slack notification proxy for SIPROFILM
 * Avoids CORS issues by proxying Slack webhook calls through the server.
 * Deployed automatically with `git push` — no Supabase CLI needed.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const STATUS_EMOJI = {
  pending: ':white_circle:',
  in_progress: ':large_blue_circle:',
  delivered: ':white_check_mark:',
  blocked: ':red_circle:',
}
const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  delivered: 'Entregada',
  blocked: 'Bloqueada',
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { type, payload } = req.body

    // Get webhook URL from settings table
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'slack_webhook_url')
      .single()

    if (!settings?.value) {
      return res.status(400).json({ error: 'Slack webhook URL not configured' })
    }

    const webhookUrl = settings.value
    let slackMessage = null

    // ---- Activity status change ----
    if (type === 'activity_status_change') {
      const { program_name, activity_name, old_status, new_status, responsible } = payload
      slackMessage = {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${STATUS_EMOJI[new_status] || ':arrow_right:'} *${activity_name}* cambió de estado`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible || '—'}` },
              { type: 'mrkdwn', text: `*Antes:*\n${STATUS_LABEL[old_status] || old_status}` },
              { type: 'mrkdwn', text: `*Ahora:*\n${STATUS_LABEL[new_status] || new_status}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `:film_frames: SIPROFILM · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` },
            ],
          },
        ],
      }
    }

    // ---- Blocked alert ----
    else if (type === 'blocked_alert') {
      const { program_name, activity_name, responsible } = payload
      slackMessage = {
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: ':rotating_light: *ACTIVIDAD BLOQUEADA*' },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
              { type: 'mrkdwn', text: `*Actividad:*\n${activity_name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible || '—'}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: ':film_frames: SIPROFILM' },
            ],
          },
        ],
      }
    }

    // ---- Daily summary ----
    else if (type === 'daily_summary') {
      const { data: programs } = await supabase
        .from('programs')
        .select('id, name, stage, status, activities(id, name, status, end_date, responsible:participants(name))')
        .neq('stage', 'incubadora')
        .order('name')

      if (!programs) throw new Error('Could not fetch programs')

      const STAGE_EMOJI = {
        desarrollo: ':pencil2:',
        preproduccion: ':gear:',
        produccion: ':clapper:',
        postproduccion: ':scissors:',
        distribucion: ':truck:',
      }
      const STAGE_LABEL = {
        desarrollo: 'Desarrollo',
        preproduccion: 'Preproducción',
        produccion: 'Producción',
        postproduccion: 'Postproducción',
        distribucion: 'Distribución',
      }

      const today = new Date()
      const in7days = new Date(today)
      in7days.setDate(in7days.getDate() + 7)

      // Global stats
      const allActs = programs.flatMap(p => p.activities || [])
      const totalActs = allActs.length
      const globalDelivered = allActs.filter(a => a.status === 'delivered').length
      const globalPct = totalActs > 0 ? Math.round((globalDelivered / totalActs) * 100) : 0
      const globalBlocked = allActs.filter(a => a.status === 'blocked').length

      const dateStr = today.toLocaleDateString('es-MX', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Mexico_City',
      })

      // Build blocks
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: ':film_frames: Resumen Diario SIPROFILM' } },
        { type: 'section', text: { type: 'mrkdwn', text: `_${dateStr}_` } },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${programs.length} proyectos activos* · Avance total: *${globalPct}%* · ${globalDelivered}/${totalActs} entregadas${globalBlocked > 0 ? ` · :red_circle: ${globalBlocked} bloqueadas` : ''}`,
          },
        },
        { type: 'divider' },
      ]

      // Per-project breakdown
      for (const prog of programs) {
        const acts = prog.activities || []
        if (acts.length === 0) continue

        const delivered = acts.filter(a => a.status === 'delivered').length
        const total = acts.length
        const pct = Math.round((delivered / total) * 100)
        const blocked = acts.filter(a => a.status === 'blocked')
        const overdue = acts.filter(a =>
          a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
        )
        const upcoming = acts.filter(a => {
          if (a.status === 'delivered' || !a.end_date) return false
          const d = new Date(a.end_date)
          return d >= today && d <= in7days
        })
        const inProgress = acts.filter(a => a.status === 'in_progress')

        const stageEmoji = STAGE_EMOJI[prog.stage] || ':film_frames:'
        const stageLabel = STAGE_LABEL[prog.stage] || prog.stage

        // Progress bar visual (10 chars)
        const filledCount = Math.round(pct / 10)
        const progressBar = '▓'.repeat(filledCount) + '░'.repeat(10 - filledCount)

        let projectText = `${stageEmoji} *${prog.name}*  ·  ${stageLabel}\n`
        projectText += `\`${progressBar}\` ${pct}%  (${delivered}/${total})\n`

        // What's in progress right now
        if (inProgress.length > 0) {
          projectText += `:large_blue_circle: _En proceso:_ ${inProgress.map(a => a.name).join(', ')}\n`
        }

        // What's coming this week
        if (upcoming.length > 0) {
          const upList = upcoming.slice(0, 3).map(a => {
            const d = new Date(a.end_date)
            const dayName = d.toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'America/Mexico_City' })
            return `${a.name} (${dayName})`
          })
          projectText += `:calendar: _Esta semana:_ ${upList.join(', ')}${upcoming.length > 3 ? ` +${upcoming.length - 3} más` : ''}\n`
        }

        // Overdue
        if (overdue.length > 0) {
          const ovList = overdue.slice(0, 3).map(a => a.name)
          projectText += `:warning: _Vencidas:_ ${ovList.join(', ')}${overdue.length > 3 ? ` +${overdue.length - 3} más` : ''}\n`
        }

        // Blocked
        if (blocked.length > 0) {
          const blList = blocked.map(a => {
            const resp = a.responsible?.name
            return resp ? `${a.name} (${resp})` : a.name
          })
          projectText += `:red_circle: _Bloqueadas:_ ${blList.join(', ')}\n`
        }

        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: projectText } })
      }

      // Programs with no activities
      const emptyProgs = programs.filter(p => (p.activities || []).length === 0)
      if (emptyProgs.length > 0) {
        const names = emptyProgs.map(p => p.name).join(', ')
        blocks.push({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `:grey_question: _Sin actividades:_ ${names}` }],
        })
      }

      blocks.push({ type: 'divider' })
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Generado automáticamente por SIPROFILM · CAPRO' }],
      })

      slackMessage = { blocks }
    }

    else {
      return res.status(400).json({ error: `Unknown type: ${type}` })
    }

    // Send to Slack
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    })

    if (!slackRes.ok) {
      const errText = await slackRes.text()
      throw new Error(`Slack error: ${slackRes.status} - ${errText}`)
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Slack notify error:', error)
    return res.status(500).json({ error: error.message })
  }
}
