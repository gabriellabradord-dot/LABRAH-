import { API_BASE_URL, apiRequest } from './config.js';
import { currentUser, initAuth } from './auth.js';
import { initAudio, playCue } from './audio.js';

const CART_KEY = 'labrah_bolsa_v1';
const formatMoney = (amount) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let products = [];
let user = null;
let cart = readCart();

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => Number.isInteger(item.product_id) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCartCount();
  window.dispatchEvent(new Event('labrah:bolsa-actualizada'));
}

function renderCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach((node) => { node.textContent = String(count); });
  const amount = document.querySelector('[data-bag-number]');
  if (amount) amount.textContent = String(count).padStart(2, '0');
}

function setImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback-image]').forEach((image) => {
    if (image.dataset.fallbackReady) return;
    image.dataset.fallbackReady = 'true';
    image.addEventListener('error', () => {
      if (image.dataset.fallbackTried) return;
      image.dataset.fallbackTried = 'true';
      image.src = 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=75';
    });
  });
}

function productCard(product, index = 0) {
  const soldOut = Number(product.stock) < 1;
  return `<article class="product-card" style="--card-index:${index}">
    <a class="product-image-link" href="details.html?id=${product.id}" aria-label="Ver ${escapeHtml(product.title)}">
      <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.title)}" loading="lazy" data-fallback-image>
      <span class="product-badge">${soldOut ? 'AGOTADO' : `LANZAMIENTO 04 · ${String(product.id).padStart(2, '0')}`}</span>
      <span class="quick-view">${soldOut ? 'AGOTADO' : 'VER PRENDA ↗'}</span>
    </a>
    <div class="product-card-info"><div><p class="product-category">${escapeHtml(product.category)}</p><h3><a href="details.html?id=${product.id}">${escapeHtml(product.title)}</a></h3></div><strong>${formatMoney(product.price)}</strong></div>
    <button class="quick-add" type="button" data-add-product="${product.id}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'AGOTADO' : 'AÑADIR RÁPIDO +'}</button>
  </article>`;
}

function addProduct(productId, quantity = 1, size = 'M') {
  const product = products.find((item) => Number(item.id) === Number(productId));
  if (!product || Number(product.stock) < 1) return;
  const sameLine = cart.find((item) => item.product_id === Number(product.id) && item.size === size);
  if (sameLine) sameLine.quantity = Math.min(10, Number(product.stock), sameLine.quantity + quantity);
  else cart.push({ product_id: Number(product.id), title: product.title, category: product.category, price: Number(product.price), image_url: product.image_url, size, quantity: Math.min(10, Number(product.stock), quantity) });
  saveCart();
}

function bindAddButtons(root = document) {
  root.querySelectorAll('[data-add-product]').forEach((button) => button.addEventListener('click', () => {
    addProduct(Number(button.dataset.addProduct));
    button.textContent = 'AÑADIDO ✓';
    playCue('exito');
    window.setTimeout(() => { if (button.isConnected) button.textContent = 'AÑADIR RÁPIDO +'; }, 1300);
  }));
}

async function loadProducts() {
  try {
    products = await apiRequest('/api/products');
  } catch (error) {
    document.querySelectorAll('[data-featured-products], [data-catalog-grid]').forEach((grid) => {
      grid.innerHTML = `<p class="error-state">${escapeHtml(error.message)}<br>API configurada: ${escapeHtml(API_BASE_URL)}<br><button type="button" data-retry>REINTENTAR ↻</button></p>`;
      grid.querySelector('[data-retry]')?.addEventListener('click', async () => { await loadProducts(); renderProducts(); });
    });
  }
}

function renderProducts() {
  const featured = document.querySelector('[data-featured-products]');
  if (featured && products.length) {
    featured.innerHTML = products.slice(0, 4).map(productCard).join('');
    bindAddButtons(featured);
  }
  renderCatalog();
  renderDetails();
  setImageFallbacks();
}

function renderCatalog() {
  const grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;
  const filters = [...document.querySelectorAll('[data-filter]')];
  const search = document.querySelector('[data-product-search]');
  const sort = document.querySelector('[data-product-sort]');
  const emptyState = document.querySelector('[data-empty-state]');
  const requested = new URLSearchParams(location.search).get('category') || 'all';
  let active = filters.some((button) => button.dataset.filter === requested) ? requested : 'all';

  const paint = () => {
    const term = search?.value.trim().toLocaleLowerCase('es') || '';
    let visible = products.filter((product) => (active === 'all' || product.category === active) && `${product.title} ${product.category}`.toLocaleLowerCase('es').includes(term));
    if (sort?.value === 'price-asc') visible = [...visible].sort((a, b) => a.price - b.price);
    if (sort?.value === 'price-desc') visible = [...visible].sort((a, b) => b.price - a.price);
    grid.innerHTML = visible.map(productCard).join('');
    if (emptyState) emptyState.hidden = visible.length > 0;
    bindAddButtons(grid);
    setImageFallbacks(grid);
  };
  filters.forEach((button) => {
    const selected = button.dataset.filter === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', () => {
      active = button.dataset.filter;
      filters.forEach((filter) => {
        const isActive = filter === button;
        filter.classList.toggle('is-active', isActive);
        filter.setAttribute('aria-pressed', String(isActive));
      });
      paint();
    });
  });
  search?.addEventListener('input', paint);
  sort?.addEventListener('change', paint);
  paint();
}

