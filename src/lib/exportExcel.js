/**
 * Export Gantt calendar to Excel (.xlsx) — SIPROFILM branded
 * Uses ExcelJS loaded from CDN for full cell styling support
 *
 * Columns: Actividad | Responsable | Estado | Deadline | [weekly Gantt bars]
 */

const MONTHS_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

// SIPROFILM brand colors
const PINK   = 'F92D97'
const BLUE   = '4B52EB'
const LIME   = 'D0ED40'
const LAVENDER = 'C7BFEF'
const DARK   = '141213'
const CREAM  = 'F0E7E4'

// Program header colors — brand-inspired rotation
const PROG_COLORS = [
  { bg: PINK,     font: 'FFFFFF' },
  { bg: BLUE,     font: 'FFFFFF' },
  { bg: DARK,     font: LIME    },
  { bg: '7C3AED', font: 'FFFFFF' },
  { bg: '0891B2', font: 'FFFFFF' },
  { bg: 'DC2626', font: 'FFFFFF' },
  { bg: 'D97706', font: 'FFFFFF' },
  { bg: '059669', font: 'FFFFFF' },
]

// Status colors for Gantt bar cells AND status column
const STATUS_BAR = {
  pending:     { fill: LAVENDER, font: '4A4358', label: 'Pendiente' },
  in_progress: { fill: BLUE,     font: 'FFFFFF', label: 'En curso' },
  delivered:   { fill: '7CB342', font: 'FFFFFF', label: 'Entregada' },
  blocked:     { fill: PINK,     font: 'FFFFFF', label: 'Bloqueada' },
}

