-- 010: Add sort_order column to activities for drag-and-drop reordering in Timeline
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on current start_date order within each program
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY start_date NULLS LAST, name) - 1 AS rn
  FROM activities
)
UPDATE activities SET sort_order = ranked.rn
FROM ranked WHERE activities.id = ranked.id;
