// GitHub Actions inyecta la URL real de la API al publicar; el valor siguiente es el dominio del servicio Render.
const configuredApiUrl = window.LABRAH_API_URL;
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_BASE_URL = (configuredApiUrl || (isLocalDevelopment ? 'http://localhost:3000' : 'https://labrah-backend.onrender.com')).replace(/\/$/, '');
export const TOKEN_KEY = 'labrah_access_token';

// Las solicitudes llevan el token en Authorization, así no dependen de cookies cross-site.
export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    body: options.body,
    mode: 'cors',
    credentials: 'omit'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud. Inténtalo de nuevo.');
  return payload;
}
