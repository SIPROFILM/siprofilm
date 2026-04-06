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

    // ---- Daily summary (TODO LIST style) ----
    else if (type === 'daily_summary') {
      const { data: programs } = await supabase
        .from('programs')
        .select('id, name, stage, status, project_format, project_genre, actual_cost, estimated_cost, activities(id, name, status, end_date, responsible:participants(name))')
        .order('name')

      if (!programs) throw new Error('Could not fetch programs')

      const STAGE_LABEL = {
        incubadora: 'Incubadora', desarrollo: 'Desarrollo', preproduccion: 'Preproducción',
        produccion: 'Producción', postproduccion: 'Postproducción', distribucion: 'Distribución',
      }
      const STAGE_EMOJI = {
        incubadora: ':seedling:', desarrollo: ':pencil:', preproduccion: ':clipboard:',
        produccion: ':movie_camera:', postproduccion: ':scissors:', distribucion: ':rocket:',
      }
      const STAGE_ORDER = ['produccion', 'postproduccion', 'preproduccion', 'desarrollo', 'incubadora', 'distribucion']

      const today = new Date()
      const in7days = new Date(today)
      in7days.setDate(in7days.getDate() + 7)

      const dateStr = today.toLocaleDateString('es-MX', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Mexico_City',
      })

      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: ':film_frames: TO DO LIST — CAPRO' } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `SIPROFILM · ${dateStr}` }] },
        { type: 'divider' },
      ]

      // ── Determine headline for each project (like Pepe's TODO) ──
      function getHeadline(prog) {
        const acts = prog.activities || []
        const blocked = acts.filter(a => a.status === 'blocked')
        const inProgress = acts.filter(a => a.status === 'in_progress')
        const overdue = acts.filter(a =>
          a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
        )
        const delivered = acts.filter(a => a.status === 'delivered').length
        const total = acts.length

        // Priority: blocked > overdue > in_progress > all delivered > no activities
        if (blocked.length > 0) {
          return `:red_circle: BLOQUEADO: ${blocked.map(a => a.name).join(', ').toUpperCase()}`
        }
        if (overdue.length > 0) {
          return `:warning: VENCIDAS: ${overdue.slice(0, 2).map(a => a.name).join(', ').toUpperCase()}${overdue.length > 2 ? ` (+${overdue.length - 2})` : ''}`
        }
        if (total > 0 && delivered === total) {
          return ':white_check_mark: TODAS LAS ACTIVIDADES ENTREGADAS'
        }
        if (inProgress.length > 0) {
          return inProgress[0].name.toUpperCase()
        }
        const stageLabel = STAGE_LABEL[prog.stage] || prog.stage
        return `EN ${stageLabel.toUpperCase()}`
      }

      // ── Render one project block (TODO LIST style) ──
      function renderProjectBlock(prog) {
        const acts = prog.activities || []
        const stageLabel = STAGE_LABEL[prog.stage] || prog.stage
        const stageEmoji = STAGE_EMOJI[prog.stage] || ':film_frames:'
        const headline = getHeadline(prog)

        // Project name + stage tag
        let text = `*${prog.name}*   ${stageEmoji} _${stageLabel}_\n`
        text += `*${headline}*\n`

        // Pending action items (in_progress + pending with upcoming dates)
        const pending = acts.filter(a => a.status === 'in_progress' || a.status === 'pending')
        const overdue = acts.filter(a =>
          a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
        )
        const upcoming = acts.filter(a => {
          if (a.status === 'delivered' || !a.end_date) return false
          const d = new Date(a.end_date)
          return d >= today && d <= in7days
        })

        // Show action items like bullet points
        const shown = new Set()

        // Overdue first (urgent)
        for (const a of overdue.slice(0, 3)) {
          const responsible = a.responsible?.[0]?.name || ''
          const dateLabel = new Date(a.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
          text += `  :warning: ${a.name}${responsible ? ` — _${responsible}_` : ''} _(venció ${dateLabel})_\n`
          shown.add(a.id)
        }

        // In progress
        const inProg = acts.filter(a => a.status === 'in_progress' && !shown.has(a.id))
        for (const a of inProg.slice(0, 4)) {
          const responsible = a.responsible?.[0]?.name || ''
          text += `  :large_blue_circle: ${a.name}${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

        // Upcoming this week
        const upNext = upcoming.filter(a => !shown.has(a.id))
        for (const a of upNext.slice(0, 3)) {
          const responsible = a.responsible?.[0]?.name || ''
          const dayLabel = new Date(a.end_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'America/Mexico_City' })
          text += `  :calendar: ${a.name} _(${dayLabel})_${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

        // Blocked
        const blocked = acts.filter(a => a.status === 'blocked' && !shown.has(a.id))
        for (const a of blocked) {
          const responsible = a.responsible?.[0]?.name || ''
          text += `  :red_circle: ${a.name}${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

        // If no action items shown but there are pending activities
        const remainPending = pending.filter(a => !shown.has(a.id))
        if (shown.size === 0 && remainPending.length > 0) {
          for (const a of remainPending.slice(0, 3)) {
            const responsible = a.responsible?.[0]?.name || ''
            text += `  :white_circle: ${a.name}${responsible ? ` — _${responsible}_` : ''}\n`
          }
          if (remainPending.length > 3) {
            text += `  _+${remainPending.length - 3} pendientes más_\n`
          }
        }

        // Progress summary line
        if (acts.length > 0) {
          const delivered = acts.filter(a => a.status === 'delivered').length
          const pct = Math.round((delivered / acts.length) * 100)
          text += `  _Avance: ${pct}% (${delivered}/${acts.length})_\n`
        }

        return text
      }

      // Sort programs within a group by stage priority
      function sortByStage(list) {
        return [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
      }

      // ── SERIES ──
      const series = programs.filter(p => p.project_format === 'serie')
      const seriesFiccion = sortByStage(series.filter(p => p.project_genre === 'ficcion'))
      const seriesDoc = sortByStage(series.filter(p => p.project_genre === 'documental'))

      if (series.length > 0) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':tv:  *SERIES*' } })

        if (seriesFiccion.length > 0) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Ficción' }] })
          for (const p of seriesFiccion) {
            blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
          }
        }
        if (seriesDoc.length > 0) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Documental' }] })
          for (const p of seriesDoc) {
            blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
          }
        }
        blocks.push({ type: 'divider' })
      }

      // ── PELÍCULAS ──
      const pelis = programs.filter(p => p.project_format === 'pelicula')
      const pelisFiccion = sortByStage(pelis.filter(p => p.project_genre === 'ficcion'))
      const pelisDoc = sortByStage(pelis.filter(p => p.project_genre === 'documental'))

      if (pelis.length > 0) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':clapper:  *PELÍCULAS*' } })

        if (pelisFiccion.length > 0) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Ficción' }] })
          for (const p of pelisFiccion) {
            blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
          }
        }
        if (pelisDoc.length > 0) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Documental' }] })
          for (const p of pelisDoc) {
            blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
          }
        }
        blocks.push({ type: 'divider' })
      }

      // ── SIN CLASIFICAR ──
      const sinFormato = sortByStage(programs.filter(p => !p.project_format))
      if (sinFormato.length > 0) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':grey_question:  *SIN CLASIFICAR*' } })
        for (const p of sinFormato) {
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
        }
        blocks.push({ type: 'divider' })
      }

      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: ':film_frames: Generado por SIPROFILM · CAPRO' }],
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
