import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
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

function sortByStage(list) {
  return [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
}

export default async function handler(req, res) {
  try {
    const { data: programs } = await supabase
      .from('programs')
      .select('id, name, stage, status, status_note, project_format, project_genre, activities(id, name, status, end_date, responsible:participants(name))')
      .order('name')

    if (!programs) throw new Error('No se pudieron cargar los proyectos')

    const today = new Date()
    const in7days = new Date(today)
    in7days.setDate(in7days.getDate() + 7)

    const dateStr = today.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City',
    })

    // ── Classify projects ──
    function isActive(prog) {
      if (prog.status_note && prog.status_note.trim()) return true
      const acts = prog.activities || []
      if (acts.some(a => a.status === 'in_progress' || a.status === 'blocked')) return true
      if (acts.some(a => a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today)) return true
      if (acts.some(a => {
        if (a.status === 'delivered' || !a.end_date) return false
        const d = new Date(a.end_date)
        return d >= today && d <= in7days
      })) return true
      return false
    }

    function getHeadline(prog) {
      if (prog.status_note && prog.status_note.trim()) {
        return prog.status_note.trim().toUpperCase()
      }
      const acts = prog.activities || []
      const blocked = acts.filter(a => a.status === 'blocked')
      const inProgress = acts.filter(a => a.status === 'in_progress')
      const overdue = acts.filter(a =>
        a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
      )
      const delivered = acts.filter(a => a.status === 'delivered').length
      const total = acts.length

      if (blocked.length > 0) return `BLOQUEADO: ${blocked.map(a => a.name).join(', ').toUpperCase()}`
      if (overdue.length > 0) return `VENCIDAS: ${overdue.slice(0, 2).map(a => a.name).join(', ').toUpperCase()}`
      if (total > 0 && delivered === total) return 'TODAS LAS ACTIVIDADES ENTREGADAS'
      if (inProgress.length > 0) return inProgress[0].name.toUpperCase()
      return `EN ${(STAGE_LABEL[prog.stage] || prog.stage).toUpperCase()}`
    }

    const activeProjects = programs.filter(isActive)
    const passiveProjects = programs.filter(p => !isActive(p))

    // ── Build document paragraphs ──
    const children = []

    // Title
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 0 },
      children: [new TextRun({ text: 'TO DO LIST CAPRO', bold: true, size: 36, font: 'Arial' })],
    }))
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: `SIPROFILM \u2014 ${dateStr}`, size: 20, font: 'Arial', color: '888888' })],
    }))

    // Divider
    children.push(new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333', space: 1 } },
      children: [],
    }))

    // ── Render active project ──
    function renderProject(prog) {
      const paras = []
      const acts = prog.activities || []
      const stageLabel = STAGE_LABEL[prog.stage] || prog.stage
      const headline = getHeadline(prog)

      // Project name + stage
      paras.push(new Paragraph({
        spacing: { before: 280, after: 0 },
        children: [
          new TextRun({ text: prog.name.toUpperCase(), bold: true, size: 24, font: 'Arial' }),
          new TextRun({ text: `  \u2014  ${stageLabel}`, size: 20, font: 'Arial', color: '666666' }),
        ],
      }))

      // Headline
      paras.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: headline, bold: true, size: 22, font: 'Arial', color: '222222' })],
      }))

      // Action items
      const overdue = acts.filter(a =>
        a.status !== 'delivered' && a.end_date && new Date(a.end_date) < today
      )
      const inProg = acts.filter(a => a.status === 'in_progress')
      const blocked = acts.filter(a => a.status === 'blocked')
      const upcoming = acts.filter(a => {
        if (a.status === 'delivered' || !a.end_date) return false
        const d = new Date(a.end_date)
        return d >= today && d <= in7days
      })
      const pending = acts.filter(a => a.status === 'pending')

      const shown = new Set()
      const bullets = []

      // Overdue
      for (const a of overdue.slice(0, 4)) {
        const resp = a.responsible?.[0]?.name || ''
        const dateLabel = new Date(a.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
        const parts = [new TextRun({ text: a.name, size: 20, font: 'Arial' })]
        if (resp) parts.push(new TextRun({ text: ` \u2014 ${resp}`, size: 20, font: 'Arial', italics: true, color: '666666' }))
        parts.push(new TextRun({ text: ` (venci\u00f3 ${dateLabel})`, size: 20, font: 'Arial', color: 'CC0000' }))
        bullets.push(parts)
        shown.add(a.id)
      }

      // In progress
      for (const a of inProg.filter(a => !shown.has(a.id)).slice(0, 4)) {
        const resp = a.responsible?.[0]?.name || ''
        const parts = [new TextRun({ text: a.name, size: 20, font: 'Arial' })]
        if (resp) parts.push(new TextRun({ text: ` \u2014 ${resp}`, size: 20, font: 'Arial', italics: true, color: '666666' }))
        bullets.push(parts)
        shown.add(a.id)
      }

      // Upcoming
      for (const a of upcoming.filter(a => !shown.has(a.id)).slice(0, 3)) {
        const resp = a.responsible?.[0]?.name || ''
        const dayLabel = new Date(a.end_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'America/Mexico_City' })
        const parts = [new TextRun({ text: `${a.name} (${dayLabel})`, size: 20, font: 'Arial' })]
        if (resp) parts.push(new TextRun({ text: ` \u2014 ${resp}`, size: 20, font: 'Arial', italics: true, color: '666666' }))
        bullets.push(parts)
        shown.add(a.id)
      }

      // Blocked
      for (const a of blocked.filter(a => !shown.has(a.id))) {
        const resp = a.responsible?.[0]?.name || ''
        const parts = [new TextRun({ text: `BLOQUEADO: ${a.name}`, size: 20, font: 'Arial', color: 'CC0000', bold: true })]
        if (resp) parts.push(new TextRun({ text: ` \u2014 ${resp}`, size: 20, font: 'Arial', italics: true, color: '666666' }))
        bullets.push(parts)
        shown.add(a.id)
      }

      // Remaining pending if nothing else shown
      if (shown.size === 0) {
        for (const a of pending.slice(0, 3)) {
          const resp = a.responsible?.[0]?.name || ''
          const parts = [new TextRun({ text: a.name, size: 20, font: 'Arial' })]
          if (resp) parts.push(new TextRun({ text: ` \u2014 ${resp}`, size: 20, font: 'Arial', italics: true, color: '666666' }))
          bullets.push(parts)
        }
        if (pending.length > 3) {
          bullets.push([new TextRun({ text: `+${pending.length - 3} pendientes m\u00e1s`, size: 20, font: 'Arial', italics: true, color: '999999' })])
        }
      }

      // Add bullet paragraphs
      for (const parts of bullets) {
        paras.push(new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 40 },
          children: parts,
        }))
      }

      return paras
    }

    // ── Group by format/genre ──
    function addSection(title, projs) {
      if (projs.length === 0) return
      children.push(new Paragraph({
        spacing: { before: 360, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 } },
        children: [new TextRun({ text: title, bold: true, size: 28, font: 'Arial' })],
      }))
      for (const p of projs) {
        children.push(...renderProject(p))
      }
    }

    function addGenreGroup(title, projs) {
      if (projs.length === 0) return
      children.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: title, bold: true, size: 22, font: 'Arial', color: '555555', italics: true })],
      }))
      for (const p of projs) {
        children.push(...renderProject(p))
      }
    }

    // SERIES activas
    const series = sortByStage(activeProjects.filter(p => p.project_format === 'serie'))
    if (series.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 360, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } },
        children: [new TextRun({ text: 'SERIES', bold: true, size: 30, font: 'Arial' })],
      }))
      const sf = sortByStage(series.filter(p => p.project_genre === 'ficcion'))
      const sd = sortByStage(series.filter(p => p.project_genre === 'documental'))
      const so = sortByStage(series.filter(p => !p.project_genre))
      if (sf.length > 0) addGenreGroup('Ficci\u00f3n', sf)
      if (sd.length > 0) addGenreGroup('Documental', sd)
      if (so.length > 0) addGenreGroup('Sin g\u00e9nero', so)
    }

    // PELÍCULAS activas
    const pelis = sortByStage(activeProjects.filter(p => p.project_format === 'pelicula'))
    if (pelis.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 360, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } },
        children: [new TextRun({ text: 'PEL\u00cdCULAS', bold: true, size: 30, font: 'Arial' })],
      }))
      const pf = sortByStage(pelis.filter(p => p.project_genre === 'ficcion'))
      const pd = sortByStage(pelis.filter(p => p.project_genre === 'documental'))
      const po = sortByStage(pelis.filter(p => !p.project_genre))
      if (pf.length > 0) addGenreGroup('Ficci\u00f3n', pf)
      if (pd.length > 0) addGenreGroup('Documental', pd)
      if (po.length > 0) addGenreGroup('Sin g\u00e9nero', po)
    }

    // SIN CLASIFICAR activos
    const sinFormato = sortByStage(activeProjects.filter(p => !p.project_format))
    if (sinFormato.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 360, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } },
        children: [new TextRun({ text: 'SIN CLASIFICAR', bold: true, size: 30, font: 'Arial' })],
      }))
      for (const p of sinFormato) children.push(...renderProject(p))
    }

    // ── EN PAUSA (lista compacta) ──
    if (passiveProjects.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 480, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 } },
        children: [new TextRun({ text: `EN PAUSA / SIN ACTIVIDAD (${passiveProjects.length})`, bold: true, size: 24, font: 'Arial', color: '999999' })],
      }))

      const byStage = {}
      for (const p of sortByStage(passiveProjects)) {
        const s = STAGE_LABEL[p.stage] || p.stage
        if (!byStage[s]) byStage[s] = []
        byStage[s].push(p)
      }

      for (const [stage, projs] of Object.entries(byStage)) {
        children.push(new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${stage}: `, bold: true, size: 20, font: 'Arial', color: '999999' }),
            new TextRun({ text: projs.map(p => p.name).join(' \u00b7 '), size: 20, font: 'Arial', color: '999999' }),
          ],
        }))
      }
    }

    // Footer
    children.push(new Paragraph({
      spacing: { before: 480 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 } },
      children: [new TextRun({ text: 'Generado por SIPROFILM \u2014 CAPRO', size: 18, font: 'Arial', color: 'AAAAAA', italics: true })],
    }))

    // ── Build DOCX ──
    const doc = new Document({
      numbering: {
        config: [{
          reference: 'bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        }],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      }],
    })

    const buffer = await Packer.toBuffer(doc)

    // Filename with date
    const d = today.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Mexico_City' }).replace(/\//g, '')
    const filename = `TODO_CAPRO_${d}.docx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(buffer)
  } catch (err) {
    console.error('todo-docx error:', err)
    res.status(500).json({ error: err.message })
  }
}
