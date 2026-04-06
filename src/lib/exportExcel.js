/**
 * Export Gantt calendar to Excel (.xlsx) — matching CAPRO weekly calendar format
 * Uses SheetJS (xlsx) library loaded from CDN
 */

const MONTHS_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

// Color palette for programs (rotating)
const PROG_COLORS = [
  'FF1A1A1A', 'FF2563EB', 'FF059669', 'FFDC2626',
  'FFD97706', 'FF7C3AED', 'FFDB2777', 'FF0891B2',
]

// Status colors for activity bars
const STATUS_BAR_COLORS = {
  pending:     'FFD1D5DB',
  in_progress: 'FF3B82F6',
  delivered:   'FF10B981',
  blocked:     'FFEF4444',
}

function getISOWeek(d) {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function getMondayOfWeek(year, week) {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1)
  const result = new Date(firstMonday)
  result.setDate(firstMonday.getDate() + (week - 1) * 7)
  return result
}

export async function exportGanttToExcel(programs) {
  // Load SheetJS from CDN
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  const XLSX = window.XLSX

  // Determine date range from all activities
  let minDate = null, maxDate = null
  programs.forEach(p => {
    (p.activities || []).forEach(a => {
      if (a.start_date) {
        const s = new Date(a.start_date)
        if (!minDate || s < minDate) minDate = s
      }
      if (a.end_date) {
        const e = new Date(a.end_date)
        if (!maxDate || e > maxDate) maxDate = e
      }
    })
    if (p.start_date) {
      const s = new Date(p.start_date)
      if (!minDate || s < minDate) minDate = s
    }
  })

  if (!minDate) minDate = new Date()
  if (!maxDate) maxDate = new Date(minDate.getTime() + 180 * 86400000)

  // Extend range to cover full weeks, plus a buffer
  const startYear = minDate.getFullYear()
  const startWeek = Math.max(1, getISOWeek(minDate) - 2)
  const endYear = maxDate.getFullYear()
  const endWeek = Math.min(52, getISOWeek(maxDate) + 2)

  // Generate week columns
  const weeks = []
  let yr = startYear
  let wk = startWeek
  while (yr < endYear || (yr === endYear && wk <= endWeek)) {
    const monday = getMondayOfWeek(yr, wk)
    weeks.push({ year: yr, week: wk, monday })
    wk++
    if (wk > 52) { wk = 1; yr++ }
    if (weeks.length > 200) break // safety
  }

  // Build worksheet data
  const ws = XLSX.utils.aoa_to_sheet([])

  // Row 1: Years
  const row1 = ['']
  let prevYear = null
  weeks.forEach(w => {
    if (w.year !== prevYear) {
      row1.push(w.year)
      prevYear = w.year
    } else {
      row1.push('')
    }
  })

  // Row 2: Months
  const row2 = ['']
  let prevMonth = null
  weeks.forEach(w => {
    const monthIdx = w.monday.getMonth()
    const monthName = MONTHS_ES[monthIdx]
    if (monthName !== prevMonth) {
      row2.push(monthName)
      prevMonth = monthName
    } else {
      row2.push('')
    }
  })

  // Row 3: Week numbers
  const row3 = ['SEMANA']
  weeks.forEach(w => row3.push(w.week))

  // Row 4: Start dates
  const row4 = ['FECHA INICIAL']
  weeks.forEach(w => {
    const d = w.monday
    row4.push(d)
  })

  XLSX.utils.sheet_add_aoa(ws, [row1, row2, row3, row4], { origin: 'A1' })

  // Data rows — programs and activities
  let currentRow = 5 // 0-indexed: row 5 in Excel
  const rows = []
  const rowStyles = [] // { row, col, type, color }

  programs.forEach((prog, progIdx) => {
    const color = PROG_COLORS[progIdx % PROG_COLORS.length]

    // Program header row
    const progRow = [prog.name]
    weeks.forEach(() => progRow.push(''))
    rows.push(progRow)
    rowStyles.push({ row: currentRow, col: 0, type: 'program', color })
    currentRow++

    // Activities
    const activities = prog.activities || []
    activities.forEach(act => {
      const actRow = [act.name]
      const actStart = act.start_date ? new Date(act.start_date) : null
      const actEnd = act.end_date ? new Date(act.end_date) : null
      const barColor = STATUS_BAR_COLORS[act.status] || STATUS_BAR_COLORS.pending

      weeks.forEach((w, wIdx) => {
        const weekStart = w.monday
        const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)

        if (actStart && actEnd && actStart <= weekEnd && actEnd >= weekStart) {
          // Activity spans this week
          actRow.push(act.name.substring(0, 8))
          rowStyles.push({ row: currentRow, col: wIdx + 1, type: 'bar', color: barColor })
        } else {
          actRow.push('')
        }
      })
      rows.push(actRow)
      currentRow++
    })

    // Empty separator row
    rows.push([''])
    currentRow++
  })

  XLSX.utils.sheet_add_aoa(ws, rows, { origin: `A5` })

  // Column widths
  const colWidths = [{ wch: 22 }]
  weeks.forEach(() => colWidths.push({ wch: 4.5 }))
  ws['!cols'] = colWidths

  // Create workbook
  const wb = XLSX.utils.book_new()
  const today = new Date()
  const sheetName = `Calendario ${MONTHS_ES[today.getMonth()]} ${today.getFullYear()}`
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31))

  // Generate and download
  const filename = `SIPROFILM_Calendario_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.xlsx`
  XLSX.writeFile(wb, filename)

  return filename
}
