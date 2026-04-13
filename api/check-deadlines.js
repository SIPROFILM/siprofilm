/**
 * Vercel Serverless Function: Check deadlines and send Slack alerts
 * Can be triggered by Vercel Cron or manually via GET/POST
 * Checks activities with end_date within 3 days and sends alerts to project channels
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN

async function slackApi(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default async function handler(req, res) {
  // Allow GET (for Vercel Cron) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify cron secret if set (optional security)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    // Allow if no secret is set, but block if secret exists and doesn't match
    if (req.method === 'GET' && req.headers['authorization']) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!SLACK_BOT_TOKEN) {
    return res.status(500).json({ error: 'SLACK_BOT_TOKEN not configured' })
  }

  try {
    // Check if Slack notifications are enabled
    const { data: enabledSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'slack_notifications_enabled')
      .single()

    if (enabledSetting?.value !== 'true') {
      return res.status(200).json({ message: 'Slack notifications disabled', alerts: 0 })
    }

    // Get today and 3 days from now
    const today = new Date()
    const threeDaysOut = new Date(today)
    threeDaysOut.setDate(threeDaysOut.getDate() + 3)

    const todayStr = today.toISOString().split('T')[0]
    const threeStr = threeDaysOut.toISOString().split('T')[0]

    // Find activities that are NOT delivered, have end_date within 3 days
    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select(`
        id, name, end_date, status,
        responsible:participants(name),
        program:programs(id, name, slack_channel_id)
      `)
      .neq('status', 'delivered')
      .gte('end_date', todayStr)
      .lte('end_date', threeStr)

    if (actErr) throw actErr

    let alertsSent = 0

    for (const act of (activities || [])) {
      const channelId = act.program?.slack_channel_id
      if (!channelId) continue // Skip if no Slack channel for this project

      const endDate = new Date(act.end_date)
      const diffMs = endDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      const responsible = act.responsible?.name || '—'

      const urgency = daysRemaining <= 1
        ? ':rotating_light:'
        : daysRemaining <= 2
          ? ':warning:'
          : ':calendar:'

      const dateLabel = endDate.toLocaleDateString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: 'America/Mexico_City',
      })

      const dayText = daysRemaining === 0 ? 'HOY'
        : daysRemaining === 1 ? 'MAÑANA'
        : `en ${daysRemaining} días`

      const result = await slackApi('chat.postMessage', {
        channel: channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${urgency} *Deadline ${dayText}*: *${act.name}*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${act.program.name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible}` },
              { type: 'mrkdwn', text: `*Fecha de entrega:*\n${dateLabel}` },
              { type: 'mrkdwn', text: `*Status:*\n${act.status === 'in_progress' ? 'En proceso' : act.status === 'pending' ? 'Pendiente' : act.status}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `:film_frames: SIPROFILM · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` },
            ],
          },
        ],
        text: `Deadline ${dayText}: ${act.name} — ${act.program.name}`,
      })

      if (result.ok) alertsSent++
    }

    // Also check for OVERDUE activities (end_date < today)
    const { data: overdue } = await supabase
      .from('activities')
      .select(`
        id, name, end_date, status,
        responsible:participants(name),
        program:programs(id, name, slack_channel_id)
      `)
      .neq('status', 'delivered')
      .lt('end_date', todayStr)

    for (const act of (overdue || [])) {
      const channelId = act.program?.slack_channel_id
      if (!channelId) continue

      const endDate = new Date(act.end_date)
      const diffMs = today.getTime() - endDate.getTime()
      const daysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      const responsible = act.responsible?.name || '—'

      const dateLabel = endDate.toLocaleDateString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: 'America/Mexico_City',
      })

      const result = await slackApi('chat.postMessage', {
        channel: channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:rotating_light: *VENCIDA* (${daysLate} día${daysLate > 1 ? 's' : ''} de retraso): *${act.name}*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${act.program.name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible}` },
              { type: 'mrkdwn', text: `*Fecha original:*\n${dateLabel}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `:film_frames: SIPROFILM · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` },
            ],
          },
        ],
        text: `VENCIDA (${daysLate}d retraso): ${act.name} — ${act.program.name}`,
      })

      if (result.ok) alertsSent++
    }

    return res.status(200).json({
      success: true,
      alerts: alertsSent,
      upcoming: (activities || []).length,
      overdue: (overdue || []).length,
    })
  } catch (error) {
    console.error('Deadline check error:', error)
    return res.status(500).json({ error: error.message })
  }
}
