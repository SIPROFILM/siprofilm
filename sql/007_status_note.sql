-- Agrega campo de nota de status (texto libre tipo "EN ESPERA DE VIX")
-- que se muestra como headline en el resumen diario de Slack

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS status_note TEXT;

COMMENT ON COLUMN public.programs.status_note IS
  'Nota corta del status actual del proyecto, se muestra como headline en mayúsculas en el resumen de Slack. Ej: "EN ESPERA DE VIX", "REVISANDO PRESUPUESTO".';
