# SIPROFILM — Guía de instalación y deploy

## Requisitos previos

- Node.js 18+ instalado en tu computadora
- Cuenta gratuita en [supabase.com](https://supabase.com)
- Cuenta gratuita en [vercel.com](https://vercel.com)
- Cuenta en [github.com](https://github.com)

---

## Paso 1 — Configurar Supabase (base de datos)

1. Entrá a [supabase.com](https://supabase.com) y creá un nuevo proyecto.
   - Nombre: `siprofilm`
   - Guardá la contraseña del proyecto en algún lugar seguro.

2. Una vez creado, andá a **SQL Editor** (menú izquierdo).

3. Pegá y ejecutá el contenido completo del archivo:
   ```
   supabase/migrations/001_initial.sql
   ```
   Esto crea todas las tablas y carga el catálogo de actividades base.

4. Andá a **Settings → API** y copiá:
   - **Project URL** → la vas a necesitar en el siguiente paso
   - **anon public key** → ídem

---

## Paso 2 — Configurar variables de entorno

1. En la carpeta del proyecto, copiá el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Abrí `.env` y completá con tus datos de Supabase:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-aquí
   ```

---

## Paso 3 — Instalar dependencias y correr localmente

```bash
cd siprofilm
npm install
npm run dev
```

La app debería abrirse en `http://localhost:5173`

---

## Paso 4 — Crear usuario de acceso

1. En Supabase, andá a **Authentication → Users → Add user**
2. Creá un usuario con tu email y una contraseña segura.
3. Repetí para cada integrante del equipo.

---

## Paso 5 — Deploy en Vercel

1. Subí la carpeta `siprofilm` a un repositorio de GitHub.

2. Entrá a [vercel.com](https://vercel.com) → **Add New Project** → importá tu repositorio.

3. En la sección **Environment Variables**, agregá:
   ```
   VITE_SUPABASE_URL     → tu URL de Supabase
   VITE_SUPABASE_ANON_KEY → tu anon key
   ```

4. Hacé click en **Deploy**. En ~2 minutos tenés la app en vivo con URL pública.

---

## Estructura de archivos

```
siprofilm/
├── src/
│   ├── context/AuthContext.jsx   ← autenticación
│   ├── lib/
│   │   ├── supabase.js           ← cliente de base de datos
│   │   └── utils.js              ← fechas, formatos, estados
│   ├── components/Layout.jsx     ← navegación lateral
│   └── pages/
│       ├── Login.jsx             ← pantalla de acceso
│       ├── Dashboard.jsx         ← vista general de programas
│       ├── NewProgram.jsx        ← formulario nuevo programa
│       ├── ProgramDetail.jsx     ← detalle + actividades + presupuesto
│       ├── Participants.jsx      ← equipo de producción
│       └── Settings.jsx          ← configuración (v2)
├── supabase/migrations/
│   └── 001_initial.sql           ← schema completo de la BD
├── .env.example                  ← plantilla de variables de entorno
└── package.json
```

---

## Slack (opcional, para notificaciones)

1. En tu workspace de Slack, creá una **Incoming Webhook**:
   - Andá a `api.slack.com/apps` → Create App → Incoming Webhooks
   - Activalo y elegí el canal donde van las notificaciones.
   - Copiá la URL que te da.

2. En SIPROFILM, al crear o editar un programa, pegá esa URL en el campo **Slack Webhook URL**.

3. Las notificaciones se enviarán automáticamente cuando se agreguen actividades (esto se implementa en la v2 del tracking).

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| "Faltan variables de entorno" | Verificá que `.env` existe y tiene los valores correctos |
| Login no funciona | Confirmá que el usuario fue creado en Supabase → Authentication |
| Error de CORS | Andá a Supabase → Settings → API → agregar tu URL de Vercel en "Allowed origins" |
| Datos no aparecen | Verificá que el SQL se ejecutó correctamente en Supabase → Table Editor |
