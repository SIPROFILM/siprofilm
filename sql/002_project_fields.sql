-- ============================================================
-- SIPROFILM: Agregar campos de ficha de proyecto (Ingreso Proyecto)
-- Correr en Supabase SQL Editor
-- ============================================================

-- 1. Nuevas columnas basadas en el formulario de Ingreso Proyecto
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS project_type       text,          -- Película, Serie, Por definir
  ADD COLUMN IF NOT EXISTS content_type       text,          -- Ficción, Documental
  ADD COLUMN IF NOT EXISTS logline            text,          -- Logline / Idea
  ADD COLUMN IF NOT EXISTS dev_process        text,          -- Proceso de desarrollo (si es desarrollo)
  ADD COLUMN IF NOT EXISTS existing_materials text,          -- Materiales existentes (comma separated)
  ADD COLUMN IF NOT EXISTS whats_needed       text,          -- ¿Qué falta para avanzar?
  ADD COLUMN IF NOT EXISTS estimated_cost     text,          -- Costo total aproximado
  ADD COLUMN IF NOT EXISTS has_investment     text,          -- ¿Cuenta con inversión previa? Sí/No
  ADD COLUMN IF NOT EXISTS confirmed_talent   text,          -- Talento confirmado
  ADD COLUMN IF NOT EXISTS producer           text,          -- Productor responsable
  ADD COLUMN IF NOT EXISTS distribution_channel text,        -- Canal de distribución pensado
  ADD COLUMN IF NOT EXISTS target_end_date    date,          -- Fecha aproximada de finalización
  -- Campos adicionales del Excel de desarrollo
  ADD COLUMN IF NOT EXISTS writers            text,          -- Escritor(a)
  ADD COLUMN IF NOT EXISTS genre              text,          -- Formato/Género
  ADD COLUMN IF NOT EXISTS commercial_potential text,        -- Potencial Comercial
  ADD COLUMN IF NOT EXISTS cinematographic_potential text,   -- Potencial Cinematográfico
  ADD COLUMN IF NOT EXISTS treatment_status   text,          -- Estado del tratamiento
  ADD COLUMN IF NOT EXISTS synopsis           text,          -- Sinopsis
  ADD COLUMN IF NOT EXISTS script_notes       text;          -- Notas de guión


-- 2. Migrar datos del campo "notes" a columnas individuales (21 proyectos de incubadora)
-- Extraer Escritor(a)
UPDATE public.programs
SET writers = substring(notes from 'Escritor\(a\): ([^\n]+)')
WHERE notes LIKE '%Escritor(a):%' AND writers IS NULL;

-- Extraer Formato
UPDATE public.programs
SET genre = substring(notes from 'Formato: ([^\n]+)')
WHERE notes LIKE '%Formato:%' AND genre IS NULL;

-- Extraer Potencial Comercial
UPDATE public.programs
SET commercial_potential = substring(notes from 'Potencial Comercial: ([^\n]+)')
WHERE notes LIKE '%Potencial Comercial:%' AND commercial_potential IS NULL;

-- Extraer Potencial Cinematográfico
UPDATE public.programs
SET cinematographic_potential = substring(notes from 'Potencial Cinematográfico: ([^\n]+)')
WHERE notes LIKE '%Potencial Cinematográfico:%' AND cinematographic_potential IS NULL;

-- Extraer Tratamiento
UPDATE public.programs
SET treatment_status = substring(notes from 'Tratamiento: ([^\n]+)')
WHERE notes LIKE '%Tratamiento:%' AND treatment_status IS NULL;

-- Extraer Sinopsis
UPDATE public.programs
SET synopsis = substring(notes from 'Sinopsis: ([^\n]+)')
WHERE notes LIKE '%Sinopsis:%' AND synopsis IS NULL;

-- Extraer Notas guión
UPDATE public.programs
SET script_notes = substring(notes from 'Notas guión: (.+)$')
WHERE notes LIKE '%Notas guión:%' AND script_notes IS NULL;

-- Para los de incubadora que no tienen project_type, inferirlo del género
UPDATE public.programs
SET project_type = CASE
  WHEN genre ILIKE '%Serie%' THEN 'Serie'
  WHEN genre ILIKE '%Película%' OR genre ILIKE '%Pelicula%' OR genre ILIKE '%Pélicula%' THEN 'Película'
  ELSE 'Por definir'
END
WHERE stage = 'incubadora' AND project_type IS NULL AND genre IS NOT NULL;

-- Contenido por defecto Ficción para los de incubadora
UPDATE public.programs
SET content_type = 'Ficción'
WHERE stage = 'incubadora' AND content_type IS NULL;
