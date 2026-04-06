// Supabase Edge Function: Slack notifications for SIPROFILM
// Deploy with: supabase functions deploy slack-notify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, payload } = await req.json()

    // Get Slack webhook URL from settings table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'slack_webhook_url')
      .single()

    if (!settings?.value) {
      return new Response(
        JSON.stringify({ error: 'Slack webhook URL not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookUrl = settings.value
    let slackMessage = null

    // ---- Build message based on type ----
    if (type === 'activity_status_change') {
      const { program_name, activity_name, old_status, new_status, responsible } = payload
      const statusEmoji = {
        pending: ':white_circle:',
        in_progress: ':large_blue_circle:',
        delivered: ':white_check_mark:',
        blocked: ':red_circle:',
      }
      const statusLabel = {
        pending: 'Pendiente',
        in_progress: 'En proceso',
        delivered: 'Entregada',
        blocked: 'Bloqueada',
      }

      slackMessage = {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${statusEmoji[new_status] || ':arrow_right:'} *${activity_name}* cambió de estado`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible || '—'}` },
              { type: 'mrkdwn', text: `*Antes:*\n${statusLabel[old_status] || old_status}` },
              { type: 'mrkdwn', text: `*Ahora:*\n${statusLabel[new_status] || new_status}` },
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

    else if (type === 'blocked_alert') {
      const { program_name, activity_name, responsible, days_blocked } = payload
      slackMessage = {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:rotating_light: *ACTIVIDAD BLOQUEADA*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Proyecto:*\n${program_name}` },
              { type: 'mrkdwn', text: `*Actividad:*\n${activity_name}` },
              { type: 'mrkdwn', text: `*Responsable:*\n${responsible || '—'}` },
              { type: 'mrkdwn', text: `*Días bloqueada:*\n${days_blocked || '—'}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `:film_frames: SIPROFILM` },
            ],
          },
        ],
      }
    }

    else if (type === 'daily_summary') {
      // Fetch current data for summary
      const { data: programs } = await supabase
        .from('programs')
        .select(`
          id, name, stage, status,
          activities(id, name, status, end_date)
        `)
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
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Mexico_City',
      })

      slackMessage = {
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: ':film_frames: Resumen Diario SIPROFILM' },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `_${dateStr}_` },
          },
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
          ...(overdueText
            ? [{
                type: 'section' as const,
                text: { type: 'mrkdwn' as const, text: overdueText },
              }]
            : []),
          { type: 'divider' },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `Generado automáticamente por SIPROFILM · CAPRO` },
            ],
          },
        ],
      }
    }

    else {
      return new Response(
        JSON.stringify({ error: `Unknown notification type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send to Slack
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    })

    if (!slackRes.ok) {
      const errText = await slackRes.text()
      throw new Error(`Slack API error: ${slackRes.status} - ${errText}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