const STAGE_LABEL = {
  incubadora: 'INC', desarrollo: 'DES', preproduccion: 'PRE',
  produccion: 'PRO', postproduccion: 'POST', distribucion: 'DIST',
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

function fmtDeadline(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
}

function getResponsibleName(act) {
  const r = act.responsible
  if (!r) return ''
  if (Array.isArray(r)) return r[0]?.name || ''
  if (typeof r === 'object' && r.name) return r.name
  return ''
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

// Number of fixed columns before the Gantt area
const FIXED_COLS = 4 // Actividad, Responsable, Estado, Deadline
const GANTT_START_COL = FIXED_COLS + 1

export async function exportGanttToExcel(programs) {
  const ExcelJS = await loadExcelJS()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SIPROFILM'
  workbook.created = new Date()

  const today = new Date()
  const sheetName = `Timeline ${MONTHS_ES[today.getMonth()]} ${today.getFullYear()}`.substring(0, 31)
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: FIXED_COLS, ySplit: 5 }],
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

  const totalCols = FIXED_COLS + weeks.length

  // Find "today" column index
  const todayWeek = getISOWeek(today)
  const todayYear = today.getFullYear()
  const todayColIdx = weeks.findIndex(w => w.year === todayYear && w.week === todayWeek)

  // ---- Styles ----
  const headerFont = { bold: true, size: 8, color: { argb: '666666' } }
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F3F7' } }
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'E8E5ED' } },
    bottom: { style: 'thin', color: { argb: 'E8E5ED' } },
    left: { style: 'thin', color: { argb: 'EEEEEE' } },
    right: { style: 'thin', color: { argb: 'EEEEEE' } },
  }
  const dataBorder = {
    bottom: { style: 'thin', color: { argb: 'F0EDF5' } },
  }

  // ---- Column widths ----
  ws.getColumn(1).width = 30  // Actividad
  ws.getColumn(2).width = 16  // Responsable
  ws.getColumn(3).width = 12  // Estado
  ws.getColumn(4).width = 12  // Deadline
  for (let c = GANTT_START_COL; c <= totalCols; c++) {
    ws.getColumn(c).width = 5
  }

  // =============================================================
  // ROW 1: Title bar — SIPROFILM TIMELINE
  // =============================================================
  const titleRow = ws.getRow(1)
  titleRow.height = 28
  for (let c = 1; c <= totalCols; c++) {
    const cell = titleRow.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
  }
  titleRow.getCell(1).value = 'SIPROFILM'
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: PINK } }
  titleRow.getCell(1).alignment = { vertical: 'middle' }
  titleRow.getCell(2).value = 'TIMELINE'
  titleRow.getCell(2).font = { bold: true, size: 14, color: { argb: 'FFFFFF' } }
  titleRow.getCell(2).alignment = { vertical: 'middle' }
  const dateLabel = today.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })
  titleRow.getCell(3).value = dateLabel
  titleRow.getCell(3).font = { size: 9, color: { argb: '999999' } }
  titleRow.getCell(3).alignment = { vertical: 'middle' }

  // =============================================================
  // ROW 2: Years
  // =============================================================
  const row2 = ws.getRow(2)
  row2.height = 18
  for (let c = 1; c <= FIXED_COLS; c++) {
    row2.getCell(c).fill = headerFill
  }
  let prevYear = null
  weeks.forEach((w, i) => {
    const cell = row2.getCell(i + GANTT_START_COL)
    if (w.year !== prevYear) {
      cell.value = w.year
      prevYear = w.year
    }
    cell.font = { bold: true, size: 10, color: { argb: DARK } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
  })

  // =============================================================
  // ROW 3: Months
  // =============================================================
  const row3 = ws.getRow(3)
  row3.height = 16
  for (let c = 1; c <= FIXED_COLS; c++) {
    row3.getCell(c).fill = headerFill
  }
  let prevMonth = null
  weeks.forEach((w, i) => {
    const cell = row3.getCell(i + GANTT_START_COL)
    const monthName = MONTHS_ES[w.monday.getMonth()]
    if (monthName !== prevMonth) {
      cell.value = monthName
      prevMonth = monthName
    }
    cell.font = { bold: true, size: 7, color: { argb: '888888' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
  })

  // =============================================================
  // ROW 4: Week numbers
  // =============================================================
  const row4 = ws.getRow(4)
  row4.height = 14
  row4.getCell(1).value = ''
  row4.getCell(1).fill = headerFill
  for (let c = 2; c <= FIXED_COLS; c++) {
    row4.getCell(c).fill = headerFill
  }
  weeks.forEach((w, i) => {
    const cell = row4.getCell(i + GANTT_START_COL)
    cell.value = `S${w.week}`
    cell.font = { size: 7, color: { argb: 'AAAAAA' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder
  })

  // =============================================================
  // ROW 5: Column headers + dates
  // =============================================================
  const row5 = ws.getRow(5)
  row5.height = 18
  const colHeaders = ['ACTIVIDAD', 'RESPONSABLE', 'ESTADO', 'DEADLINE']
  colHeaders.forEach((h, i) => {
    const cell = row5.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 8, color: { argb: PINK } }
    cell.fill = headerFill
    cell.alignment = { horizontal: i >= 2 ? 'center' : 'left', vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: PINK } } }
  })
  weeks.forEach((w, i) => {
    const cell = row5.getCell(i + GANTT_START_COL)
    cell.value = fmtShortDate(w.monday)
    cell.font = { size: 7, color: { argb: 'AAAAAA' } }
    cell.fill = headerFill
    cell.alignment = { horizontal: 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: PINK } } }
  })

  // =============================================================
  // TODAY marker — highlight the "today" column header
  // =============================================================
  if (todayColIdx >= 0) {
    const todayHeaderCol = todayColIdx + GANTT_START_COL
    // Mark in rows 4 and 5
    ;[row4, row5].forEach(r => {
      const cell = r.getCell(todayHeaderCol)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIME } }
      cell.font = { ...cell.font, bold: true, color: { argb: DARK } }
    })
  }

  // =============================================================
  // DATA ROWS
  // =============================================================
  let currentRow = 6

  programs.forEach((prog, progIdx) => {
    const pc = PROG_COLORS[progIdx % PROG_COLORS.length]
    const activities = prog.activities || []
    const stageTag = STAGE_LABEL[prog.stage] || ''

    // ── Program header row ──
    const pRow = ws.getRow(currentRow)
    pRow.height = 24
    const progLabel = stageTag ? `${prog.name.toUpperCase()}  ·  ${stageTag}` : prog.name.toUpperCase()
    pRow.getCell(1).value = progLabel
    pRow.getCell(1).font = { bold: true, size: 9, color: { argb: pc.font } }
    pRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pc.bg } }
    pRow.getCell(1).alignment = { vertical: 'middle' }
    // Fill all columns with program color
    for (let c = 2; c <= totalCols; c++) {
      pRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pc.bg } }
    }
    // Activity count in col 2
    pRow.getCell(2).value = `${activities.length} act.`
    pRow.getCell(2).font = { size: 8, italic: true, color: { argb: pc.font } }
    pRow.getCell(2).alignment = { vertical: 'middle' }
    currentRow++

    // ── Activity rows ──
    activities.forEach(act => {
      const aRow = ws.getRow(currentRow)
      aRow.height = 20

      // Col 1: Activity name
      const isOverdue = act.status !== 'delivered' && act.end_date && new Date(act.end_date) < today
      aRow.getCell(1).value = act.name
      aRow.getCell(1).font = { size: 9, color: { argb: isOverdue ? PINK : '333333' }, bold: isOverdue }
      aRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }
      aRow.getCell(1).border = dataBorder

      // Col 2: Responsible
      aRow.getCell(2).value = getResponsibleName(act)
      aRow.getCell(2).font = { size: 8, italic: true, color: { argb: '888888' } }
      aRow.getCell(2).alignment = { vertical: 'middle' }
      aRow.getCell(2).border = dataBorder

      // Col 3: Status badge
      const st = STATUS_BAR[act.status] || STATUS_BAR.pending
      aRow.getCell(3).value = st.label
      aRow.getCell(3).font = { size: 8, bold: true, color: { argb: st.font } }
      aRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } }
      aRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      aRow.getCell(3).border = thinBorder

      // Col 4: Deadline
      const dlStr = fmtDeadline(act.deadline)
      const dlOverdue = act.deadline && new Date(act.deadline) < today && act.status !== 'delivered'
      aRow.getCell(4).value = dlStr
      aRow.getCell(4).font = { size: 8, color: { argb: dlOverdue ? PINK : '999999' }, bold: dlOverdue }
      aRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      aRow.getCell(4).border = dataBorder

      // Gantt bar cells
      const actStart = act.start_date ? new Date(act.start_date) : null
      const actEnd = act.end_date ? new Date(act.end_date) : null
      const barColors = STATUS_BAR[act.status] || STATUS_BAR.pending

      weeks.forEach((w, wIdx) => {
        const cell = aRow.getCell(wIdx + GANTT_START_COL)
        const weekStart = w.monday
        const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)

        if (actStart && actEnd && actStart <= weekEnd && actEnd >= weekStart) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barColors.fill } }
          cell.border = thinBorder
        } else {
          // Today column subtle highlight
          if (wIdx === todayColIdx) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAFDF0' } }
          }
          cell.border = { bottom: { style: 'thin', color: { argb: 'F5F3F7' } } }
        }
      })

      currentRow++
    })

    // Separator
    ws.getRow(currentRow).height = 6
    currentRow++
  })

  // =============================================================
  // LEGEND
  // =============================================================
  currentRow += 1
  const legTitleRow = ws.getRow(currentRow)
  legTitleRow.getCell(1).value = 'LEYENDA'
  legTitleRow.getCell(1).font = { bold: true, size: 8, color: { argb: '999999' } }
  currentRow++

  const statuses = [
    { ...STATUS_BAR.pending },
    { ...STATUS_BAR.in_progress },
    { ...STATUS_BAR.delivered },
    { ...STATUS_BAR.blocked },
  ]
  statuses.forEach((s, i) => {
    const row = ws.getRow(currentRow)
    // Color swatch in col 1
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.fill } }
    row.getCell(1).font = { size: 8, bold: true, color: { argb: s.font } }
    row.getCell(1).value = s.label
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.height = 16
    currentRow++
  })

  // Today marker legend
  const todayLegRow = ws.getRow(currentRow)
  todayLegRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIME } }
  todayLegRow.getCell(1).font = { size: 8, bold: true, color: { argb: DARK } }
  todayLegRow.getCell(1).value = 'HOY'
  todayLegRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  todayLegRow.height = 16
  currentRow++

  // Overdue legend
  const overdueLegRow = ws.getRow(currentRow)
  overdueLegRow.getCell(1).font = { size: 8, bold: true, color: { argb: PINK } }
  overdueLegRow.getCell(1).value = '&#9679; Texto rosa = vencida'
  overdueLegRow.height = 16

  // =============================================================
  // GENERATE & DOWNLOAD
  // =============================================================
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `SIPROFILM_Timeline_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

  return a.download
}
