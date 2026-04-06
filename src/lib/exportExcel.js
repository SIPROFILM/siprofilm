/**
 * Export Gantt calendar to Excel (.xlsx) with colors and formatting
 * Uses ExcelJS loaded from CDN for full cell styling support
 */

const MONTHS_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

// Color palette for program header rows
const PROG_COLORS = [
  '1A1A1A', '2563EB', '059669', 'DC2626',
  'D97706', '7C3AED', 'DB2777', '0891B2',
]

// Status colors for activity bar cells
const STATUS_BAR = {
  pending:     { fill: 'E5E7EB', font: '374151' },
  in_progress: { fill: '3B82F6', font: 'FFFFFF' },
  delivered:   { fill: '10B981', font: 'FFFFFF' },
  blocked:     { fill: 'EF4444', font: 'FFFFFF' },
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

function fmtShortDate(d) {
  return `${d.getDate()}/${d.getMonth() + 1}`
}

async function loadExcelJS() {
  if (window.ExcelJS) return window.ExcelJS
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
    script.onload = () => resolve(window.ExcelJS)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export async function exportGanttToExcel(programs) {
  const ExcelJS = await loadExcelJS()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SIPROFILM'
  workbook.created = new Date()

  const today = new Date()
  const sheetName = `Calendario ${MONTHS_ES[today.getMonth()]} ${today.getFullYear()}`.substring(0, 31)
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
  })

  // ---- Determine date range ----
  let minDate = null, maxDate = null
  programs.forEach(p => {
    ;(p.activities || []).forEach(a => {
      if (a.start_date) { const s = new Date(a.start_date); if (!minDate || s < minDate) minDate = s }
      if (a.end_date) { const e = new Date(a.end_date); if (!maxDate || e > maxDate) maxDate = e }
    })
    if (p.start_date) { const s = new Date(p.start_date); if (!minDate || s < minDate) minDate = s }
  })
  if (!minDate) minDate = new Date()
  if (!maxDate) maxDate = new Date(minDate.getTime() + 180 * 86400000)

  // Extend range a full weeks with buffer
  const startWeek = Math.max(1, getISOWeek(minDate) - 2)
  const endWeek = Math.min(52, getISOWeek(maxDate) + 2)
  const startYear = minDate.getFullYear()
  const endYear = maxDate.getFullYear()

  const weeks = []
  let yr = startYear, wk = startWeek
  while (yr < endYear || (yr === endYear && wk <= endWeek)) {
    weeks.push({ year: yr, week: wk, monday: getMondayOfWeek(yr, wk) })
    wk++
    if (wk > 52) { wk = 1; yr++ }
    if (weeks.length > 200) break
  }

  const totalCols = weeks.length + 1

  // ---- Header styles ----
  const headerFont = { bold: true, size: 9, color: { argb: '333333' } }
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F4F0' } }
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'DDDDDD' } },
    bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
    left: { style: 'thin', color: { argb: 'EEEEEE' } },
    right: { style: 'thin', color: { argb: 'EEEEEE' } },
  }

  // ---- Column widths ----
  ws.getColumn(1).width = 28
  for (let c = 2; c <= totalCols; c++) {
    ws.getColumn(c).width = 5.5
  }

  // ---- Row 1: Years ----
  const row1 = ws.getRow(1)
  row1.getCell(1).value = ''
  let prevYear = null
  weeks.forEach((w, i) => {
    const cell = row1.getCell(i + 2)
    if (w.year !== prevYear) {
      cell.value = w.year
      prevYear = w.year
    }
    cell.font = { bold: true, size: 10, color: { argb: '1A1A1A' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
  })
  row1.height = 18

  // ---- Row 2: Months ----
  const row2 = ws.getRow(2)
  row2.getCell(1).value = ''
  let prevMonth = null
  weeks.forEach((w, i) => {
    const cell = row2.getCell(i + 2)
    const monthName = MONTHS_ES[w.monday.getMonth()]
    if (monthName !== prevMonth) {
      cell.value = monthName
      prevMonth = monthName
    }
    cell.font = { bold: true, size: 8, color: { argb: '666666' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
  })
  row2.height = 16

  // ---- Row 3: Week numbers ----
  const row3 = ws.getRow(3)
  row3.getCell(1).value = 'SEMANA'
  row3.getCell(1).font = headerFont
  row3.getCell(1).fill = headerFill
  weeks.forEach((w, i) => {
    const cell = row3.getCell(i + 2)
    cell.value = w.week
    cell.font = { size: 8, color: { argb: '999999' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder
  })
  row3.height = 15

  // ---- Row 4: Dates ----
  const row4 = ws.getRow(4)
  row4.getCell(1).value = 'FECHA'
  row4.getCell(1).font = headerFont
  row4.getCell(1).fill = headerFill
  weeks.forEach((w, i) => {
    const cell = row4.getCell(i + 2)
    cell.value = fmtShortDate(w.monday)
    cell.font = { size: 7, color: { argb: 'AAAAAA' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder
  })
  row4.height = 15

  // ---- Data rows ----
  let currentRow = 5

  programs.forEach((prog, progIdx) => {
    const progColor = PROG_COLORS[progIdx % PROG_COLORS.length]
    const activities = prog.activities || []

    // Program header row
    const pRow = ws.getRow(currentRow)
    pRow.getCell(1).value = prog.name.toUpperCase()
    pRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FFFFFF' } }
    pRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: progColor } }
    pRow.getCell(1).alignment = { vertical: 'middle' }
    // Fill rest of row with program color (lighter)
    for (let c = 2; c <= totalCols; c++) {
      pRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: progColor } }
    }
    pRow.height = 22
    currentRow++

    // Activity rows
    activities.forEach(act => {
      const aRow = ws.getRow(currentRow)
      aRow.getCell(1).value = act.name
      aRow.getCell(1).font = { size: 9, color: { argb: '333333' } }
      aRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }
      aRow.getCell(1).border = {
        bottom: { style: 'thin', color: { argb: 'EEEEEE' } },
      }

      const actStart = act.start_date ? new Date(act.start_date) : null
      const actEnd = act.end_date ? new Date(act.end_date) : null
      const colors = STATUS_BAR[act.status] || STATUS_BAR.pending

      weeks.forEach((w, wIdx) => {
        const cell = aRow.getCell(wIdx + 2)
        const weekStart = w.monday
        const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)

        if (actStart && actEnd && actStart <= weekEnd && actEnd >= weekStart) {
          // Activity spans this week — fill with status color
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } }
          cell.font = { size: 7, color: { argb: colors.font } }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          cell.border = thinBorder
        } else {
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'F5F5F5' } },
          }
        }
      })
      aRow.height = 18
      currentRow++
    })

    // Separator row
    ws.getRow(currentRow).height = 8
    currentRow++
  })

  // ---- Status legend at the bottom ----
  currentRow += 1
  const legendRow = ws.getRow(currentRow)
  legendRow.getCell(1).value = 'LEYENDA:'
  legendRow.getCell(1).font = { bold: true, size: 8, color: { argb: '999999' } }

  const statuses = [
    { label: 'Pendiente', color: STATUS_BAR.pending },
    { label: 'En proceso', color: STATUS_BAR.in_progress },
    { label: 'Entregada', color: STATUS_BAR.delivered },
    { label: 'Bloqueada', color: STATUS_BAR.blocked },
  ]
  statuses.forEach((s, i) => {
    const col = 2 + i * 2
    const cell = legendRow.getCell(col)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.color.fill } }
    cell.font = { size: 8, color: { argb: s.color.font } }
    cell.value = s.label
    cell.alignment = { horizontal: 'center' }
  })

  // ---- Generate and download ----
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `SIPROFILM_Calendario_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

  return a.download
}
