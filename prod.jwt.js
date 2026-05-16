require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const {
  PORT = 3000,
  NODE_ENV = 'development',
  JWT_ACCESS_PRIVATE_KEY_PATH,
  JWT_ACCESS_PUBLIC_KEY_PATH,
  JWT_REFRESH_PRIVATE_KEY_PATH,
  JWT_REFRESH_PUBLIC_KEY_PATH,
  JWT_ALGORITHM = 'RS256',
  JWT_ISSUER = 'jwt-demo',
  JWT_AUDIENCE = 'jwt-demo-clients',
  ACCESS_TOKEN_TTL = '15m',
  REFRESH_TOKEN_TTL = '7d',
  BCRYPT_ROUNDS = '12',
  ADMIN_USERNAMES = '',
} = process.env;

const ROLES = Object.freeze({ ADMIN: 'admin', USER: 'user' });
const adminUsernames = new Set(
  ADMIN_USERNAMES.split(',').map(s => s.trim()).filter(Boolean)
);

const ALLOWED_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512'];
if (!ALLOWED_ALGORITHMS.includes(JWT_ALGORITHM)) {
  console.error(`FATAL: JWT_ALGORITHM must be one of ${ALLOWED_ALGORITHMS.join(', ')}`);
  process.exit(1);
}

const requiredKeyVars = {
  JWT_ACCESS_PRIVATE_KEY_PATH,
  JWT_ACCESS_PUBLIC_KEY_PATH,
  JWT_REFRESH_PRIVATE_KEY_PATH,
  JWT_REFRESH_PUBLIC_KEY_PATH,
};
for (const [name, value] of Object.entries(requiredKeyVars)) {
  if (!value) {
    console.error(`FATAL: ${name} must be set`);
    process.exit(1);
  }
}

function loadKey(label, keyPath) {
  try {
    return fs.readFileSync(path.resolve(keyPath), 'utf8');
  } catch (err) {
    console.error(`FATAL: failed to read ${label} from ${keyPath}: ${err.message}`);
    process.exit(1);
  }
}

const accessPrivateKey = loadKey('JWT_ACCESS_PRIVATE_KEY_PATH', JWT_ACCESS_PRIVATE_KEY_PATH);
const accessPublicKey = loadKey('JWT_ACCESS_PUBLIC_KEY_PATH', JWT_ACCESS_PUBLIC_KEY_PATH);
const refreshPrivateKey = loadKey('JWT_REFRESH_PRIVATE_KEY_PATH', JWT_REFRESH_PRIVATE_KEY_PATH);
const refreshPublicKey = loadKey('JWT_REFRESH_PUBLIC_KEY_PATH', JWT_REFRESH_PUBLIC_KEY_PATH);

if (accessPrivateKey === refreshPrivateKey) {
  console.error('FATAL: access and refresh private keys must differ');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// In-memory stores. In production swap these for Postgres/Redis.
// users:        username -> { id, username, passwordHash }
// refreshStore: jti      -> { userId, tokenHash, expiresAt, revoked }
const users = new Map();
const refreshStore = new Map();

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'validation_error', details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    accessPrivateKey,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: JWT_ALGORITHM,
    }
  );
}

function signRefreshToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id },
    refreshPrivateKey,
    {
      expiresIn: REFRESH_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: JWT_ALGORITHM,
      jwtid: jti,
    }
  );
  const decoded = jwt.decode(token);
  refreshStore.set(jti, {
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: decoded.exp * 1000,
    revoked: false,
  });
  return token;
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessPublicKey, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: [JWT_ALGORITHM],
  });
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, refreshPublicKey, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: [JWT_ALGORITHM],
  });
  const record = refreshStore.get(payload.jti);
  if (!record) throw new Error('refresh_not_recognized');
  if (record.revoked) throw new Error('refresh_revoked');
  if (record.tokenHash !== sha256(token)) throw new Error('refresh_hash_mismatch');
  return { payload, record };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', reason: err.name });
  }
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/register', authLimiter, validate(credentialsSchema), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (users.has(username)) {
    return res.status(409).json({ error: 'user_exists' });
  }
  const passwordHash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS, 10));
  const role = adminUsernames.has(username) ? ROLES.ADMIN : ROLES.USER;
  const user = { id: crypto.randomUUID(), username, passwordHash, role };
  users.set(username, user);
  res.status(201).json({ id: user.id, username: user.username, role: user.role });
}));

app.post('/login', authLimiter, validate(credentialsSchema), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);

  // Constant-time-ish: always run bcrypt to mitigate user-enumeration timing.
  const dummyHash = '$2b$12$abcdefghijklmnopqrstuv.dummyhashforTimingMitigation....';
  const ok = await bcrypt.compare(password, user ? user.passwordHash : dummyHash);

  if (!user || !ok) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  res.json({
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    tokenType: 'Bearer',
  });
}));

app.post('/refresh', validate(refreshSchema), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  let payload, record;
  try {
    ({ payload, record } = verifyRefreshToken(refreshToken));
  } catch (err) {
    return res.status(401).json({ error: 'invalid_refresh_token' });
  }

  // Rotation: revoke old jti, issue a new pair.
  refreshStore.set(payload.jti, { ...record, revoked: true });

  const user = [...users.values()].find(u => u.id === payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'user_not_found' });
  }

  res.json({
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    tokenType: 'Bearer',
  });
}));

app.post('/logout', validate(refreshSchema), asyncHandler(async (req, res) => {
  try {
    const decoded = jwt.verify(req.body.refreshToken, refreshPublicKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALGORITHM],
    });
    const record = refreshStore.get(decoded.jti);
    if (record) refreshStore.set(decoded.jti, { ...record, revoked: true });
  } catch {
    // Swallow — logout is idempotent.
  }
  res.status(204).end();
}));

app.get('/profile', authMiddleware, (req, res) => {
  res.json({ sub: req.user.sub, username: req.user.username, role: req.user.role });
});

//2
app.get('/admin/users', authMiddleware, requireRole(ROLES.ADMIN), (req, res) => {
  res.json(
    [...users.values()].map(u => ({ id: u.id, username: u.username, role: u.role }))
  );
});

//1
app.patch('/admin/users/:username/role', authMiddleware, requireRole(ROLES.ADMIN), (req, res) => {
  const { role } = req.body || {};
  if (![ROLES.ADMIN, ROLES.USER].includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  const target = users.get(req.params.username);
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  target.role = role;
  res.json({ id: target.id, username: target.username, role: target.role });
});

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error' });
});

// Janitor: drop expired refresh records every 10 minutes.
const janitor = setInterval(() => {
  const now = Date.now();
  for (const [jti, record] of refreshStore) {
    if (record.expiresAt < now) refreshStore.delete(jti);
  }
}, 10 * 60 * 1000);
janitor.unref();

const server = app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] JWT prod server on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  clearInterval(janitor);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
