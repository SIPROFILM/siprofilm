import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, TabStopType, TabStopPosition,
} from 'docx'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
)

const STAGE_LABEL = {
  incubadora: 'Incubadora', desarrollo: 'Desarrollo', preproduccion: 'Preproducción',
  produccion: 'Producción', postproduccion: 'Postproducción', distribucion: 'Distribución',
}
const STAGE_ORDER = ['produccion', 'postproduccion', 'preproduccion', 'desarrollo', 'incubadora', 'distribucion']

const STATUS_LABEL = {
  pending: 'Pendiente', in_progress: 'En curso', delivered: 'Entregada', blocked: 'Bloqueada',
}
const STATUS_COLOR = {
  pending: 'C7BFEF', in_progress: '4B52EB', delivered: '7CB342', blocked: 'F92D97',
}
const STATUS_TEXT_COLOR = {
  pending: '4A4358', in_progress: 'FFFFFF', delivered: 'FFFFFF', blocked: 'FFFFFF',
}

// Brand colors
const PINK   = 'F92D97'
const BLUE   = '4B52EB'
const DARK   = '141213'
const GRAY1  = '333333'
const GRAY2  = '666666'
const GRAY3  = '999999'
const GRAY4  = 'CCCCCC'
const LIGHT  = 'F5F3F7'

function sortByStage(list) {
  return [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', timeZone: 'America/Mexico_City',
  })
}

function fmtDateFull(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City',
  })
}

// Table cell helper
function cell(text, opts = {}) {
  const {
    bold = false, color = GRAY1, size = 18, font = 'Arial',
    shading, width, align = AlignmentType.LEFT, italic = false, caps = false,
  } = opts
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'E8E5ED' }
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: { top: border, bottom: border, left: border, right: border },
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text, bold, color, size, font, italics: italic,
        allCaps: caps,
      })],
    })],
  })
}

// Status pill cell
function statusCell(status, width) {
  const label = STATUS_LABEL[status] || status
  const fill = STATUS_COLOR[status] || 'E5E7EB'
  const textColor = STATUS_TEXT_COLOR[status] || GRAY1
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'E8E5ED' }
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: label, bold: true, color: textColor, size: 15, font: 'Arial',
      })],
    })],
    shading: { fill, type: ShadingType.CLEAR },
  })
}

