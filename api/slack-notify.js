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
        .select('id, name, stage, status, activities(id, name, status, end_date)')
        .neq('stage', 'incubadora')

      if (!programs) throw new Error('Could not fetch programs')

      const allActs = programs.flatMap(p => p.activities || [])
      const total = allActs.length
      const delivered = allActs.filter(a => a.status === 'delivered').length
      const inProgress = allActs.filter(a => a.status === 'in_progress').length
      const blocked = allActs.filter(a => a.status === 'blocked').length
      const pending = allActs.filter(a => a.status === 'pending').length

      const today = new Date()
      const overdue = allActs.filter(a => {
        if (!a.end_date || a.status === 'delivered') return false
        return new Date(a.end_date) < today
      })

      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0

      let overdueText = ''
      if (overdue.length > 0) {
        overdueText = '\n\n:warning: *Actividades vencidas:*\n'
        overdue.slice(0, 10).forEach(a => {
          const prog = programs.find(p => (p.activities || []).some(act => act.id === a.id))
          overdueText += `• ${prog?.name} → ${a.name}\n`
        })
        if (overdue.length > 10) overdueText += `_...y ${overdue.length - 10} más_\n`
      }

      const dateStr = today.toLocaleDateString('es-MX', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Mexico_City',
      })

      slackMessage = {
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: ':film_frames: Resumen Diario SIPROFILM' } },
          { type: 'section', text: { type: 'mrkdwn', text: `_${dateStr}_` } },
          { type: 'divider' },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyectos activos:*\n${programs.length}` },
              { type: 'mrkdwn', text: `*Avance total:*\n${pct}%` },
              { type: 'mrkdwn', text: `:white_check_mark: Entregadas: ${delivered}` },
              { type: 'mrkdwn', text: `:large_blue_circle: En proceso: ${inProgress}` },
              { type: 'mrkdwn', text: `:red_circle: Bloqueadas: ${blocked}` },
              { type: 'mrkdwn', text: `:white_circle: Pendientes: ${pending}` },
            ],
          },
          ...(overdueText ? [{ type: 'section', text: { type: 'mrkdwn', text: overdueText } }] : []),
          { type: 'divider' },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Generado automáticamente por SIPROFILM · CAPRO' }] },
        ],
      }
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
