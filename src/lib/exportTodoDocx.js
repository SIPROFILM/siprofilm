/**
 * Export TODO List as .docx — runs CLIENT-SIDE with user's auth session
 * so Supabase RLS works and participant joins resolve correctly.
 */
import { supabase } from './supabase'

// Brand colors
const PINK   = 'F92D97'
const BLUE   = '4B52EB'
const DARK   = '141213'
const GRAY1  = '333333'
const GRAY2  = '666666'
const GRAY3  = '999999'
const GRAY4  = 'CCCCCC'
const LIGHT  = 'F5F3F7'

const STAGE_LABEL = {
  incubadora: 'Incubadora', desarrollo: 'Desarrollo', preproduccion: 'Preproducción',
  produccion: 'Producción', postproduccion: 'Postproducción', distribucion: 'Distribución',
}
const STAGE_ORDER = ['produccion','postproduccion','preproduccion','desarrollo','incubadora','distribucion']

const STATUS_LABEL = { pending: 'Pendiente', in_progress: 'En curso', delivered: 'Entregada', blocked: 'Bloqueada' }
const STATUS_COLOR = { pending: 'C7BFEF', in_progress: '4B52EB', delivered: '7CB342', blocked: 'F92D97' }
const STATUS_TEXT  = { pending: '4A4358', in_progress: 'FFFFFF', delivered: 'FFFFFF', blocked: 'FFFFFF' }

