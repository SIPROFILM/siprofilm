-- Tabla de categorías de costo por tipo de proyecto
CREATE TABLE IF NOT EXISTS public.cost_categories (
  id SERIAL PRIMARY KEY,
  format TEXT NOT NULL,        -- 'serie' | 'pelicula'
  genre TEXT NOT NULL,          -- 'ficcion' | 'documental'
  category_name TEXT NOT NULL,  -- nombre descriptivo
  estimated_cost BIGINT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.cost_categories DISABLE ROW LEVEL SECURITY;

INSERT INTO public.cost_categories (format, genre, category_name, estimated_cost, sort_order) VALUES
  -- Series Ficción
  ('serie', 'ficcion', 'AAA Plataforma',    435000000, 1),
  ('serie', 'ficcion', 'Episódica AA',      120000000, 2),
  ('serie', 'ficcion', 'AA Sitcom',          70000000, 3),
  -- Series Documental
  ('serie', 'documental', 'Plataforma',      25000000, 4),
  ('serie', 'documental', 'TV',              15000000, 5),
  -- Películas Ficción
  ('pelicula', 'ficcion', 'AAA Plataforma', 120000000, 6),
  ('pelicula', 'ficcion', 'AAA La Caída',    80000000, 7),
  ('pelicula', 'ficcion', 'AA Videocine',    40000000, 8),
  ('pelicula', 'ficcion', 'A Nacional',      20000000, 9),
  -- Películas Documental
  ('pelicula', 'documental', 'Plataforma',   20000000, 10),
  ('pelicula', 'documental', 'Propiedad',    15000000, 11);

-- Agregar campos de categoría al programa
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS project_format TEXT,        -- 'serie' | 'pelicula'
  ADD COLUMN IF NOT EXISTS project_genre TEXT,          -- 'ficcion' | 'documental'
  ADD COLUMN IF NOT EXISTS cost_category_id INTEGER REFERENCES public.cost_categories(id),
  ADD COLUMN IF NOT EXISTS actual_cost BIGINT;          -- costo real (sobreescribe estimado)

-- Actualizar los proyectos que ya tenemos con datos conocidos
UPDATE public.programs SET project_format = 'serie', project_genre = 'ficcion', actual_cost = 435000000
WHERE name = 'Mal de Amores T1';

UPDATE public.programs SET project_format = 'serie', project_genre = 'ficcion'
WHERE name = 'Mal de Amores T2';

UPDATE public.programs SET project_format = 'serie', project_genre = 'documental'
WHERE name = 'Aún Hay Más';
