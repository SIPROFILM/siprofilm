/**
 * Slack integration utilities for SIPROFILM
 * Sends notifications via Vercel API route (to avoid CORS)
 */
import { supabase } from './supabase'

/**
 * Check if Slack notifications are enabled
 */
export async function isSlackEnabled() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'slack_notifications_enabled')
    .single()
  return data?.value === 'true'
}

/**
 * Send a Slack notification via Vercel API route
 */
export async function sendSlackNotification(type, payload = {}) {
  try {
    const enabled = await isSlackEnabled()
    if (!enabled) return { success: false, reason: 'disabled' }

    const res = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Slack API error')
    return { success: true, data }
  } catch (err) {
    console.error('Slack notification error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Notify about activity status change
 */
export async function notifyStatusChange({ programName, activityName, oldStatus, newStatus, responsible }) {
  return sendSlackNotification('activity_status_change', {
    program_name: programName,
    activity_name: activityName,
    old_status: oldStatus,
    new_status: newStatus,
    responsible,
  })
}

/**
 * Notify about blocked activity
 */
export async function notifyBlocked({ programName, activityName, responsible }) {
  return sendSlackNotification('blocked_alert', {
    program_name: programName,
    activity_name: activityName,
    responsible,
  })
}

/**
 * Send daily summary to Slack
 */
export async function sendDailySummary() {
  return sendSlackNotification('daily_summary')
}

/**
 * Get Slack settings
 */
export async function getSlackSettings() {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'slack_webhook_url',
      'slack_notifications_enabled',
      'slack_daily_summary_enabled',
      'slack_daily_summary_time',
    ])

  const settings = {}
  ;(data || []).forEach(row => {
    settings[row.key] = row.value
  })
  return settings
}

/**
 * Update a Slack setting
 */
export async function updateSlackSetting(key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}
