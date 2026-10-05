import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { database, initializeDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const scrypt = promisify(crypto.scrypt);
const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
const tokenLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const attempts = new Map();

if (!sessionSecret) throw new Error('En producción debes definir SESSION_SECRET.');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return scrypt(password, salt, 64).then((key) => `scrypt$${salt}$${key.toString('hex')}`);
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, keyHex] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function cleanText(value, maxLength = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function signToken(userId, role) {
  // Token HMAC compacto para despliegues entre dominios sin cookies de terceros.
  const payload = Buffer.from(JSON.stringify({ userId, role, expiresAt: Date.now() + tokenLifetimeMs })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || token.split('.').length !== 2) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return claims.expiresAt > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

function publicUser(user) {
  return {
    id: Number(user.id),
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    avatar_base64: user.avatar_base64,
    email_verified: Boolean(user.email_verified),
    created_at: user.created_at
  };
}

function authenticate(request, response, next) {
  const token = request.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = verifyToken(token);
  if (!claims) return response.status(401).json({ error: 'Inicia sesión para continuar.' });
  request.auth = claims;
  next();
}

function requireAdmin(request, response, next) {
  if (request.auth.role !== 'admin') return response.status(403).json({ error: 'Esta sección es solo para administración.' });
  next();
}

function rateLimit(request, response, next) {
  const now = Date.now();
  const key = `${request.ip}:${request.path}`;
  const record = attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 };
  if (record.expires <= now) {
    record.count = 0;
    record.expires = now + 15 * 60 * 1000;
  }
  record.count += 1;
  attempts.set(key, record);
  if (record.count > 12) return response.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
  next();
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'https://gabriellabradord-dot.github.io').split(',').map((origin) => origin.trim()).filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes('*') && process.env.NODE_ENV !== 'production';
app.use(cors({
  origin(origin, callback) {
    // Las llamadas de servidor a servidor no tienen Origin; * solo se acepta en desarrollo.
    if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado por la política CORS.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '1.5mb' }));

await initializeDatabase(hashPassword);

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: database.dialect }));

