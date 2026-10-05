# Frontend estático LABRAH&

Esta carpeta es independiente y puede publicarse en GitHub Pages. No ejecuta Node ni sirve la API: consulta el proyecto hermano `backend` mediante Fetch.

## Configurar la URL de la API

`js/config.js` apunta a `http://localhost:3000` desde localhost y a `https://labrah-backend.onrender.com` desde un dominio público. El flujo del repositorio `.github/workflows/deploy-pages.yml` inyecta el valor real al publicar; si Render entrega otro dominio, define la variable de repositorio `LABRAH_API_URL` en GitHub Actions.

## Publicar en GitHub Pages

Sube el contenido de esta carpeta a una rama o repositorio y configura GitHub Pages para servir la raíz del frontend. Las rutas son páginas HTML estáticas (`catalog.html`, `details.html`, etc.). Asegúrate de permitir en el backend el origen exacto de Pages con `CORS_ORIGINS`.

La cámara requiere HTTPS; GitHub Pages ya sirve la web con HTTPS. El token de API se guarda en `sessionStorage` y se elimina al cerrar la pestaña. El checkout es una simulación: los números/CVV de tarjeta nunca se transmiten al servidor.
