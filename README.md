# ⛓️ LABRAH — Digital Streetwear Experience

![Status](https://img.shields.io/badge/Status-Production-c4fb36?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%20%7C%20PostgreSQL-black?style=for-the-badge)

**LABRAH** es una plataforma de e-commerce de vanguardia diseñada para una marca de ropa con estética urbana, trap y minimalista. Este repositorio contiene una arquitectura desacoplada con un backend robusto y un frontend estático de alto rendimiento.

## ⚡ Características Principales

- **Full-Stack Architecture:** Backend en Node.js (ESM) y Frontend con Vanilla JS/CSS3.
- **Hybrid Database:** Soporte nativo para SQLite (desarrollo) y PostgreSQL (producción).
- **Secure Auth:** Autenticación basada en tokens HMAC con hashing de contraseñas mediante Scrypt.
- **Admin Dashboard:** Métricas en tiempo real, gestión de inventario y control de pedidos.
- **Urban UI:** Interfaz minimalista optimizada para móviles con temática Dark/Neon.

## 🛠️ Stack Técnico

- **Backend:** Node.js 22+, Express, node-postgres.
- **Database:** PostgreSQL (vía Supabase/Neon).
- **Frontend:** HTML5, CSS3 (Custom Properties), Vanilla JS.
- **Seguridad:** CORS-enabled, Rate Limiting, sanitización de inputs.

## 🚀 Instalación Local

1. **Clonar el repositorio:**

    ```bash
    git clone https://github.com/tu-usuario/LABRAH-.git
    cd LABRAH-
    ```

2. **Configurar el Backend:**

    ```bash
    cd backend
    npm install
    cp .env.example .env
    ```

    _Edita el archivo `.env` con tus credenciales._

3. **Iniciar en modo desarrollo:**

    ```bash
    # Desde la raíz
    npm run dev
    ```

4. **Acceder al sitio:**
   El frontend se servirá (si usas el script incluido) en `http://localhost:4173` y la API en `http://localhost:3000`.

## 📦 Despliegue

Este proyecto está optimizado para:

- **Backend:** Render / Railway (usando el archivo `render.yaml`).
- **Frontend:** GitHub Pages / Vercel.
- **Database:** Supabase (PostgreSQL).

---

Desarrollado por **Gabriel Labrador** - _LABRAH &_
