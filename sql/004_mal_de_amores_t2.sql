-- MAL DE AMORES SEGUNDA TEMPORADA — Proyecto para Netflix
-- Etapa: Desarrollo | Calendario: Dic 2025 – Oct 2026

INSERT INTO public.programs (name, status, stage, start_date, notes)
VALUES (
  'Mal de Amores T2',
  'active',
  'desarrollo',
  '2025-12-15',
  'Serie para Netflix. Segunda temporada. Calendario de desarrollo Dic 2025 – Oct 2026. Producida por Filmadora.'
)
RETURNING id;

-- Usar el ID retornado. Si necesitas hacerlo en un solo bloque:
DO $$
DECLARE
  prog_id INTEGER;
BEGIN
  SELECT id INTO prog_id FROM public.programs WHERE name = 'Mal de Amores T2' LIMIT 1;

  INSERT INTO public.activities (program_id, name, start_date, end_date, duration_days, status) VALUES
    -- Fase de escritura inicial
    (prog_id, 'Reuniones escritores',         '2025-12-15', '2026-01-12', 28, 'delivered'),
    (prog_id, 'Cuarto de escritores',          '2026-02-02', '2026-03-08', 34, 'delivered'),
    (prog_id, 'Break de temporada',            '2026-03-02', '2026-04-05', 34, 'delivered'),
    (prog_id, 'Primer borrador Biblia',        '2026-04-01', '2026-04-10', 10, 'pending'),
    (prog_id, 'Entrega Biblia a Netflix',      '2026-04-10', '2026-04-12', 2,  'pending'),
    (prog_id, 'Revisión de Biblia',            '2026-04-13', '2026-04-26', 13, 'pending'),

    -- Capítulo 1
    (prog_id, 'Cap 1 — Primer Draft',          '2026-05-04', '2026-05-17', 13, 'pending'),
    (prog_id, 'Cap 1 — Segundo Draft',         '2026-05-18', '2026-06-07', 20, 'pending'),
    (prog_id, 'Cap 1 — Tercer Draft',          '2026-06-22', '2026-07-05', 13, 'pending'),

    -- Capítulo 2
    (prog_id, 'Cap 2 — Primer Draft',          '2026-05-04', '2026-05-17', 13, 'pending'),
    (prog_id, 'Cap 2 — Segundo Draft',         '2026-05-25', '2026-06-21', 27, 'pending'),
    (prog_id, 'Cap 2 — Tercer Draft',          '2026-07-06', '2026-08-02', 27, 'pending'),

    -- Capítulo 3
    (prog_id, 'Cap 3 — Primer Draft',          '2026-05-11', '2026-05-24', 13, 'pending'),
    (prog_id, 'Cap 3 — Segundo Draft',         '2026-06-01', '2026-06-28', 27, 'pending'),
    (prog_id, 'Cap 3 — Tercer Draft',          '2026-07-20', '2026-08-09', 20, 'pending'),

    -- Capítulo 4
    (prog_id, 'Cap 4 — Primer Draft',          '2026-05-18', '2026-05-31', 13, 'pending'),
    (prog_id, 'Cap 4 — Segundo Draft',         '2026-06-08', '2026-07-05', 27, 'pending'),
    (prog_id, 'Cap 4 — Tercer Draft',          '2026-08-03', '2026-08-23', 20, 'pending'),

    -- Capítulo 5
    (prog_id, 'Cap 5 — Primer Draft',          '2026-05-25', '2026-06-07', 13, 'pending'),
    (prog_id, 'Cap 5 — Segundo Draft',         '2026-06-22', '2026-07-19', 27, 'pending'),
    (prog_id, 'Cap 5 — Tercer Draft',          '2026-08-17', '2026-09-06', 20, 'pending'),

    -- Capítulo 6
    (prog_id, 'Cap 6 — Primer Draft',          '2026-06-01', '2026-06-14', 13, 'pending'),
    (prog_id, 'Cap 6 — Segundo Draft',         '2026-06-29', '2026-07-26', 27, 'pending'),
    (prog_id, 'Cap 6 — Tercer Draft',          '2026-08-31', '2026-09-13', 13, 'pending'),

    -- Capítulo 7
    (prog_id, 'Cap 7 — Primer Draft',          '2026-06-08', '2026-06-28', 20, 'pending'),
    (prog_id, 'Cap 7 — Segundo Draft',         '2026-07-06', '2026-08-02', 27, 'pending'),
    (prog_id, 'Cap 7 — Tercer Draft',          '2026-09-07', '2026-09-27', 20, 'pending');

END $$;
