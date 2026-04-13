/**
 * Vercel Serverless Function: Slack Bot Token API integration for SIPROFILM
 * Handles channel creation and message posting via Slack Web API
 * Deployed automatically with `git push` — no Supabase CLI needed.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN

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

/**
 * Slugify a program name for Slack channel naming
 * Format: lowercase, replace spaces/special chars with hyphens, max 80 chars
 */
function slugifyChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 80) // Max 80 chars
}

/**
 * Call Slack Web API endpoint
 */
async function slackApi(endpoint, method = 'post', data = {}) {
  if (!SLACK_BOT_TOKEN) {
    throw new Error('SLACK_BOT_TOKEN environment variable not set')
  }

  const url = `https://slack.com/api/${endpoint}`
  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error(`Slack API error (${endpoint}): ${result.error}`)
  }
  return result
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

    // ---- Create Slack channel for a program ----
    if (type === 'create_channel') {
      const { program_name, program_id } = payload

      if (!program_name || !program_id) {
        return res.status(400).json({ error: 'Missing program_name or program_id' })
      }

      const channelName = `sipro-${slugifyChannelName(program_name)}`

      // Create channel via Slack API
      const channelResult = await slackApi('conversations.create', 'post', {
        name: channelName,
        is_private: true,
        description: `Project channel for: ${program_name}`,
      })

      const channelId = channelResult.channel.id

      // Store channel_id in programs table
      const { error: updateError } = await supabase
        .from('programs')
        .update({ slack_channel_id: channelId })
        .eq('id', program_id)

      if (updateError) {
        console.error('Error updating programs table:', updateError)
      }

      return res.status(200).json({ success: true, channel_id: channelId })
    }

    // ---- Activity status change ----
    else if (type === 'activity_status_change') {
      const { channel_id, program_name, activity_name, old_status, new_status, responsible } = payload

      if (!channel_id) {
        return res.status(400).json({ error: 'Missing channel_id' })
      }

      const blocks = [
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
      ]

      await slackApi('chat.postMessage', 'post', {
        channel: channel_id,
        blocks,
      })

      return res.status(200).json({ success: true })
    }

    // ---- Deadline alert ----
    else if (type === 'deadline_alert') {
      const { channel_id, program_name, activity_name, days_remaining, end_date, responsible } = payload

      if (!channel_id) {
        return res.status(400).json({ error: 'Missing channel_id' })
      }

      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':calendar: *ALERTA DE VENCIMIENTO*',
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
            { type: 'mrkdwn', text: `*Actividad:*\n${activity_name}` },
            { type: 'mrkdwn', text: `*Responsable:*\n${responsible || '—'}` },
            { type: 'mrkdwn', text: `*Días restantes:*\n${days_remaining}` },
          ],
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Vencimiento: ${end_date}` },
          ],
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: ':film_frames: SIPROFILM' },
          ],
        },
      ]

      await slackApi('chat.postMessage', 'post', {
        channel: channel_id,
        blocks,
      })

      return res.status(200).json({ success: true })
    }

    // ---- Program created (welcome message) ----
    else if (type === 'program_created') {
      const { channel_id, program_name, org_name, project_type, stage } = payload

      if (!channel_id) {
        return res.status(400).json({ error: 'Missing channel_id' })
      }

      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':tada: *Bienvenido a tu canal de proyecto*',
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
            { type: 'mrkdwn', text: `*Organización:*\n${org_name}` },
            { type: 'mrkdwn', text: `*Tipo:*\n${project_type}` },
            { type: 'mrkdwn', text: `*Etapa:*\n${stage}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Este canal recibirá actualizaciones automáticas sobre el estado de las actividades y alertas importantes del proyecto.',
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: ':film_frames: SIPROFILM' },
          ],
        },
      ]

      await slackApi('chat.postMessage', 'post', {
        channel: channel_id,
        blocks,
      })

      return res.status(200).json({ success: true })
    }

    // ---- Daily summary (updated to use Bot Token) ----
    else if (type === 'daily_summary') {
      const { data: programs } = await supabase
        .from('programs')
        .select('id, name, stage, status, status_note, project_format, project_genre, actual_cost, estimated_cost, activities(id, name, status, end_date, responsible:participants(name))')
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
        if (prog.status_note && prog.status_note.trim()) {
          return prog.status_note.trim().toUpperCase()
        }

        const acts = prog.activities || []
        const blocked = acts.filter(a => a.status === 'blocked')
        const inProgress = acts.filter(a => a.status === 'in_progress')
        const overdue = acts.filter(a =>
          a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
        )
        const delivered = acts.filter(a => a.status === 'delivered').length
        const total = acts.length

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
        return null
      }

      // Un proyecto está "activo" si tiene actividades en curso, vencidas, bloqueadas,
      // próximas esta semana, o si tiene status_note manual escrito
      function isActive(prog) {
        if (prog.status_note && prog.status_note.trim()) return true
        const acts = prog.activities || []
        if (acts.some(a => a.status === 'in_progress' || a.status === 'blocked')) return true
        if (acts.some(a => a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today)) return true
        if (acts.some(a => {
          if (a.status === 'delivered' || !a.end_date) return false
          const d = new Date(a.end_date)
          return d >= today && d <= in7days
        })) return true
        return false
      }

      // ── Render one project block (TODO LIST style) ──
      function renderProjectBlock(prog) {
        const acts = prog.activities || []
        const stageLabel = STAGE_LABEL[prog.stage] || prog.stage
        const stageEmoji = STAGE_EMOJI[prog.stage] || ':film_frames:'
        const headline = getHeadline(prog)

        let text = `*${prog.name}*   ${stageEmoji} _${stageLabel}_\n`
        if (headline) text += `*${headline}*\n`

        const pending = acts.filter(a => a.status === 'in_progress' || a.status === 'pending')
        const overdue = acts.filter(a =>
          a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
        )
        const upcoming = acts.filter(a => {
          if (a.status === 'delivered' || !a.end_date) return false
          const d = new Date(a.end_date)
          return d >= today && d <= in7days
        })

        const shown = new Set()

        for (const a of overdue.slice(0, 3)) {
          const responsible = a.responsible?.[0]?.name || ''
          const dateLabel = new Date(a.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
          text += `  :warning: ${a.name}${responsible ? ` — _${responsible}_` : ''} _(venció ${dateLabel})_\n`
          shown.add(a.id)
        }

        const inProg = acts.filter(a => a.status === 'in_progress' && !shown.has(a.id))
        for (const a of inProg.slice(0, 4)) {
          const responsible = a.responsible?.[0]?.name || ''
          text += `  :large_blue_circle: ${a.name}${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

        const upNext = upcoming.filter(a => !shown.has(a.id))
        for (const a of upNext.slice(0, 3)) {
          const responsible = a.responsible?.[0]?.name || ''
          const dayLabel = new Date(a.end_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'America/Mexico_City' })
          text += `  :calendar: ${a.name} _(${dayLabel})_${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

        const blocked = acts.filter(a => a.status === 'blocked' && !shown.has(a.id))
        for (const a of blocked) {
          const responsible = a.responsible?.[0]?.name || ''
          text += `  :red_circle: ${a.name}${responsible ? ` — _${responsible}_` : ''}\n`
          shown.add(a.id)
        }

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

        if (acts.length > 0) {
          const delivered = acts.filter(a => a.status === 'delivered').length
          const pct = Math.round((delivered / acts.length) * 100)
          text += `  _Avance: ${pct}% (${delivered}/${acts.length})_\n`
        }

        return text
      }

      function sortByStage(list) {
        return [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
      }

      const activeProjects = programs.filter(isActive)
      const passiveProjects = programs.filter(p => !isActive(p))

      const totalActs = activeProjects.flatMap(p => p.activities || []).length
      const totalDelivered = activeProjects.flatMap(p => p.activities || []).filter(a => a.status === 'delivered').length
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${activeProjects.length} activos* · ${passiveProjects.length} en pausa · ${totalDelivered}/${totalActs} actividades entregadas` },
      })
      blocks.push({ type: 'divider' })

      // ── SERIES (solo activos) ──
      const series = activeProjects.filter(p => p.project_format === 'serie')
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

      // ── PELÍCULAS (solo activos) ──
      const pelis = activeProjects.filter(p => p.project_format === 'pelicula')
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

      // ── SIN CLASIFICAR (activos sin formato asignado) ──
      const sinFormato = sortByStage(activeProjects.filter(p => !p.project_format))
      if (sinFormato.length > 0) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':grey_question:  *SIN CLASIFICAR*' } })
        for (const p of sinFormato) {
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: renderProjectBlock(p) } })
        }
        blocks.push({ type: 'divider' })
      }

      // ── EN PAUSA / INCUBADORA — lista compacta ──
      if (passiveProjects.length > 0) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `:hourglass_flowing_sand:  *EN PAUSA / SIN ACTIVIDAD* (${passiveProjects.length})` },
        })

        const byStage = {}
        for (const p of sortByStage(passiveProjects)) {
          const s = STAGE_LABEL[p.stage] || p.stage
          if (!byStage[s]) byStage[s] = []
          byStage[s].push(p)
        }

        let text = ''
        for (const [stage, projs] of Object.entries(byStage)) {
          text += `_${stage}:_  `
          text += projs.map(p => p.name).join(' · ')
          text += '\n'
        }
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text } })
        blocks.push({ type: 'divider' })
      }

      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: ':film_frames: Generado por SIPROFILM · CAPRO  ·  _Edita el "Status actual" de cada proyecto para que aparezca como headline_' }],
      })

      slackMessage = { blocks }

      // Get admin channel from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'slack_admin_channel_id')
        .single()

      const adminChannelId = settings?.value
      if (!adminChannelId) {
        return res.status(400).json({ error: 'Slack admin channel ID not configured' })
      }

      // Send to admin channel
      await slackApi('chat.postMessage', 'post', {
        channel: adminChannelId,
        blocks: slackMessage.blocks,
      })

      return res.status(200).json({ success: true })
    }

    else {
      return res.status(400).json({ error: `Unknown type: ${type}` })
    }
  } catch (error) {
    console.error('Slack notify error:', error)
    return res.status(500).json({ error: error.message })
  }
}