export default async function handler(req, res) {
  try {
    // Get org_id from query params
    const orgId = req.query?.org || null

    let progQuery = supabase
      .from('programs')
      .select('id, name, stage, status, status_note, project_format, project_genre, activities(*, responsible:participants(name))')
      .order('name')

    if (orgId) {
      progQuery = progQuery.eq('org_id', orgId)
    }

    const { data: programs } = await progQuery
    if (!programs) throw new Error('No se pudieron cargar los proyectos')

    // Get org name
    let orgName = 'CAPRO'
    if (orgId) {
      const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
      if (org?.name) orgName = org.name
    }

    const today = new Date()
    const dateStr = today.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City',
    })

    // Filter out delivered activities and sort by start_date
    programs.forEach(p => {
      if (p.activities) {
        p.activities = p.activities
          .filter(a => a.status !== 'delivered')
          .sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'))
      }
    })

    const sorted = sortByStage(programs.filter(p => (p.activities || []).length > 0))

    // ── Build document ──
    const children = []

    // ── Title block ──
    children.push(new Paragraph({
      spacing: { after: 0 },
      children: [
        new TextRun({ text: 'TODO LIST', bold: true, size: 40, font: 'Arial', color: DARK }),
      ],
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

    // Pink accent divider
    children.push(new Paragraph({
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PINK, space: 1 } },
      children: [],
    }))

    // ── Quick summary ──
    const allActs = programs.flatMap(p => p.activities || [])
    const totalActs = allActs.length
    const delivered = allActs.filter(a => a.status === 'delivered').length
    const inProgress = allActs.filter(a => a.status === 'in_progress').length
    const blocked = allActs.filter(a => a.status === 'blocked').length
    const pending = allActs.filter(a => a.status === 'pending').length
    const overdue = allActs.filter(a => a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today).length

    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: 'RESUMEN', bold: true, size: 16, font: 'Arial', color: GRAY3, allCaps: true })],
    }))

    const summaryParts = [
      `${programs.length} programas`,
      `${totalActs} actividades`,
      `${delivered} entregadas`,
      `${inProgress} en curso`,
      `${pending} pendientes`,
    ]
    if (blocked > 0) summaryParts.push(`${blocked} bloqueadas`)
    if (overdue > 0) summaryParts.push(`${overdue} vencidas`)

    children.push(new Paragraph({
      spacing: { after: 320 },
      children: [new TextRun({ text: summaryParts.join('  ·  '), size: 18, font: 'Arial', color: GRAY2 })],
    }))

    // ── Per-program sections ──
    // Table column widths: Name(3200) | Responsable(1500) | Inicio(1100) | Fin(1100) | Deadline(1100) | Estado(1080)
    const COL_W = [3200, 1500, 1100, 1100, 1100, 1080]
    const TABLE_W = COL_W.reduce((s, w) => s + w, 0) // 10080

    sorted.forEach((prog, progIdx) => {
      const acts = prog.activities || []
      const stageLabel = STAGE_LABEL[prog.stage] || prog.stage
      const progDelivered = acts.filter(a => a.status === 'delivered').length
      const pct = acts.length > 0 ? Math.round((progDelivered / acts.length) * 100) : 0

      // Program header with pink left accent
      children.push(new Paragraph({
        spacing: { before: progIdx > 0 ? 400 : 120, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: PINK, space: 4 } },
        children: [
          new TextRun({ text: prog.name.toUpperCase(), bold: true, size: 24, font: 'Arial', color: DARK }),
        ],
      }))

      // Stage + progress line
      children.push(new Paragraph({
        spacing: { after: 160 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: stageLabel.toUpperCase(), bold: true, size: 16, font: 'Arial', color: BLUE }),
          new TextRun({ text: `  ·  ${acts.length} actividades`, size: 16, font: 'Arial', color: GRAY3 }),
          new TextRun({ text: `\t${pct}% completado`, size: 16, font: 'Arial', color: GRAY3 }),
        ],
      }))

      // Table header
      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          cell('ACTIVIDAD',   { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[0], caps: true }),
          cell('RESPONSABLE', { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[1], caps: true }),
          cell('INICIO',      { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[2], align: AlignmentType.CENTER, caps: true }),
          cell('FIN',         { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[3], align: AlignmentType.CENTER, caps: true }),
          cell('DEADLINE',    { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[4], align: AlignmentType.CENTER, caps: true }),
          cell('ESTADO',      { bold: true, size: 15, color: GRAY2, shading: LIGHT, width: COL_W[5], align: AlignmentType.CENTER, caps: true }),
        ],
      })

      // Activity rows
      const dataRows = acts.map(act => {
        const resp = act.responsible?.[0]?.name || '—'
        const isOverdue = act.status !== 'delivered' && act.end_date && new Date(act.end_date) < today
        const deadlineColor = act.deadline && new Date(act.deadline) < today && act.status !== 'delivered' ? PINK : GRAY1

        return new TableRow({
          children: [
            cell(act.name, {
              size: 17, color: isOverdue ? PINK : DARK, bold: isOverdue,
              width: COL_W[0],
            }),
            cell(resp, { size: 16, color: GRAY2, italic: true, width: COL_W[1] }),
            cell(fmtDateShort(act.start_date), { size: 16, color: GRAY2, width: COL_W[2], align: AlignmentType.CENTER }),
            cell(fmtDateShort(act.end_date), {
              size: 16, color: isOverdue ? PINK : GRAY2, bold: isOverdue,
              width: COL_W[3], align: AlignmentType.CENTER,
            }),
            cell(act.deadline ? fmtDateShort(act.deadline) : '—', {
              size: 16, color: deadlineColor, width: COL_W[4], align: AlignmentType.CENTER,
              bold: deadlineColor === PINK,
            }),
            statusCell(act.status, COL_W[5]),
          ],
        })
      })

      children.push(new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: COL_W,
        rows: [headerRow, ...dataRows],
      }))
    })

    // ── Programs without activities ──
    const empty = programs.filter(p => (p.activities || []).length === 0)
    if (empty.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 480, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: GRAY4, space: 4 } },
        children: [new TextRun({
          text: `SIN ACTIVIDADES (${empty.length})`, bold: true, size: 20, font: 'Arial', color: GRAY3,
        })],
      }))
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({
          text: sortByStage(empty).map(p => p.name).join('  ·  '),
          size: 18, font: 'Arial', color: GRAY3,
        })],
      }))
    }

    // ── Build DOCX ──
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Arial', size: 20 } },
        },
      },
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

    // Filename: TODO_OrgName_date.docx
    const d = today.toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Mexico_City',
    }).replace(/\//g, '')
    const safeOrgName = orgName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
    const filename = `TODO_${safeOrgName}_${d}.docx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(buffer)
  } catch (err) {
    console.error('todo-docx error:', err)
    res.status(500).json({ error: err.message })
  }
}