const galleryById = {
  1: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=1100&q=85'],
  2: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1100&q=85'],
  3: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1475178626620-a4d074967452?auto=format&fit=crop&w=1100&q=85'],
  4: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1100&q=85'],
  5: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1548126032-079a0fb0099d?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1100&q=85'],
  6: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1100&q=85'],
  7: ['https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1475178626620-a4d074967452?auto=format&fit=crop&w=1100&q=85'],
  8: ['https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1100&q=85', 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=1100&q=85']
};

function renderDetails() {
  const root = document.querySelector('[data-product-details]');
  if (!root || !products.length) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const product = products.find((item) => Number(item.id) === id) || products[0];
  const images = galleryById[product.id] || [product.image_url, product.image_url, product.image_url];
  root.innerHTML = `<div class="product-gallery"><div class="gallery-main"><img src="${images[0]}" alt="${escapeHtml(product.title)}" data-main-image data-fallback-image><span class="gallery-count">01 / 03</span></div><div class="gallery-thumbnails">${images.map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'is-active' : ''}" type="button" data-gallery-image="${image}" aria-label="Ver imagen ${index + 1}" aria-pressed="${index === 0}"><img src="${image}" alt="${escapeHtml(product.title)}, vista ${index + 1}" data-fallback-image></button>`).join('')}</div></div><div class="detail-copy"><p class="kicker">${escapeHtml(product.category)} / LANZAMIENTO 04 DE LABRAH&</p><h1>${escapeHtml(product.title)}</h1><p class="detail-price">${formatMoney(product.price)}</p><p class="detail-description">Una prenda de tejido cuidado y corte cómodo, hecha para recorrer la ciudad y acompañarte temporada tras temporada.</p><p class="stock-status">${Number(product.stock) > 0 ? `QUEDAN ${product.stock} EN EL LANZAMIENTO` : 'AGOTADO'}</p><p class="size-label">ELIGE TU TALLA <span>GUÍA DE TALLAS ↗</span></p><div class="size-options" role="group" aria-label="Elige una talla">${['S','M','L','XL'].map((size, index) => `<button class="size-option ${index === 1 ? 'is-active' : ''}" type="button" data-size="${size}" aria-pressed="${index === 1}">${size}</button>`).join('')}</div><div class="detail-actions"><div class="quantity-control"><button type="button" data-quantity-step="-1" aria-label="Reducir cantidad">−</button><input type="number" min="1" max="10" value="1" data-product-quantity aria-label="Cantidad"><button type="button" data-quantity-step="1" aria-label="Aumentar cantidad">+</button></div><button class="button button-neon add-detail-button" type="button" data-add-detail ${Number(product.stock) < 1 ? 'disabled' : ''}>AÑADIR A LA BOLSA <span>${formatMoney(product.price)}</span></button></div><p class="detail-note">ENVÍO GRATIS A PARTIR DE 150 US$ · DEVOLUCIONES EN 30 DÍAS</p><details class="detail-accordion"><summary>DETALLES Y CUIDADOS <span>+</span></summary><p>Lavar del revés con agua fría y secar al aire para conservar la forma.</p></details></div>`;

  let selectedSize = 'M';
  let imageIndex = 0;
  const quantity = root.querySelector('[data-product-quantity]');
  const updateImage = (index) => {
    imageIndex = (index + images.length) % images.length;
    root.querySelector('[data-main-image]').src = images[imageIndex];
    root.querySelector('.gallery-count').textContent = `0${imageIndex + 1} / 0${images.length}`;
    root.querySelectorAll('[data-gallery-image]').forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === imageIndex);
      button.setAttribute('aria-pressed', String(buttonIndex === imageIndex));
    });
  };
  root.querySelectorAll('[data-gallery-image]').forEach((button, index) => button.addEventListener('click', () => updateImage(index)));
  root.querySelectorAll('[data-size]').forEach((button) => button.addEventListener('click', () => {
    selectedSize = button.dataset.size;
    root.querySelectorAll('[data-size]').forEach((option) => {
      const selected = option === button;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  }));
  root.querySelectorAll('[data-quantity-step]').forEach((button) => button.addEventListener('click', () => {
    quantity.value = String(Math.max(1, Math.min(10, Number(quantity.value) + Number(button.dataset.quantityStep))));
  }));
  let touchX = 0;
  root.querySelector('.gallery-main').addEventListener('touchstart', (event) => { touchX = event.changedTouches[0].clientX; }, { passive: true });
  root.querySelector('.gallery-main').addEventListener('touchend', (event) => {
    const delta = event.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 45) updateImage(imageIndex + (delta < 0 ? 1 : -1));
  }, { passive: true });
  root.querySelector('[data-add-detail]')?.addEventListener('click', (event) => {
    addProduct(product.id, Math.max(1, Math.min(10, Number(quantity.value) || 1)), selectedSize);
    event.currentTarget.textContent = 'AÑADIDO A LA BOLSA ✓';
    playCue('exito');
  });
  setImageFallbacks(root);
}

function cartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  return { subtotal, shipping, total: subtotal + shipping };
}

function renderCheckout() {
  const list = document.querySelector('[data-cart-items]');
  if (!list) return;
  const empty = document.querySelector('[data-cart-empty]');
  const content = document.querySelector('[data-checkout-content]');
  const panel = document.querySelector('[data-order-panel]');
  const paint = () => {
    const hasItems = cart.length > 0;
    const totals = cartSummary();
    empty.hidden = hasItems;
    content.hidden = !hasItems;
    panel.hidden = !hasItems;
    document.querySelector('[data-cart-line-count]').textContent = `(${cart.length})`;
    list.innerHTML = cart.map((item) => `<article class="cart-item"><a class="cart-item-image" href="details.html?id=${item.product_id}"><img src="${item.image_url}" alt="${escapeHtml(item.title)}" data-fallback-image></a><div class="cart-item-copy"><p class="product-category">${escapeHtml(item.category)} / TALLA ${item.size}</p><h2>${escapeHtml(item.title)}</h2><button class="remove-item" type="button" data-remove="${item.product_id}" data-size="${item.size}">QUITAR ×</button></div><div class="cart-item-actions"><strong>${formatMoney(item.price * item.quantity)}</strong><div class="quantity-control compact"><button type="button" data-step="-1" data-id="${item.product_id}" data-size="${item.size}" aria-label="Reducir cantidad">−</button><span>${item.quantity}</span><button type="button" data-step="1" data-id="${item.product_id}" data-size="${item.size}" aria-label="Aumentar cantidad">+</button></div></div></article>`).join('');
    document.querySelector('[data-subtotal]').textContent = formatMoney(totals.subtotal);
    document.querySelector('[data-shipping]').textContent = totals.shipping ? formatMoney(totals.shipping) : 'GRATIS';
    document.querySelector('[data-total]').textContent = formatMoney(totals.total);
    list.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
      const item = cart.find((entry) => entry.product_id === Number(button.dataset.id) && entry.size === button.dataset.size);
      if (!item) return;
      item.quantity += Number(button.dataset.step);
      if (item.quantity < 1) cart = cart.filter((entry) => entry !== item);
      saveCart();
      paint();
    }));
    list.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
      cart = cart.filter((entry) => !(entry.product_id === Number(button.dataset.remove) && entry.size === button.dataset.size));
      saveCart();
      paint();
    }));
    setImageFallbacks(list);
  };
  paint();
  window.addEventListener('labrah:bolsa-actualizada', paint);

  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;
  if (!user) {
    form.hidden = true;
    const gate = document.createElement('div');
    gate.className = 'checkout-signin';
    gate.innerHTML = '<p class="kicker">YA CASI ESTÁ</p><h3>UN ÚLTIMO<br>PASO.</h3><p>Inicia sesión o crea una cuenta para guardar tu pedido.</p><a class="button button-neon" href="login.html?next=checkout.html">INICIAR SESIÓN ↗</a><a class="create-account-link" href="register.html?next=checkout.html">¿NUEVO POR AQUÍ? CREA TU CUENTA</a>';
    form.before(gate);
    return;
  }

  if (user) {
    form.elements.name.value = user.full_name;
    form.elements.email.value = user.email;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('[data-order-message]');
    if (!form.reportValidity()) return;
    const cardNumber = form.elements.card_number.value.replace(/\D/g, '');
    const expiry = form.elements.expiry.value.replace(/\D/g, '');
    const month = Number(expiry.slice(0, 2));
    const year = Number(expiry.slice(2, 4));
    if (cardNumber.length < 12 || cardNumber.length > 19) {
      message.textContent = 'Escribe un número de tarjeta de prueba de 12 a 19 dígitos.';
      return;
    }
    if (expiry.length !== 4 || month < 1 || month > 12 || new Date(2000 + year, month, 1) <= new Date(new Date().getFullYear(), new Date().getMonth())) {
      message.textContent = 'Escribe una fecha de vencimiento futura.';
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message.textContent = 'PROCESANDO EL PAGO DE PRUEBA…';
    try {
      // Solo se envían los artículos y el domicilio: PAN/CVV nunca salen del navegador.
      const { order } = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
          payment_method: 'demo-card',
          shipping: {
            full_name: form.elements.name.value,
            email: form.elements.email.value,
            address: form.elements.address.value,
            city: form.elements.city.value,
            postal: form.elements.postal.value
          }
        })
      });
      cart = [];
      saveCart();
      form.reset();
      document.querySelector('[data-order-number]').textContent = `#${String(order.id).padStart(5, '0')}`;
      document.querySelector('[data-success-dialog]').showModal();
      playCue('compra');
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelector('[data-success-close]')?.addEventListener('click', () => {
    document.querySelector('[data-success-dialog]').close();
    location.assign('catalog.html');
  });
}

