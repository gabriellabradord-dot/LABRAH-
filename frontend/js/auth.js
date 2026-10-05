import { apiRequest, TOKEN_KEY } from './config.js';
import { captureAvatar } from './camera.js';
import { playCue } from './audio.js';

export function currentToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function currentUser() {
  if (!currentToken()) return null;
  try {
    return (await apiRequest('/api/auth/me')).user;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export function initAuth() {
  const message = document.querySelector('[data-auth-message]');
  const loginForm = document.querySelector('[data-login-form]');
  const registerForm = document.querySelector('[data-register-form]');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    const button = loginForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const fields = new FormData(loginForm);
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') })
      });
      sessionStorage.setItem(TOKEN_KEY, result.token);
      playCue('exito');
      window.location.assign(result.user.role === 'admin' ? 'admin.html' : 'catalog.html');
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });

  if (registerForm) {
    const video = registerForm.querySelector('[data-camera-video]');
    const canvas = registerForm.querySelector('[data-camera-canvas]');
    const preview = registerForm.querySelector('[data-avatar-preview]');
    const cameraButton = registerForm.querySelector('[data-camera-start]');
    let avatarBase64 = '';

    async function takePhoto() {
      cameraButton.disabled = true;
      cameraButton.textContent = 'CÁMARA ACTIVA — TOMANDO FOTO…';
      avatarBase64 = await captureAvatar(video, canvas, preview);
      cameraButton.textContent = 'FOTO GUARDADA ✓ — REPETIR';
      cameraButton.disabled = false;
    }

    cameraButton.addEventListener('click', async () => {
      message.textContent = '';
      try {
        await takePhoto();
      } catch (error) {
        cameraButton.disabled = false;
        cameraButton.textContent = 'CÁMARA NO DISPONIBLE — REINTENTAR';
        message.textContent = error.message;
      }
    });

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const button = registerForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        if (!avatarBase64) await takePhoto();
        const fields = new FormData(registerForm);
        const result = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fields.get('full_name'),
            email: fields.get('email'),
            password: fields.get('password'),
            avatar_base64: avatarBase64
          })
        });
        sessionStorage.setItem(TOKEN_KEY, result.token);
        playCue('exito');
        window.location.assign('catalog.html');
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
  }

  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.assign('index.html');
  }));
}
