-- Nuevos campos para formulario dinámico por etapa
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS google_drive_link TEXT,
  ADD COLUMN IF NOT EXISTS green_light BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS director TEXT,
  ADD COLUMN IF NOT EXISTS cost_desarrollo BIGINT,
  ADD COLUMN IF NOT EXISTS cost_preproduccion BIGINT,
  ADD COLUMN IF NOT EXISTS cost_produccion BIGINT,
  ADD COLUMN IF NOT EXISTS cost_postproduccion BIGINT,
  ADD COLUMN IF NOT EXISTS cost_distribucion BIGINT;