app.get('/api/products', async (_request, response, next) => {
  try {
    const products = await database.all('SELECT id, title, category, price, stock, image_url, video_embed_id, created_at FROM products ORDER BY id');
    response.json(products.map((product) => ({ ...product, id: Number(product.id), price: Number(product.price), stock: Number(product.stock) })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', rateLimit, async (request, response, next) => {
  try {
    const fullName = cleanText(request.body?.full_name, 80);
    const email = cleanText(request.body?.email, 254).toLowerCase();
    const password = String(request.body?.password || '');
    const avatar = request.body?.avatar_base64;
    if (fullName.length < 2) return response.status(400).json({ error: 'Escribe tu nombre completo.' });
    if (!emailPattern.test(email)) return response.status(400).json({ error: 'Introduce un correo electrónico válido.' });
    if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return response.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.' });
    }
    if (typeof avatar !== 'string' || avatar.length > 700_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatar)) {
      return response.status(400).json({ error: 'Toma una foto de perfil válida antes de crear la cuenta.' });
    }
    if (await database.get('SELECT id FROM users WHERE email = ?', [email])) {
      return response.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const result = await database.insert('INSERT INTO users (full_name, email, password_hash, role, avatar_base64, email_verified) VALUES (?, ?, ?, ?, ?, ?)', [fullName, email, await hashPassword(password), 'customer', avatar, false]);
    const user = await database.get('SELECT id, full_name, email, role, avatar_base64, email_verified, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    response.status(201).json({ user: publicUser(user), token: signToken(user.id, user.role) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') return response.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    next(error);
  }
});

app.post('/api/auth/login', rateLimit, async (request, response, next) => {
  try {
    const email = cleanText(request.body?.email, 254).toLowerCase();
    const password = String(request.body?.password || '');
    const user = await database.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return response.status(401).json({ error: 'El correo o la contraseña no coinciden.' });
    }
    response.json({ user: publicUser(user), token: signToken(user.id, user.role) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, async (request, response, next) => {
  try {
    const user = await database.get('SELECT id, full_name, email, role, avatar_base64, email_verified, created_at FROM users WHERE id = ?', [request.auth.userId]);
    if (!user) return response.status(401).json({ error: 'La sesión ya no es válida.' });
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', authenticate, async (request, response, next) => {
  const rawItems = request.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) return response.status(400).json({ error: 'La bolsa está vacía o tiene demasiadas prendas.' });
  if (request.body?.payment_method !== 'demo-card') return response.status(400).json({ error: 'Selecciona el pago de demostración.' });

  const shipping = request.body?.shipping || {};
  const address = {
    name: cleanText(shipping.full_name, 80),
    email: cleanText(shipping.email, 254).toLowerCase(),
    address: cleanText(shipping.address, 180),
    city: cleanText(shipping.city, 80),
    postal: cleanText(shipping.postal, 24)
  };
  if (address.name.length < 2 || !emailPattern.test(address.email) || address.address.length < 5 || address.city.length < 2 || address.postal.length < 3) {
    return response.status(400).json({ error: 'Completa correctamente los datos de envío.' });
  }

  const quantities = new Map();
  for (const item of rawItems) {
    const id = Number(item?.product_id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return response.status(400).json({ error: 'Hay una prenda o cantidad no válida en la bolsa.' });
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  try {
    const order = await database.transaction(async (tx) => {
      const selected = [];
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        // El bloqueo de fila evita vender más unidades de las disponibles en PostgreSQL.
        const lock = database.dialect === 'postgres' ? ' FOR UPDATE' : '';
        const product = await tx.get(`SELECT id, title, price, stock FROM products WHERE id = ?${lock}`, [productId]);
        if (!product) throw Object.assign(new Error('Una prenda de la bolsa ya no existe.'), { status: 404 });
        if (Number(product.stock) < quantity) throw Object.assign(new Error(`No quedan suficientes unidades de ${product.title}.`), { status: 409 });
        selected.push({ ...product, quantity, price: Number(product.price) });
        subtotal += Number(product.price) * quantity;
      }

      const shippingCost = subtotal >= 150 ? 0 : 12;
      const total = Number((subtotal + shippingCost).toFixed(2));
      const inserted = await tx.insert(`INSERT INTO orders (user_id, total_amount, payment_status, payment_method, shipping_name, shipping_email, shipping_address, shipping_city, shipping_postal) VALUES (?, ?, 'paid', ?, ?, ?, ?, ?, ?)`, [request.auth.userId, total, 'demo-card', address.name, address.email, address.address, address.city, address.postal]);
      const insertItem = 'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)';
      for (const product of selected) {
        await tx.run(insertItem, [inserted.lastInsertRowid, product.id, product.quantity, product.price]);
        const stockUpdate = await tx.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [product.quantity, product.id, product.quantity]);
        if (stockUpdate.changes !== 1) throw Object.assign(new Error(`No quedan suficientes unidades de ${product.title}.`), { status: 409 });
      }
      return { id: inserted.lastInsertRowid, subtotal, shipping: shippingCost, total_amount: total, payment_status: 'paid' };
    });
    response.status(201).json({ order });
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.get('/api/admin/metrics', authenticate, requireAdmin, async (_request, response, next) => {
  try {
    const totals = await database.get(`SELECT (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS total_orders,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue,
      (SELECT COUNT(*) FROM products) AS total_products`);
    const users = await database.all('SELECT id, full_name, email, role, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 100');
    const topProducts = await database.all(`SELECT p.id, p.title, p.category,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) AS units_sold,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity * oi.unit_price ELSE 0 END), 0) AS revenue
      FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id GROUP BY p.id ORDER BY units_sold DESC, p.title LIMIT 6`);
    const recentOrders = await database.all(`SELECT o.id, o.total_amount, o.payment_status, o.created_at,
      o.shipping_name AS full_name, o.shipping_email AS email, COALESCE(SUM(oi.quantity), 0) AS item_count
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC LIMIT 12`);
    response.json({
      totals: { total_users: Number(totals.total_users), total_orders: Number(totals.total_orders), total_revenue: Number(totals.total_revenue), total_products: Number(totals.total_products) },
      users: users.map((user) => ({ ...user, id: Number(user.id), email_verified: Boolean(user.email_verified) })),
      top_products: topProducts.map((product) => ({ ...product, id: Number(product.id), units_sold: Number(product.units_sold), revenue: Number(product.revenue) })),
      recent_orders: recentOrders.map((order) => ({ ...order, id: Number(order.id), total_amount: Number(order.total_amount), item_count: Number(order.item_count) }))
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_request, response) => response.status(404).json({ error: 'No se encontró esa ruta de la API.' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (response.headersSent) return;
  if (error.message?.includes('CORS')) return response.status(403).json({ error: error.message });
  response.status(error.status || (error.type === 'entity.too.large' ? 413 : 500)).json({
    error: error.type === 'entity.too.large' ? 'La solicitud supera el tamaño permitido.' : 'Ocurrió un error en el servidor. Inténtalo de nuevo.'
  });
});

const server = app.listen(port, () => {
  console.log(`API LABRAH& activa en el puerto ${port} con ${database.dialect}.`);
});

async function shutdown() {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