function sortByStage(list) {
  return [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
}

async function loadDocxLib() {
  if (window.docx) return window.docx
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js'
    script.onload = () => resolve(window.docx)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export async function exportTodoDocx(orgId, orgName = 'CAPRO') {
  const docx = await loadDocxLib()
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    Header, Footer, PageNumber, TabStopType, TabStopPosition,
  } = docx

  // ── Fetch data using the user's authenticated session ──
  let progQuery = supabase
    .from('programs')
    .select('id, name, stage, status')
    .order('name')

  if (orgId) progQuery = progQuery.eq('org_id', orgId)
  const { data: programs } = await progQuery
  if (!programs) throw new Error('No se pudieron cargar los proyectos')

  // Fetch activities WITH responsible join — client-side with user auth
  for (const prog of programs) {
    const { data: acts, error: actErr } = await supabase
      .from('activities')
      .select('*, responsible:participants(id, name)')
      .eq('program_id', prog.id)
      .order('start_date', { ascending: true, nullsFirst: false })

    // DEBUG — check in browser console (F12) what data looks like
    if (acts && acts.length > 0) {
      console.log(`[TODO DEBUG] Program: ${prog.name}`)
      console.log(`[TODO DEBUG] First activity keys:`, Object.keys(acts[0]))
      console.log(`[TODO DEBUG] First activity responsible:`, acts[0].responsible)
      console.log(`[TODO DEBUG] First activity responsible_id:`, acts[0].responsible_id)
      console.log(`[TODO DEBUG] First activity full:`, JSON.stringify(acts[0], null, 2))
    }
    if (actErr) console.error(`[TODO DEBUG] Error:`, actErr)

    prog.activities = (acts || [])
      .filter(a => a.status !== 'delivered')
      .map(a => {
        let respName = '—'
        if (a.responsible) {
          if (Array.isArray(a.responsible)) respName = a.responsible[0]?.name || '—'
          else if (typeof a.responsible === 'object') respName = a.responsible.name || '—'
        }
        return { ...a, responsible_name: respName }
      })
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Mexico_City',
  })

  const sorted = sortByStage(programs.filter(p => (p.activities || []).length > 0))

  // ── Helpers ──
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'E8E5ED' }
  const borders = { top: border, bottom: border, left: border, right: border }

  function mkCell(text, opts = {}) {
    const { bold = false, color = GRAY1, size = 18, shading: fill, width, align = AlignmentType.LEFT, italic = false, caps = false } = opts
    return new TableCell({
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      borders,
      shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, color, size, font: 'Arial', italics: italic, allCaps: caps })],
      })],
    })
  }

  function statusCell(status, width) {
    const label = STATUS_LABEL[status] || status
    const fill = STATUS_COLOR[status] || 'E5E7EB'
    const textColor = STATUS_TEXT[status] || GRAY1
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders,
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label, bold: true, color: textColor, size: 15, font: 'Arial' })],
      })],
    })
  }

  // ── Build document ──
  const children = []

  // Title
  children.push(new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({ text: 'TODO LIST', bold: true, size: 40, font: 'Arial', color: DARK })],
  }))
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: orgName.toUpperCase(), bold: true, size: 24, font: 'Arial', color: PINK }),
      new TextRun({ text: '  —  ', size: 24, font: 'Arial', color: GRAY4 }),
      new TextRun({ text: 'SIPROFILM', size: 20, font: 'Arial', color: GRAY3, bold: true }),
    ],
  }))
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: dateStr, size: 18, font: 'Arial', color: GRAY3 })],
  }))

  // Pink divider
  children.push(new Paragraph({
    spacing: { after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PINK, space: 1 } },
    children: [],
  }))

  // Summary
  const allActs = programs.flatMap(p => p.activities || [])
  const stats = {
    total: allActs.length,
    inProgress: allActs.filter(a => a.status === 'in_progress').length,
    blocked: allActs.filter(a => a.status === 'blocked').length,
    pending: allActs.filter(a => a.status === 'pending').length,
    overdue: allActs.filter(a => a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today).length,
  }

  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: 'RESUMEN', bold: true, size: 16, font: 'Arial', color: GRAY3 })],
  }))

  const parts = [`${programs.length} programas`, `${stats.total} actividades pendientes`, `${stats.inProgress} en curso`, `${stats.pending} pendientes`]
  if (stats.blocked > 0) parts.push(`${stats.blocked} bloqueadas`)
  if (stats.overdue > 0) parts.push(`${stats.overdue} vencidas`)

  children.push(new Paragraph({
    spacing: { after: 320 },
    children: [new TextRun({ text: parts.join('  ·  '), size: 18, font: 'Arial', color: GRAY2 })],
  }))

  // ── Per-program tables ──
  const COL_W = [3200, 1500, 1100, 1100, 1100, 1080]
  const TABLE_W = COL_W.reduce((s, w) => s + w, 0)

  sorted.forEach((prog, i) => {
    const acts = prog.activities || []
    const stageLabel = STAGE_LABEL[prog.stage] || prog.stage

    // Program header
    children.push(new Paragraph({
      spacing: { before: i > 0 ? 400 : 120, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: PINK, space: 4 } },
      children: [new TextRun({ text: prog.name.toUpperCase(), bold: true, size: 24, font: 'Arial', color: DARK })],
    }))
    children.push(new Paragraph({
      spacing: { after: 160 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: stageLabel.toUpperCase(), bold: true, size: 16, font: 'Arial', color: BLUE }),
        new TextRun({ text: `  ·  ${acts.length} actividades`, size: 16, font: 'Arial', color: GRAY3 }),
      ],
    }))

    // Table
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        mkCell('ACTIVIDAD',   { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[0], caps: true }),
        mkCell('RESPONSABLE', { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[1], caps: true }),
        mkCell('INICIO',      { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[2], align: AlignmentType.CENTER, caps: true }),
        mkCell('FIN',         { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[3], align: AlignmentType.CENTER, caps: true }),
        mkCell('DEADLINE',    { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[4], align: AlignmentType.CENTER, caps: true }),
        mkCell('ESTADO',      { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[5], align: AlignmentType.CENTER, caps: true }),
      ],
    })

    const rows = acts.map(act => {
      const isOverdue = act.status !== 'delivered' && act.end_date && new Date(act.end_date) < today
      const deadlineColor = act.deadline && new Date(act.deadline) < today && act.status !== 'delivered' ? PINK : GRAY1

      return new TableRow({
        children: [
          mkCell(act.name, { size: 17, color: isOverdue ? PINK : DARK, bold: isOverdue, width: COL_W[0] }),
          mkCell(act.responsible_name, { size: 16, color: GRAY2, italic: true, width: COL_W[1] }),
          mkCell(fmtDateShort(act.start_date), { size: 16, color: GRAY2, width: COL_W[2], align: AlignmentType.CENTER }),
          mkCell(fmtDateShort(act.end_date), { size: 16, color: isOverdue ? PINK : GRAY2, bold: isOverdue, width: COL_W[3], align: AlignmentType.CENTER }),
          mkCell(act.deadline ? fmtDateShort(act.deadline) : '—', { size: 16, color: deadlineColor, bold: deadlineColor === PINK, width: COL_W[4], align: AlignmentType.CENTER }),
          statusCell(act.status, COL_W[5]),
        ],
      })
    })

    children.push(new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: COL_W,
      rows: [headerRow, ...rows],
    }))
  })

  // Programs without activities
  const empty = programs.filter(p => (p.activities || []).length === 0)
  if (empty.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 480, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: GRAY4, space: 4 } },
      children: [new TextRun({ text: `SIN ACTIVIDADES PENDIENTES (${empty.length})`, bold: true, size: 20, font: 'Arial', color: GRAY3 })],
    }))
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: sortByStage(empty).map(p => p.name).join('  ·  '), size: 18, font: 'Arial', color: GRAY3 })],
    }))
  }

  // ── Build & download ──
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: 'SIPROFILM', bold: true, size: 14, font: 'Arial', color: GRAY4 }),
              new TextRun({ text: `\t${orgName.toUpperCase()}`, size: 14, font: 'Arial', color: GRAY4 }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E8E5ED', space: 4 } },
            children: [
              new TextRun({ text: `TODO List — ${orgName}`, size: 14, font: 'Arial', color: GRAY4 }),
              new TextRun({ text: '\tPágina ', size: 14, font: 'Arial', color: GRAY4 }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Arial', color: GRAY4 }),
            ],
          })],
        }),
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = today.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Mexico_City' }).replace(/\//g, '')
  const safeName = orgName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  a.download = `TODO_${safeName}_${d}.docx`
  a.click()
  URL.revokeObjectURL(url)

  return a.download
}
