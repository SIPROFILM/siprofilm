/**
 * Slack integration utilities for SIPROFILM
 * Uses Slack Bot Token API via Vercel serverless function (to avoid CORS)
 */
import { supabase } from './supabase'

/**
 * Check if Slack notifications are enabled
 */
export async function isSlackEnabled() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'slack_notifications_enabled')
      .single()
    return data?.value === 'true'
  } catch (err) {
    console.error('Error checking Slack enabled:', err)
    return false
  }
}

/**
 * Send a Slack notification via Vercel API route
 * @param {string} type - The notification type
 * @param {object} payload - The notification payload
 * @returns {object} - { success, data?, error? }
 */
async function sendSlackNotification(type, payload = {}) {
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
 * Create a Slack channel for a project
 * @param {string} programName - The project name
 * @param {string} programId - The program ID from the database
 * @returns {object} - { success, data?: { channelId }, error? }
 */
export async function createProjectChannel(programName, programId) {
  try {
    const enabled = await isSlackEnabled()
    if (!enabled) return { success: false, reason: 'disabled' }

    const res = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'create_channel',
        payload: { program_name: programName, program_id: programId },
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create channel')
    return { success: true, data: { channelId: data.channel_id } }
  } catch (err) {
    console.error('Error creating Slack channel:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Send welcome message when a program is created
 * @param {object} params - { channelId, programName, orgName, projectType, stage }
 * @returns {object} - { success, error? }
 */
export async function notifyProgramCreated({ channelId, programName, orgName, projectType, stage }) {
  try {
    if (!channelId) {
      console.warn('notifyProgramCreated: missing channelId')
      return { success: false, error: 'missing channelId' }
    }

    return await sendSlackNotification('program_created', {
      channel_id: channelId,
      program_name: programName,
      org_name: orgName,
      project_type: projectType,
      stage,
    })
  } catch (err) {
    console.error('Error notifying program created:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Notify about activity status change
 * @param {object} params - { channelId, programName, activityName, oldStatus, newStatus, responsible }
 * @returns {object} - { success, error? }
 */
export async function notifyStatusChange({ channelId, programName, activityName, oldStatus, newStatus, responsible }) {
  try {
    if (!channelId) {
      console.warn('notifyStatusChange: missing channelId')
      return { success: false, error: 'missing channelId' }
    }

    return await sendSlackNotification('activity_status_change', {
      channel_id: channelId,
      program_name: programName,
      activity_name: activityName,
      old_status: oldStatus,
      new_status: newStatus,
      responsible,
    })
  } catch (err) {
    console.error('Error notifying status change:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Notify about deadline warning
 * @param {object} params - { channelId, programName, activityName, daysRemaining, endDate, responsible }
 * @returns {object} - { success, error? }
 */
export async function notifyDeadlineAlert({ channelId, programName, activityName, daysRemaining, endDate, responsible }) {
  try {
    if (!channelId) {
      console.warn('notifyDeadlineAlert: missing channelId')
      return { success: false, error: 'missing channelId' }
    }

    return await sendSlackNotification('deadline_alert', {
      channel_id: channelId,
      program_name: programName,
      activity_name: activityName,
      days_remaining: daysRemaining,
      end_date: endDate,
      responsible,
    })
  } catch (err) {
    console.error('Error notifying deadline alert:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Notify about blocked activity
 * Convenience wrapper that calls notifyStatusChange with blocked status
 * @param {object} params - { channelId, programName, activityName, responsible }
 * @returns {object} - { success, error? }
 */
export async function notifyBlocked({ channelId, programName, activityName, responsible }) {
  try {
    if (!channelId) {
      console.warn('notifyBlocked: missing channelId')
      return { success: false, error: 'missing channelId' }
    }

    return await notifyStatusChange({
      channelId,
      programName,
      activityName,
      oldStatus: 'in_progress',
      newStatus: 'blocked',
      responsible,
    })
  } catch (err) {
    console.error('Error notifying blocked:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Send daily summary to admin channel
 * @returns {object} - { success, error? }
 */
export async function sendDailySummary() {
  try {
    return await sendSlackNotification('daily_summary')
  } catch (err) {
    console.error('Error sending daily summary:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get Slack settings from database
 * @returns {object} - Settings object with keys as property names
 */
export async function getSlackSettings() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'slack_notifications_enabled',
        'slack_daily_summary_enabled',
        'slack_daily_summary_time',
        'slack_admin_channel_id',
      ])

    const settings = {}
    ;(data || []).forEach(row => {
      settings[row.key] = row.value
    })
    return settings
  } catch (err) {
    console.error('Error getting Slack settings:', err)
    return {}
  }
}

/**
 * Update a Slack setting in the database
 * @param {string} key - Setting key
 * @param {string} value - Setting value
 */
export async function updateSlackSetting(key, value) {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) throw error
  } catch (err) {
    console.error('Error updating Slack setting:', err)
    throw err
  }
}
