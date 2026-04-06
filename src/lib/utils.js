import { addDays, isWeekend, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Calcula la fecha de fin de una actividad dado su inicio y duración,
 * saltando fines de semana.
 */
export function calcEndDate(startDate, durationDays) {
  let date = typeof startDate === 'string' ? parseISO(startDate) : startDate
  let remaining = durationDays
  while (remaining > 0) {
    date = addDays(date, 1)
    if (!isWeekend(date)) remaining--
  }
  return date
}

/**
 * Calcula el primer día hábil después de una fecha dada.
 */
export function nextWorkday(date) {
  let next = addDays(typeof date === 'string' ? parseISO(date) : date, 1)
  while (isWeekend(next)) next = addDays(next, 1)
  return next
}

/**
 * Formatea una fecha como "12 abr 2026"
 */
export function fmtDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "d MMM yyyy", { locale: es })
}

/**
 * Formatea moneda en pesos mexicanos
 */
export function fmtMXN(amount) {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Clases de estado de actividad
 */
export const STATUS_LABELS = {
  pending:     { label: 'Pendiente',   color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'En proceso',  color: 'bg-blue-100 text-blue-700' },
  delivered:   { label: 'Entregado',   color: 'bg-green-100 text-green-700' },
  blocked:     { label: 'Bloqueado',   color: 'bg-red-100 text-red-700' },
}

export const PROGRAM_STATUS_LABELS = {
  active:    { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  paused:    { label: 'En pausa',    color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completado',  color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelado',   color: 'bg-red-100 text-red-600' },
}
