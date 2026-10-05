# API backend LABRAH&

Servicio Node.js/Express independiente del frontend estático. Solo expone API JSON y una comprobación de salud; no aloja los archivos de GitHub Pages.

## Desarrollo local

Requiere Node.js 22.13 o posterior. Ejecuta `npm install`, copia `.env.example` a `.env`, define `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `SESSION_SECRET`, configura `CORS_ORIGINS=*` solo para desarrollo y ejecuta `npm start`. Sin `DATABASE_URL`, crea `backend/db.sqlite`.

## Publicar en Render/Railway

El blueprint `render.yaml` define el servicio web con raíz `backend`, Node 22.13+, comprobación de salud y nivel gratuito. Crea el Blueprint desde el repositorio y completa `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el asistente. Conecta PostgreSQL administrado y define además un `SESSION_SECRET` largo. Configura `CORS_ORIGINS` con el origen real de GitHub Pages, por ejemplo `https://gabriellabradord-dot.github.io`; no configures `*` en producción. Si el proveedor PostgreSQL privado no usa TLS, añade `PGSSLMODE=disable`; el adaptador activa TLS por defecto para conexiones externas.

El fallback SQLite sirve para desarrollo y demostraciones en un disco persistente. En alojamiento efímero, el archivo SQLite puede perderse al reiniciar o publicar; para producción usa PostgreSQL.

## API

- `GET /api/health` — estado y motor de base de datos.
- `GET /api/products` — prendas.
- `POST /api/auth/register` — `{full_name,email,password,avatar_base64}`; devuelve perfil y token.
- `POST /api/auth/login` — `{email,password}`; devuelve perfil y token.
- `GET /api/auth/me` — requiere `Authorization: Bearer <token>`.
- `POST /api/orders` — requiere token; recibe prendas y dirección, nunca datos de tarjeta.
- `GET /api/admin/metrics` — token del rol administración.

El cobro es ficticio. Contraseñas con scrypt, tokens HMAC firmados y compras/inventario dentro de transacciones. El navegador conserva el token durante la sesión; usa exclusivamente HTTPS al publicar.