async function renderAdmin() {
  if (!document.querySelector('[data-metric-grid]')) return;
  const message = document.querySelector('[data-admin-message]');
  try {
    const data = await apiRequest('/api/admin/metrics');
    document.querySelector('[data-metric-users]').textContent = data.totals.total_users;
    document.querySelector('[data-metric-revenue]').textContent = formatMoney(data.totals.total_revenue);
    document.querySelector('[data-metric-orders]').textContent = data.totals.total_orders;
    document.querySelector('[data-metric-products]').textContent = data.totals.total_products;
    document.querySelector('[data-top-products]').innerHTML = data.top_products.map((product) => `<tr><td>${escapeHtml(product.title)}<small>${escapeHtml(product.category)}</small></td><td>${product.units_sold}</td><td>${formatMoney(product.revenue)}</td></tr>`).join('');
    document.querySelector('[data-recent-orders]').innerHTML = data.recent_orders.map((order) => `<tr><td>#${String(order.id).padStart(5, '0')}</td><td>${escapeHtml(order.full_name)}<small>${escapeHtml(order.email)}</small></td><td>${formatMoney(order.total_amount)}</td></tr>`).join('') || '<tr><td colspan="3">TODAVÍA NO HAY PEDIDOS.</td></tr>';
    document.querySelector('[data-user-list]').innerHTML = data.users.map((person) => `<tr><td>${escapeHtml(person.full_name)}</td><td>${escapeHtml(person.email)}</td><td>${person.role === 'admin' ? 'Administración' : 'Cliente'}</td></tr>`).join('');
  } catch (error) {
    message.textContent = error.message;
    if (error.message.includes('administración') || error.message.includes('Inicia sesión')) location.assign('login.html');
  }
}

function initNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.setAttribute('aria-label', open ? 'Abrir navegación' : 'Cerrar navegación');
    navigation.classList.toggle('is-open', !open);
  });
  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    navigation.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));

  document.querySelector('[data-newsletter-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('[data-newsletter-message]').textContent = '¡Gracias! Te avisaremos de las próximas novedades.';
    event.currentTarget.reset();
    playCue('exito');
  });
}

function initVideoDialog() {
  const dialog = document.querySelector('[data-video-dialog]');
  const frame = document.querySelector('[data-video-frame]');
  if (!dialog || !frame) return;
  document.querySelector('[data-open-video]')?.addEventListener('click', () => {
    frame.src = 'https://www.youtube-nocookie.com/embed/Cr8K88UcO0s?autoplay=1&rel=0';
    dialog.showModal();
  });
  const close = () => { dialog.close(); frame.src = ''; };
  document.querySelector('[data-close-video]')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => { frame.src = ''; });
}

async function init() {
  initAudio();
  initAuth();
  initNavigation();
  initVideoDialog();
  renderCartCount();
  user = await currentUser();
  if (user) {
    document.querySelectorAll('[data-account-link]').forEach((link) => {
      link.href = user.role === 'admin' ? 'admin.html' : 'catalog.html';
      link.textContent = user.role === 'admin' ? 'Administración' : user.full_name.split(' ')[0];
    });
    if (user.role === 'admin' && document.querySelector('[data-admin-name]')) document.querySelector('[data-admin-name]').textContent = `ADMINISTRACIÓN / ${user.full_name}`;
    document.querySelectorAll('[data-logout]').forEach((button) => { button.hidden = false; });
  }
  await loadProducts();
  renderProducts();
  renderCheckout();
  await renderAdmin();
  setImageFallbacks();
}

document.addEventListener('DOMContentLoaded', init);
