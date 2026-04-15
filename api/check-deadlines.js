/**
 * Vercel Serverless Function: Check deadlines and send Slack alerts.
 * Priority: explicit `deadline` field. Fallback: `end_date`.
 * Runs via Vercel Cron (see vercel.json).
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

function daysBetween(a, b) {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    if (req.method === 'GET' && req.headers['authorization']) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!SLACK_BOT_TOKEN) {
    return res.status(500).json({ error: 'SLACK_BOT_TOKEN not configured' })
  }

  try {
    const { data: enabledSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'slack_notifications_enabled')
      .single()

    if (enabledSetting?.value !== 'true') {
      return res.status(200).json({ message: 'Slack notifications disabled', alerts: 0 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Traer todas las actividades no entregadas (cantidad baja, filtramos en código)
    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select(`
        id, name, end_date, deadline, status,
        responsible:participants(name),
        program:programs(id, name, slack_channel_id)
      `)
      .neq('status', 'delivered')

    if (actErr) throw actErr

    let alertsSent = 0
    let overdueCount = 0
    let upcomingCount = 0

    for (const act of (activities || [])) {
      const channelId = act.program?.slack_channel_id
      if (!channelId) continue

      // Preferir deadline. Si no hay, usar end_date.
      const critDateStr = act.deadline || act.end_date
      if (!critDateStr) continue

      const critDate = new Date(critDateStr + 'T00:00:00')
      const diffDays = daysBetween(critDate, today)
      const isDeadline = !!act.deadline // es deadline explícito?
      const responsible = act.responsible?.name || '—'

      const dateLabel = critDate.toLocaleDateString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: 'America/Mexico_City',
      })

      // Vencida
      if (diffDays < 0) {
        const daysLate = -diffDays
        const label = isDeadline ? 'DEADLINE VENCIDO' : 'VENCIDA'

        const result = await slackApi('chat.postMessage', {
          channel: channelId,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:rotating_light: *${label}* (${daysLate} día${daysLate > 1 ? 's' : ''} de retraso): *${act.name}*`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Proyecto:*\n${act.program.name}` },
                { type: 'mrkdwn', text: `*Responsable:*\n${responsible}` },
                { type: 'mrkdwn', text: `*${isDeadline ? 'Deadline' : 'Fecha original'}:*\n${dateLabel}` },
              ],
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `:film_frames: SIPROFILM · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` },
              ],
            },
          ],
          text: `${label} (${daysLate}d): ${act.name} — ${act.program.name}`,
        })
        if (result.ok) alertsSent++
        overdueCount++
        continue
      }

      // Próxima (dentro de 3 días)
      if (diffDays <= 3) {
        const urgency = diffDays <= 1 ? ':rotating_light:' : diffDays <= 2 ? ':warning:' : ':calendar:'
        const dayText = diffDays === 0 ? 'HOY' : diffDays === 1 ? 'MAÑANA' : `en ${diffDays} días`
        const label = isDeadline ? 'Deadline' : 'Fecha fin'

        const result = await slackApi('chat.postMessage', {
          channel: channelId,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${urgency} *${label} ${dayText}*: *${act.name}*`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Proyecto:*\n${act.program.name}` },
                { type: 'mrkdwn', text: `*Responsable:*\n${responsible}` },
                { type: 'mrkdwn', text: `*${label}:*\n${dateLabel}` },
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
          text: `${label} ${dayText}: ${act.name} — ${act.program.name}`,
        })
        if (result.ok) alertsSent++
        upcomingCount++
      }
    }

    return res.status(200).json({
      success: true,
      alerts: alertsSent,
      upcoming: upcomingCount,
      overdue: overdueCount,
    })
  } catch (error) {
    console.error('Deadline check error:', error)
    return res.status(500).json({ error: error.message })
  }
}
