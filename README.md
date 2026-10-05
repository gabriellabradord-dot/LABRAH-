# LABRAH& — tienda desacoplada

Proyecto con dos despliegues independientes, todo en español salvo el nombre de marca:

- `frontend/`: HTML/CSS/JavaScript estático, listo para GitHub Pages.
- `backend/`: API REST Express, lista para Render/Railway; usa PostgreSQL cuando recibe `DATABASE_URL` y SQLite local como alternativa.
- `node-1/`: carpeta preexistente, sin cambios.

## Probar en local

1. Instala las dependencias: `npm run install:backend`.
2. Copia `backend/.env.example` a `backend/.env` y define `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET` y `CORS_ORIGINS=*` para desarrollo.
3. Arranca la API desde la raíz con `npm start` (o en modo desarrollo con `npm run dev`).
4. En otra terminal, ejecuta `npm run frontend` y abre `http://localhost:4173`.
5. En localhost, `frontend/js/config.js` conecta automáticamente con `http://localhost:3000`.

## Publicarlo para que no sea solo local

Ya están preparados el flujo de publicación de Pages en `.github/workflows/deploy-pages.yml` y el servicio de Render en `render.yaml`. Para que aparezca en Internet hay que enlazarlo a una cuenta GitHub y una cuenta de hosting; este directorio aún no es un repositorio Git ni tiene remoto, así que todavía no existe una URL pública.

1. Crea en GitHub un repositorio para este proyecto y sube la raíz del workspace (incluye `frontend/`, `backend/`, `render.yaml` y `.github/`). **No subas `.env`, `node_modules` ni bases SQLite.** Activa GitHub Pages usando GitHub Actions.
2. En Render crea el servicio con **New → Blueprint** y selecciona el repositorio. El archivo `render.yaml` prepara el backend `labrah-backend-gabriel`; al crear el servicio completa `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. En `DATABASE_URL` usa PostgreSQL persistente, por ejemplo una base administrada de Supabase. Define una contraseña de administrador segura y no reutilices la contraseña compartida anteriormente.
3. La página de GitHub ejecutará automáticamente el workflow al publicar en `main` o `master`. Este inserta la URL de la API Render (por defecto `https://labrah-backend-gabriel.onrender.com`). Si el dominio generado por Render cambia, añade la variable de repositorio `LABRAH_API_URL` con la URL real.
4. En Render, `CORS_ORIGINS` debe ser el origen exacto de GitHub Pages indicado por GitHub (por ejemplo `https://gabriellabradord-dot.github.io`, sin ruta ni barra final). Render Blueprint lo deja configurado para ese origen; actualízalo si tu cuenta o dominio difiere.
5. Tras el primer despliegue, abre la URL que muestre el workflow de Pages. La API puede tardar unos segundos en despertar en un servicio gratuito inactivo.

Las instrucciones específicas están en [frontend/README.md](frontend/README.md) y [backend/README.md](backend/README.md). El servicio gratuito puede suspenderse o tener límites: para conservar pedidos usa una base persistente y revisa las condiciones vigentes de tu proveedor.

Consulta las instrucciones específicas en [frontend/README.md](frontend/README.md) y [backend/README.md](backend/README.md). La página principal es [frontend/index.html](frontend/index.html).

El registro toma la foto solicitada mediante WebRTC. Las contraseñas se guardan con scrypt; el frontend usa tokens firmados en `sessionStorage`. El pago y los datos de tarjeta son demostrativos: el número y el código de seguridad nunca se envían al backend. Para producción, usa siempre HTTPS y una base de datos PostgreSQL persistente.
