const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ArchiveService = require('./services/archiveService');
const TranslatorService = require('./services/translator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoDb = require('./services/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-mcpe-translator-2026';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 2208;

// Config Path & Dynamic Loader (Hot-Reloading without restarting)
const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  monetization: {
    enabled: true,
    donation: {
      enabled: true,
      bankCode: "BIDV",
      accountNumber: "8837590075",
      accountHolder: "BUI QUOC BAO",
      defaultAmount: 10000,
      momoPhone: "0978921749",
      message: "Ung ho MCPE Mod Translator"
    },
    vipSystem: {
      enabled: true,
      contactInfo: "Liên hệ Zalo/Facebook/Fanpage của bạn để nhận key VIP",
      defaultVipDays: 30,
      tiers: [
        { tier: 1, id: "vip1", name: "VIP 1 (5 Ngày)", days: 5, price: "10.000đ", keys: ["VIP1-MCPE", "VIP1-5DAYS", "VIP1-2026"] },
        { tier: 2, id: "vip2", name: "VIP 2 (15 Ngày)", days: 15, price: "25.000đ", keys: ["VIP2-MCPE", "VIP2-15DAYS", "VIP2-2026"] },
        { tier: 3, id: "vip3", name: "VIP 3 (1 Tháng)", days: 30, price: "45.000đ", keys: ["VIP-MCPE", "VIP-MCPE-PREMIUM", "VIP3-MCPE", "VIP3-1MONTH", "VIP3-2026"] },
        { tier: 4, id: "vip4", name: "VIP 4 (5 Tháng)", days: 150, price: "150.000đ", keys: ["VIP4-MCPE", "VIP4-5MONTHS", "PRO-MODDER-888", "VIP4-2026"] },
        { tier: 5, id: "vip5", name: "VIP 5 (1 Năm)", days: 365, price: "290.000đ", keys: ["VIP-PRO-MAX", "VIP5-MCPE", "VIP5-1YEAR", "VIP5-2026"] }
      ],
      keys: ["VIP-MCPE", "VIP-MCPE-PREMIUM", "VIP-PRO-MAX"]
    },
    downloadGate: {
      countdownSeconds: 5,
      adBannerHtml: ""
    },
    linkGate: {
      enabled: true,
      passcodes: [],
      passDurationMinutes: 60,
      shortlinkUrl: "",
      note: "Hoàn thành bước vượt link rồi nhập mã dùng một lần."
    }
  }
};

function getAppConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Warning: Could not parse config.json, using default config:', e.message);
    }
  }
  return DEFAULT_CONFIG;
}

// ---------- Authentication & Link Gate Utilities ----------
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

function loadUsersFromFile() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading users.json:', e);
    return [];
  }
}

function saveUsersToFile(users) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function findUserById(id) {
  if (mongoDb.isMongoConnected()) return mongoDb.findUserById(id);
  return loadUsersFromFile().find(u => u.id === id) || null;
}

async function findUserByEmail(email) {
  if (mongoDb.isMongoConnected()) return mongoDb.findUserByEmail(email);
  return loadUsersFromFile().find(u => normalizeEmail(u.email) === email) || null;
}

async function createUser(user) {
  if (mongoDb.isMongoConnected()) {
    try {
      await mongoDb.insertUser(user);
      return;
    } catch (error) {
      // MongoDB's unique email index is the final guard against simultaneous registrations.
      if (error.code === 11000) {
        const duplicate = new Error('Email đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.');
        duplicate.code = 'EMAIL_EXISTS';
        throw duplicate;
      }
      throw error;
    }
  }

  // Recheck immediately before writing so concurrent requests cannot create duplicate accounts.
  const users = loadUsersFromFile();
  if (users.some(existing => normalizeEmail(existing.email) === normalizeEmail(user.email))) {
    const duplicate = new Error('Email đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.');
    duplicate.code = 'EMAIL_EXISTS';
    throw duplicate;
  }
  users.push(user);
  saveUsersToFile(users);
}

async function patchUser(id, updates) {
  if (mongoDb.isMongoConnected()) { await mongoDb.updateUser(id, updates); return; }
  const users = loadUsersFromFile();
  const idx = users.findIndex(u => u.id === id);
  if (idx >= 0) { Object.assign(users[idx], updates); saveUsersToFile(users); }
}

// Giữ tên cũ để tương thích
async function loadUsers() {
  if (mongoDb.isMongoConnected()) return mongoDb.findAllUsers();
  return loadUsersFromFile();
}
function saveUsers() { /* no-op when using MongoDB */ }

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)mcpe_auth=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `mcpe_auth=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'mcpe_auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function getVipUntil(user) {
  const timestamp = user?.vipUntil ? new Date(user.vipUntil).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isUserVip(user) {
  return !!user && getVipUntil(user) > Date.now();
}

// ---------- Tài khoản admin DUY NHẤT của web ----------
// Cấu hình qua biến môi trường ADMIN_EMAIL + ADMIN_PASSWORD. Tài khoản này nằm riêng,
// không phải user đăng ký, và web không có tài khoản admin nào khác.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_ENABLED = !!ADMIN_EMAIL && ADMIN_PASSWORD.length >= 8;
// Khóa ký token admin phụ thuộc cả mật khẩu admin => không thể giả mạo nếu không biết mật khẩu
const ADMIN_JWT_SECRET = crypto.createHash('sha256').update(`${JWT_SECRET}:admin:${ADMIN_PASSWORD}`).digest('hex');
const adminLoginAttempts = new Map(); // ip -> { count, resetAt }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function getAdminFromRequest(req) {
  if (!ADMIN_ENABLED) return null;
  const token = req.headers['x-admin-session'];
  if (!token) return null;
  try {
    const p = jwt.verify(String(token), ADMIN_JWT_SECRET);
    return p && p.role === 'admin' && p.email === ADMIN_EMAIL ? p : null;
  } catch { return null; }
}

function userPublic(user) {
  return {
    id: user.id,
    email: user.email,
    isVip: isUserVip(user),
    vipUntil: isUserVip(user) ? user.vipUntil : null,
    vipTier: isUserVip(user) ? (user.vipTier || 'VIP') : null
  };
}

/**
 * Chuẩn hóa VIP Key người dùng nhập: bỏ ký tự ẩn, đổi các loại dấu gạch
 * (– — ‑ − ...) về "-", gộp khoảng trắng thành "-", viết hoa.
 */
function normalizeVipKey(key) {
  return String(key || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();
}

/**
 * Identify VIP tier and duration from VIP Key
 * Supports 5 Tiers:
 * VIP 1: 5 days
 * VIP 2: 15 days
 * VIP 3: 30 days (1 month)
 * VIP 4: 150 days (5 months)
 * VIP 5: 365 days (1 year)
 */
function getVipTierInfo(key, appConfig) {
  const normalized = normalizeVipKey(key);
  if (!normalized) return null;

  const vipSystem = appConfig?.monetization?.vipSystem || {};
  const tiers = vipSystem.tiers || [];

  // 1. Check exact key match in tiers
  for (const tier of tiers) {
    const keys = (tier.keys || []).map(k => normalizeVipKey(k));
    if (keys.includes(normalized)) {
      return {
        isValid: true,
        tier: tier.tier || 1,
        id: tier.id || `vip${tier.tier}`,
        name: tier.name || `VIP ${tier.tier}`,
        days: Number(tier.days) || 30
      };
    }
  }

  // 2. Check prefix (e.g. VIP1-..., VIP2-..., VIP3-..., VIP4-..., VIP5-...)
  const prefixMatch = normalized.match(/^VIP([1-5])[-_]/);
  if (prefixMatch) {
    const tierNum = parseInt(prefixMatch[1], 10);
    const targetTier = tiers.find(t => t.tier === tierNum);
    const defaultDaysMap = { 1: 5, 2: 15, 3: 30, 4: 150, 5: 365 };
    return {
      isValid: true,
      tier: tierNum,
      id: `vip${tierNum}`,
      name: targetTier?.name || `VIP ${tierNum} (${defaultDaysMap[tierNum]} Ngày)`,
      days: Number(targetTier?.days) || defaultDaysMap[tierNum]
    };
  }

  // 3. Fallback check general keys list
  const generalKeys = (vipSystem.keys || []).map(k => normalizeVipKey(typeof k === 'string' ? k : k?.key || ''));
  if (generalKeys.includes(normalized)) {
    return {
      isValid: true,
      tier: 3,
      id: 'vip3',
      name: 'VIP 3 (1 Tháng)',
      days: Number(vipSystem.defaultVipDays) || 30
    };
  }

  return null;
}

const LINK_GATE_CODES_FILE = path.join(__dirname, 'data', 'link-gate-codes.json');
const LINK_GATE_CODE_TTL_MINUTES = 30;
const LINK_GATE_ISSUE_COOLDOWN_SECONDS = 180;

function normalizeLinkGateCode(raw) {
  const value = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4)}` : '';
}

function hashLinkGateCode(raw) {
  return crypto.createHash('sha256').update(normalizeLinkGateCode(raw)).digest('hex');
}

function hashLinkGateIp(ip) {
  return crypto.createHash('sha256').update(`${JWT_SECRET}:link-gate:${ip}`).digest('hex');
}

function makeLinkGateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (const byte of bytes) raw += alphabet[byte % alphabet.length];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function requirePersistentLinkCodeStore() {
  if (process.env.NODE_ENV === 'production' && !mongoDb.isMongoConnected()) {
    const error = new Error('Cần kết nối MongoDB trên Render để tạo và kiểm tra mã vượt link.');
    error.statusCode = 503;
    throw error;
  }
}

function readLocalLinkGateCodes() {
  try {
    const data = JSON.parse(fs.readFileSync(LINK_GATE_CODES_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeLocalLinkGateCodes(records) {
  fs.mkdirSync(path.dirname(LINK_GATE_CODES_FILE), { recursive: true });
  const temp = `${LINK_GATE_CODES_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(records, null, 2));
  fs.renameSync(temp, LINK_GATE_CODES_FILE);
}

async function issueLinkGateCode(ipHash) {
  requirePersistentLinkCodeStore();
  const now = Date.now();
  let records;
  if (mongoDb.isMongoConnected()) {
    const active = await mongoDb.findActiveLinkGateCode(ipHash);
    if (active) return { ok: true, code: active.code, expiresAt: new Date(active.expiresAt).toISOString(), reused: true, ttlMinutes: LINK_GATE_CODE_TTL_MINUTES };
    const latest = await mongoDb.findLatestLinkGateCode(ipHash);
    records = latest ? [{ createdAt: latest.createdAt }] : [];
  } else {
    records = readLocalLinkGateCodes().filter(item => new Date(item.expiresAt).getTime() > now || item.usedAt);
    const active = records.find(item => item.ipHash === ipHash && !item.usedAt && new Date(item.expiresAt).getTime() > now);
    if (active) return { ok: true, code: active.code, expiresAt: active.expiresAt, reused: true, ttlMinutes: LINK_GATE_CODE_TTL_MINUTES };
    records = records.filter(item => item.ipHash === ipHash).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 1);
  }

  if (records[0]) {
    const elapsed = (now - new Date(records[0].createdAt).getTime()) / 1000;
    if (elapsed < LINK_GATE_ISSUE_COOLDOWN_SECONDS) {
      const retryAfterSeconds = Math.max(1, Math.ceil(LINK_GATE_ISSUE_COOLDOWN_SECONDS - elapsed));
      return { ok: false, error: 'cooldown', retryAfterSeconds, message: `Bạn vừa lấy mã. Đợi ${retryAfterSeconds} giây rồi thử lại.` };
    }
  }

  const code = makeLinkGateCode();
  const expiresAt = new Date(now + LINK_GATE_CODE_TTL_MINUTES * 60 * 1000);
  const record = { code, codeHash: hashLinkGateCode(code), ipHash, createdAt: new Date(now), expiresAt, usedAt: null };
  if (mongoDb.isMongoConnected()) await mongoDb.insertLinkGateCode(record);
  else {
    const all = readLocalLinkGateCodes().filter(item => new Date(item.expiresAt).getTime() > now || item.usedAt);
    all.push({ ...record, createdAt: record.createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
    writeLocalLinkGateCodes(all);
  }
  return { ok: true, code, expiresAt: expiresAt.toISOString(), reused: false, ttlMinutes: LINK_GATE_CODE_TTL_MINUTES };
}

async function consumeLinkGateCode(rawCode, userId) {
  requirePersistentLinkCodeStore();
  const normalized = normalizeLinkGateCode(rawCode);
  if (!normalized) return false;
  const codeHash = hashLinkGateCode(normalized);
  if (mongoDb.isMongoConnected()) return mongoDb.consumeLinkGateCode(codeHash, userId);
  const records = readLocalLinkGateCodes();
  const record = records.find(item => item.codeHash === codeHash && !item.usedAt && new Date(item.expiresAt).getTime() > Date.now());
  if (!record) return false;
  record.usedAt = new Date().toISOString();
  record.usedBy = userId;
  writeLocalLinkGateCodes(records);
  return true;
}

function createGateToken(userId, minutes) {
  return jwt.sign({ scope: 'link_gate', userId }, JWT_SECRET, { expiresIn: `${minutes}m` });
}

function hasValidGateToken(token, userId) {
  try {
    const payload = jwt.verify(String(token || ''), JWT_SECRET);
    return payload.scope === 'link_gate' && payload.userId === userId;
  } catch { return false; }
}

async function attachUser(req, res, next) {
  req.authUser = null;
  req.authUserRecord = null;

  const token = getTokenFromRequest(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.id);
    if (user) {
      req.authUser = payload;
      req.authUserRecord = user;
    }
  } catch {
    // Invalid/expired token
  }

  next();
}

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/video', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'video.html'));
});
app.use(attachUser);

// Configure Multer for in-memory file handling (up to 200MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }
});

const sessions = new Map();

// Periodic cleanup of sessions older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > 2 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ---------- Authentication API ----------
app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '').trim();

  if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
    return res.status(400).json({ success: false, message: 'Email này không thể đăng ký.' });
  }

  if (!email || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Email hợp lệ và mật khẩu tối thiểu 6 ký tự là bắt buộc.'
    });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.' });
    }

    const newUser = {
      id: crypto.randomUUID(),
      email,
      passwordHash: bcrypt.hashSync(password, 12),
      vipUntil: null,
      vipTier: null,
      createdAt: new Date().toISOString()
    };

    await createUser(newUser);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '365d' });
    setAuthCookie(res, token);
    return res.json({ success: true, token, user: userPublic(newUser) });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS' || error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.' });
    }
    console.error('Registration failed:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu tài khoản lúc này. Vui lòng thử lại.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '').trim();
  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Email này chưa được đăng ký trong hệ thống. Vui lòng kiểm tra lại chính tả hoặc chuyển sang tab Đăng ký.'
    });
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu không chính xác. Bạn có thể dùng tính năng Đặt lại mật khẩu nếu bị quên.'
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
  setAuthCookie(res, token);
  res.json({ success: true, token, user: userPublic(user) });
});

// Quick reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const newPassword = String(req.body.newPassword || '').trim();

  if (!email || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Email hợp lệ và mật khẩu mới tối thiểu 6 ký tự là bắt buộc.'
    });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại chính xác email đã đăng ký.'
    });
  }

  await patchUser(user.id, { passwordHash: bcrypt.hashSync(newPassword, 12) });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
  setAuthCookie(res, token);
  res.json({
    success: true,
    token,
    user: userPublic({ ...user, passwordHash: bcrypt.hashSync(newPassword, 12) }),
    message: 'Đặt lại mật khẩu thành công và đã đăng nhập tự động!'
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  if (!req.authUserRecord) {
    return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước.' });
  }

  const oldPassword = String(req.body.oldPassword || '').trim();
  const newPassword = String(req.body.newPassword || '').trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới tối thiểu 6 ký tự.' });
  }

  if (!bcrypt.compareSync(oldPassword, req.authUserRecord.passwordHash)) {
    return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
  }

  await patchUser(req.authUserRecord.id, { passwordHash: bcrypt.hashSync(newPassword, 12) });

  res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.authUserRecord) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  }
  res.json({ success: true, user: userPublic(req.authUserRecord) });
});

const SUPPORTED_LANGUAGES = [
  { code: 'vi_VN', name: 'Tiếng Việt (Việt Nam)', default: true },
  { code: 'zh_CN', name: 'Tiếng Trung Giản thể (中文 - 简体)' },
  { code: 'zh_TW', name: 'Tiếng Trung Phồn thể (繁體中文)' },
  { code: 'ja_JP', name: 'Tiếng Nhật (日本語)' },
  { code: 'ko_KR', name: 'Tiếng Hàn (한국어)' },
  { code: 'ru_RU', name: 'Tiếng Nga (Русский)' },
  { code: 'es_ES', name: 'Tiếng Tây Ban Nha (Español)' },
  { code: 'pt_BR', name: 'Tiếng Bồ Đào Nha (Português)' },
  { code: 'fr_FR', name: 'Tiếng Pháp (Français)' },
  { code: 'de_DE', name: 'Tiếng Đức (Deutsch)' },
  { code: 'th_TH', name: 'Tiếng Thái (ไทย)' },
  { code: 'id_ID', name: 'Tiếng Indonesia (Bahasa)' }
];

app.get('/api/languages', (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

/**
 * Monetization Endpoints (Always reads freshest config.json)
 */
app.get('/api/monetization/config', (req, res) => {
  const appConfig = getAppConfig();
  const mon = appConfig.monetization || {};
  const donation = mon.donation || {};
  const vipSystem = mon.vipSystem || {};

  let vietQrUrl = donation.customQrImage || null;
  if (!vietQrUrl && donation.bankCode && donation.accountNumber) {
    const amount = donation.defaultAmount || 10000;
    const desc = encodeURIComponent(donation.message || 'Ung ho Mod Translator');
    const name = encodeURIComponent(donation.accountHolder || '');
    vietQrUrl = `https://img.vietqr.io/image/${donation.bankCode}-${donation.accountNumber}-compact2.png?amount=${amount}&addInfo=${desc}&accountName=${name}`;
  }

  // Map 5 tiers for frontend display
  const tiers = (vipSystem.tiers || []).map(t => ({
    tier: t.tier,
    id: t.id,
    name: t.name,
    days: t.days,
    price: t.price
  }));

  res.json({
    enabled: !!mon.enabled,
    donation: {
      enabled: !!donation.enabled,
      bankCode: donation.bankCode,
      accountNumber: donation.accountNumber,
      accountHolder: donation.accountHolder,
      momoPhone: donation.momoPhone,
      vietQrUrl: vietQrUrl,
      defaultAmount: donation.defaultAmount || 10000
    },
    vipSystem: {
      enabled: !!vipSystem.enabled,
      contactInfo: vipSystem.contactInfo || 'Liên hệ quản trị viên để nhận key VIP',
      tiers: tiers
    },
    downloadGate: {
      countdownSeconds: mon.downloadGate?.countdownSeconds ?? 5,
      adBannerHtml: mon.downloadGate?.adBannerHtml || ''
    }
  });
});

app.post('/api/monetization/verify-vip', async (req, res) => {
  const user = req.authUserRecord;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước khi kích hoạt VIP.' });
  }

  const key = String(req.body.key || '').trim();
  const appConfig = getAppConfig();

  const tierInfo = getVipTierInfo(key, appConfig);
  if (!tierInfo) {
    return res.status(400).json({ success: false, message: 'VIP Key không hợp lệ hoặc đã hết hạn.' });
  }

  const durationDays = tierInfo.days;
  const currentUntil = Math.max(Date.now(), getVipUntil(user));
  const newVipUntil = new Date(currentUntil + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const newVipTier = tierInfo.name;

  await patchUser(user.id, { vipUntil: newVipUntil, vipTier: newVipTier });
  user.vipUntil = newVipUntil;
  user.vipTier = newVipTier;

  res.json({
    success: true,
    message: `Kích hoạt thành công gói ${tierInfo.name}! Đã cộng ${durationDays} ngày VIP vào tài khoản.`,
    user: userPublic(user)
  });
});

// ---------- Kho Mod (Mod Store) ----------
const MODS_FILE = path.join(__dirname, 'data', 'mods.json');
const MAX_MODS = 500;

function loadModsFromFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MODS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveModsToFile(mods) {
  fs.mkdirSync(path.dirname(MODS_FILE), { recursive: true });
  fs.writeFileSync(MODS_FILE, JSON.stringify(mods, null, 2));
}
async function listMods() {
  if (mongoDb.isMongoConnected()) return mongoDb.findAllMods();
  return loadModsFromFile().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Trang kho mod là index riêng (public/kho-mod.html)
app.get(['/kho-mod', '/kho-mod/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kho-mod.html'));
});

// Ai cũng xem được kho mod; chỉ admin web mới tạo/xóa vật phẩm
function requireAdmin(req, res, next) {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ success: false, message: 'Chỉ admin web mới có quyền thực hiện thao tác này.' });
  req.adminUser = admin;
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_ENABLED) {
    return res.status(503).json({ success: false, message: 'Chưa cấu hình tài khoản admin (cần ADMIN_EMAIL và ADMIN_PASSWORD ≥ 8 ký tự trên server).' });
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let rec = adminLoginAttempts.get(ip);
  if (!rec || rec.resetAt <= now) rec = { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (rec.count >= 8) {
    return res.status(429).json({ success: false, message: 'Thử sai quá nhiều lần. Vui lòng đợi 15 phút.' });
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const okEmail = safeEqual(email, ADMIN_EMAIL);
  const okPass = safeEqual(password, ADMIN_PASSWORD);
  if (!(okEmail && okPass)) {
    rec.count++; adminLoginAttempts.set(ip, rec);
    return res.status(401).json({ success: false, message: 'Sai email hoặc mật khẩu admin.' });
  }
  adminLoginAttempts.delete(ip);
  const token = jwt.sign({ role: 'admin', email: ADMIN_EMAIL }, ADMIN_JWT_SECRET, { expiresIn: '12h' });
  res.json({ success: true, token });
});

app.get('/api/mods', async (req, res) => {
  const mods = await listMods();
  res.json({
    success: true,
    canManage: !!getAdminFromRequest(req),
    mods: mods.map(m => ({ id: m.id, name: m.name, image: m.image, link: m.link, createdAt: m.createdAt }))
  });
});

app.post('/api/mods', requireAdmin, async (req, res) => {
  const user = { id: 'admin' };

  const name = String(req.body.name || '').trim().slice(0, 80);
  const link = String(req.body.link || '').trim();
  const image = String(req.body.image || '');

  if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên vật phẩm.' });
  let url;
  try { url = new URL(link); } catch { url = null; }
  if (!url || !/^https?:$/.test(url.protocol) || link.length > 500) {
    return res.status(400).json({ success: false, message: 'Đường link tải phải bắt đầu bằng http:// hoặc https://' });
  }
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 900 * 1024) {
    return res.status(400).json({ success: false, message: 'Ảnh vật phẩm không hợp lệ hoặc quá lớn.' });
  }

  const mods = await listMods();
  if (mods.length >= MAX_MODS) {
    return res.status(400).json({ success: false, message: `Kho mod tối đa ${MAX_MODS} vật phẩm.` });
  }

  const mod = {
    id: crypto.randomUUID(), name, image, link: url.href,
    ownerId: user.id, createdAt: new Date().toISOString()
  };
  if (mongoDb.isMongoConnected()) await mongoDb.insertMod(mod);
  else saveModsToFile([mod, ...loadModsFromFile()]);

  res.json({ success: true, mod: { id: mod.id, name, image, link: mod.link, createdAt: mod.createdAt } });
});

app.delete('/api/mods/:id', requireAdmin, async (req, res) => {
  let removed = 0;
  if (mongoDb.isMongoConnected()) {
    removed = await mongoDb.deleteMod(req.params.id);
  } else {
    const mods = loadModsFromFile();
    const rest = mods.filter(m => m.id !== req.params.id);
    removed = mods.length - rest.length;
    if (removed) saveModsToFile(rest);
  }
  if (!removed) return res.status(404).json({ success: false, message: 'Không tìm thấy vật phẩm.' });
  res.json({ success: true });
});

// Admin endpoint: upgrade by number of days or tier
app.post('/api/admin/upgrade-vip', async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.headers['x-admin-token'] !== adminToken) {
    return res.status(403).json({ success: false, message: 'Không có quyền.' });
  }

  const email = normalizeEmail(req.body.email);
  let days = Number(req.body.days);
  let tierName = null;

  if (req.body.tier) {
    const tierNum = Number(req.body.tier);
    const tierMap = {
      1: { days: 5, name: 'VIP 1 (5 Ngày)' },
      2: { days: 15, name: 'VIP 2 (15 Ngày)' },
      3: { days: 30, name: 'VIP 3 (1 Tháng)' },
      4: { days: 150, name: 'VIP 4 (5 Tháng)' },
      5: { days: 365, name: 'VIP 5 (1 Năm)' }
    };
    if (tierMap[tierNum]) {
      days = tierMap[tierNum].days;
      tierName = tierMap[tierNum].name;
    }
  }

  if (!email || !Number.isFinite(days) || days <= 0 || days > 3650) {
    return res.status(400).json({ success: false, message: 'Email hoặc số ngày VIP không hợp lệ.' });
  }

  const user = await findUserByEmail(email);
  if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

  const currentUntil = Math.max(Date.now(), getVipUntil(user));
  const newVipUntil = new Date(currentUntil + days * 24 * 60 * 60 * 1000).toISOString();
  const updates = { vipUntil: newVipUntil };
  if (tierName) updates.vipTier = tierName;

  await patchUser(user.id, updates);
  user.vipUntil = newVipUntil;
  if (tierName) user.vipTier = tierName;

  res.json({ success: true, user: userPublic(user) });
});

// Link-gate config
app.get('/api/link-gate/config', (req, res) => {
  const gate = getAppConfig().monetization?.linkGate || {};
  res.json({
    enabled: !!gate.enabled,
    shortlinkUrl: gate.shortlinkUrl || '',
    passDurationMinutes: Number(gate.passDurationMinutes) || 60,
    note: 'Vượt Link4M để lấy mã dùng một lần, rồi nhập mã tại đây.'
  });
});

app.get('/lay-ma', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lay-ma.html'));
});

app.post('/api/link-gate/claim', async (req, res) => {
  const gate = getAppConfig().monetization?.linkGate || {};
  if (!gate.enabled) return res.status(400).json({ ok: false, message: 'Tính năng lấy mã đang tắt.' });
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const result = await issueLinkGateCode(hashLinkGateIp(ip));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.ok ? 200 : 429).json(result);
  } catch (error) {
    console.error('Could not issue Link4M code:', error.message);
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message || 'Không tạo được mã vượt link.' });
  }
});

app.post('/api/link-gate/verify', async (req, res) => {
  if (!req.authUserRecord) {
    return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước.' });
  }
  const gate = getAppConfig().monetization?.linkGate || {};
  if (!gate.enabled || isUserVip(req.authUserRecord)) return res.json({ success: true, alreadyAllowed: true });
  const passcode = String(req.body.passcode || req.body.code || '');
  if (!normalizeLinkGateCode(passcode)) {
    return res.status(400).json({ success: false, message: 'Mã không đúng định dạng. Hãy nhập mã 8 ký tự trên trang lấy mã.' });
  }
  try {
    const consumed = await consumeLinkGateCode(passcode, req.authUserRecord.id);
    if (!consumed) return res.status(400).json({ success: false, message: 'Mã không tồn tại, đã dùng hoặc đã hết hạn. Hãy vượt link để lấy mã mới.' });
  } catch (error) {
    console.error('Could not consume Link4M code:', error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Không kiểm tra được mã vượt link.' });
  }
  const minutes = Math.max(1, Number(gate.passDurationMinutes) || 60);
  const token = createGateToken(req.authUserRecord.id, minutes);
  return res.json({ success: true, token, expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString() });
});
/**
 * Inspection Endpoint
 * Supports .mcpack, .mcaddon, .zip and binary ZIP detection (mobile uploads)
 */
app.post('/api/inspect', upload.single('modFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file mod (.mcpack, .mcaddon, .zip)!' });
    }

    const filename = req.file.originalname || 'mod_file.mcpack';
    const validExts = ['.mcpack', '.mcaddon', '.zip'];
    const hasValidExt = validExts.some(ext => filename.toLowerCase().endsWith(ext));
    
    // Check ZIP magic header (50 4B 03 04) to support mobile browsers where extension might be stripped
    const isZipBuffer = req.file.buffer && req.file.buffer.length >= 4 && req.file.buffer[0] === 0x50 && req.file.buffer[1] === 0x4B;

    if (!hasValidExt && !isZipBuffer) {
      return res.status(400).json({ error: 'Định dạng file không hỗ trợ! Chỉ chấp nhận .mcpack, .mcaddon hoặc .zip.' });
    }

    const inspection = await ArchiveService.inspectArchive(req.file.buffer, filename);

    if (inspection.packs.length === 0 || inspection.grandTotal === 0) {
      return res.status(400).json({
        error: 'Không tìm thấy chuỗi ngôn ngữ, menu hoặc giao diện nào trong mod này! Hãy chắc chắn file là mod MCPE hợp lệ.'
      });
    }

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      id: sessionId,
      userId: req.authUserRecord?.id || null,
      filename: filename,
      originalBuffer: req.file.buffer,
      inspection: inspection,
      targetLangCode: 'vi_VN',
      overwriteSource: true,
      includeScripts: true,
      includeUi: true,
      translated: false,
      createdAt: Date.now()
    });

    const clientPacks = inspection.packs.map(p => ({
      displayName: p.displayName,
      description: p.description,
      version: p.version,
      iconBase64: p.iconBase64,
      totalLangLines: p.langFiles.reduce((acc, f) => acc + f.translatableEntries.length, 0),
      totalScriptLines: p.scriptFiles.reduce((acc, f) => acc + f.translatableEntries.length, 0),
      totalUiLines: p.uiFiles.reduce((acc, f) => acc + f.translatableEntries.length, 0),
      totalManifestLines: (p.manifestEntries || []).length,
      langFilesCount: p.langFiles.length,
      scriptFilesCount: p.scriptFiles.length,
      uiFilesCount: p.uiFiles.length,
      manifestCount: (p.manifestEntries || []).length
    }));

    res.json({
      success: true,
      requiresLoginToTranslate: !req.authUserRecord,
      sessionId,
      filename,
      isAddon: inspection.isAddon,
      totalLines: inspection.totalLines,
      totalScriptLines: inspection.totalScriptLines,
      totalUiLines: inspection.totalUiLines,
      totalManifestLines: inspection.totalManifestLines,
      grandTotal: inspection.grandTotal,
      packs: clientPacks
    });
  } catch (err) {
    console.error('Inspect error:', err);
    res.status(500).json({ error: `Lỗi khi đọc file mod: ${err.message}` });
  }
});

/**
 * SSE Translation Stream Endpoint
 */
app.get('/api/translate-stream', async (req, res) => {
  const {
    sessionId,
    engine = 'google',
    apiKey = '',
    targetLang = 'vi_VN',
    overwriteSource = 'true',
    translateScripts = 'true',
    translateUi = 'true',
    gateToken = ''
  } = req.query;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).send('Session không tồn tại hoặc đã hết hạn.');
  }

  if (!req.authUserRecord) {
    return res.status(401).send('Bạn cần đăng nhập trước khi bắt đầu dịch.');
  }

  if (session.userId && session.userId !== req.authUserRecord.id) {
    return res.status(403).send('Bạn không có quyền truy cập phiên dịch này.');
  }

  if (!session.userId) session.userId = req.authUserRecord.id;

  const isVip = isUserVip(req.authUserRecord);
  const appConfig = getAppConfig();
  const gateEnabled = !!appConfig.monetization?.linkGate?.enabled;

  if (!isVip && gateEnabled && !hasValidGateToken(gateToken, req.authUserRecord.id)) {
    return res.status(403).send('Bạn cần hoàn thành bước vượt link trước khi bắt đầu dịch.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    session.targetLangCode = targetLang;
    session.overwriteSource = overwriteSource === 'true';
    session.includeScripts = translateScripts === 'true';
    session.includeUi = translateUi === 'true';

    const googleTarget = TranslatorService.mapLanguageCode(targetLang);

    let overallTotal = 0;
    session.inspection.packs.forEach(p => {
      p.langFiles.forEach(lf => overallTotal += lf.translatableEntries.length);
      if (session.includeScripts) {
        p.scriptFiles.forEach(sf => overallTotal += sf.translatableEntries.length);
      }
      if (session.includeUi) {
        p.uiFiles.forEach(uf => overallTotal += uf.translatableEntries.length);
      }
      if (p.manifestEntries) {
        overallTotal += p.manifestEntries.length;
      }
    });

    let processedLines = 0;
    sendEvent('start', { totalLines: overallTotal, engine, targetLang, isVip });

    async function translateEntryList(entries) {
      if (!entries || entries.length === 0) return [];
      
      if (engine === 'gemini') {
        return await TranslatorService.translateBatchWithGemini(
          entries,
          targetLang,
          apiKey,
          (batchDone) => {
            const currentOverall = processedLines + batchDone;
            sendEvent('progress', {
              current: Math.min(currentOverall, overallTotal),
              total: overallTotal,
              percent: Math.min(100, Math.round((currentOverall / overallTotal) * 100)),
              currentItem: entries[Math.min(batchDone - 1, entries.length - 1)]?.originalValue || ''
            });
          }
        );
      } else if (engine === 'openai') {
        return await TranslatorService.translateBatchWithOpenAI(
          entries,
          targetLang,
          apiKey,
          (batchDone) => {
            const currentOverall = processedLines + batchDone;
            sendEvent('progress', {
              current: Math.min(currentOverall, overallTotal),
              total: overallTotal,
              percent: Math.min(100, Math.round((currentOverall / overallTotal) * 100)),
              currentItem: entries[Math.min(batchDone - 1, entries.length - 1)]?.originalValue || ''
            });
          }
        );
      } else {
        const rawTexts = entries.map(e => e.originalValue);
        return await TranslatorService.translateBatchWithGoogle(
          rawTexts,
          googleTarget,
          (batchDone) => {
            const currentOverall = processedLines + batchDone;
            sendEvent('progress', {
              current: Math.min(currentOverall, overallTotal),
              total: overallTotal,
              percent: Math.min(100, Math.round((currentOverall / overallTotal) * 100)),
              currentItem: rawTexts[Math.min(batchDone - 1, rawTexts.length - 1)] || ''
            });
          }
        );
      }
    }

    // 1. Process Lang files
    for (let pIdx = 0; pIdx < session.inspection.packs.length; pIdx++) {
      const pack = session.inspection.packs[pIdx];

      for (let fIdx = 0; fIdx < pack.langFiles.length; fIdx++) {
        const langFile = pack.langFiles[fIdx];
        const entries = langFile.translatableEntries;
        if (entries.length === 0) continue;

        const transValues = await translateEntryList(entries);
        for (let i = 0; i < entries.length; i++) {
          const val = transValues[i] || entries[i].originalValue;
          entries[i].translatedValue = val;
          const master = langFile.allEntries.find(e => e.index === entries[i].index);
          if (master) master.translatedValue = val;
        }
        processedLines += entries.length;
      }

      // 2. Process JavaScript scripts (Forms, Chat messages, Dropdowns, Titles)
      if (session.includeScripts && pack.scriptFiles) {
        for (let sIdx = 0; sIdx < pack.scriptFiles.length; sIdx++) {
          const scriptFile = pack.scriptFiles[sIdx];
          const entries = scriptFile.translatableEntries;
          if (entries.length === 0) continue;

          const transValues = await translateEntryList(entries);
          for (let i = 0; i < entries.length; i++) {
            entries[i].translatedValue = transValues[i] || entries[i].originalValue;
          }
          processedLines += entries.length;
        }
      }

      // 3. Process UI JSON files
      if (session.includeUi && pack.uiFiles) {
        for (let uIdx = 0; uIdx < pack.uiFiles.length; uIdx++) {
          const uiFile = pack.uiFiles[uIdx];
          const entries = uiFile.translatableEntries;
          if (entries.length === 0) continue;

          const transValues = await translateEntryList(entries);
          for (let i = 0; i < entries.length; i++) {
            entries[i].translatedValue = transValues[i] || entries[i].originalValue;
          }
          processedLines += entries.length;
        }
      }

      // 4. Process Manifest.json strings (Subpacks menu cài ở ngoài map & metadata)
      if (pack.manifestEntries && pack.manifestEntries.length > 0) {
        const entries = pack.manifestEntries;
        const transValues = await translateEntryList(entries);
        for (let i = 0; i < entries.length; i++) {
          entries[i].translatedValue = transValues[i] || entries[i].originalValue;
        }
        processedLines += entries.length;
      }
    }

    session.translated = true;

    const reviewData = [];
    session.inspection.packs.forEach((pack, pIdx) => {
      // Manifest entries
      if (pack.manifestEntries && pack.manifestEntries.length > 0) {
        pack.manifestEntries.forEach((entry, mIdx) => {
          reviewData.push({
            type: 'manifest',
            pIdx,
            fIdx: 0,
            eIdx: mIdx,
            sourceType: 'manifest.json (Menu ngoài map)',
            key: entry.label || entry.key,
            original: entry.originalValue,
            translated: entry.translatedValue
          });
        });
      }

      // Lang entries
      pack.langFiles.forEach((f, fIdx) => {
        f.translatableEntries.forEach((entry, eIdx) => {
          reviewData.push({
            type: 'lang',
            pIdx,
            fIdx,
            eIdx,
            sourceType: 'texts/*.lang',
            key: entry.key,
            original: entry.originalValue,
            translated: entry.translatedValue
          });
        });
      });

      // Script entries
      if (session.includeScripts && pack.scriptFiles) {
        pack.scriptFiles.forEach((sf, sfIdx) => {
          sf.translatableEntries.forEach((entry, seIdx) => {
            reviewData.push({
              type: 'script',
              pIdx,
              fIdx: sfIdx,
              eIdx: seIdx,
              sourceType: `scripts/${sf.filename}`,
              key: entry.key,
              original: entry.originalValue,
              translated: entry.translatedValue
            });
          });
        });
      }

      // UI JSON entries
      if (session.includeUi && pack.uiFiles) {
        pack.uiFiles.forEach((uf, ufIdx) => {
          uf.translatableEntries.forEach((entry, ueIdx) => {
            reviewData.push({
              type: 'ui',
              pIdx,
              fIdx: ufIdx,
              eIdx: ueIdx,
              sourceType: `ui/${uf.filename}`,
              key: entry.key,
              original: entry.originalValue,
              translated: entry.translatedValue
            });
          });
        });
      }
    });

    sendEvent('complete', {
      success: true,
      totalTranslated: processedLines,
      reviewData: reviewData.slice(0, 800),
      totalEntries: reviewData.length,
      isVip
    });

    res.end();
  } catch (err) {
    console.error('Translation stream error:', err);
    sendEvent('error', { message: err.message || 'Lỗi trong quá trình dịch thuật.' });
    res.end();
  }
});

app.post('/api/update-entry', (req, res) => {
  const { sessionId, type = 'lang', pIdx, fIdx, eIdx, newValue } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session không tồn tại!' });
  }
  if (!req.authUserRecord || session.userId !== req.authUserRecord.id) {
    return res.status(403).json({ error: 'Bạn không có quyền sửa phiên này.' });
  }

  try {
    const pack = session.inspection.packs[pIdx];
    if (!pack) return res.status(400).json({ error: 'Không tìm thấy pack.' });

    if (type === 'lang') {
      const entry = pack.langFiles[fIdx]?.translatableEntries[eIdx];
      if (entry) {
        entry.translatedValue = newValue;
        const master = pack.langFiles[fIdx].allEntries.find(e => e.index === entry.index);
        if (master) master.translatedValue = newValue;
        return res.json({ success: true });
      }
    } else if (type === 'script') {
      const entry = pack.scriptFiles[fIdx]?.translatableEntries[eIdx];
      if (entry) {
        entry.translatedValue = newValue;
        return res.json({ success: true });
      }
    } else if (type === 'ui') {
      const entry = pack.uiFiles[fIdx]?.translatableEntries[eIdx];
      if (entry) {
        entry.translatedValue = newValue;
        return res.json({ success: true });
      }
    } else if (type === 'manifest') {
      const entry = pack.manifestEntries && pack.manifestEntries[eIdx];
      if (entry) {
        entry.translatedValue = newValue;
        return res.json({ success: true });
      }
    }

    res.status(400).json({ error: 'Không tìm thấy dòng tương ứng.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/download/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).send('Session đã hết hạn hoặc không tồn tại. Vui lòng tải lại trang.');
  }

  if (!req.authUserRecord || session.userId !== req.authUserRecord.id) {
    return res.status(403).send('Bạn không có quyền tải file của phiên này.');
  }

  try {
    const outputBuffer = await ArchiveService.repackArchive({
      originalBuffer: session.originalBuffer,
      filename: session.filename,
      translatedPacks: session.inspection.packs,
      targetLangCode: session.targetLangCode,
      overwriteSource: session.overwriteSource,
      includeScripts: session.includeScripts,
      includeUi: session.includeUi
    });

    const ext = path.extname(session.filename);
    const base = path.basename(session.filename, ext);
    const langPrefix = session.targetLangCode.split('_')[0].toUpperCase();
    const downloadName = `[${langPrefix}]_${base}${ext}`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.send(outputBuffer);
  } catch (err) {
    console.error('Repack error:', err);
    res.status(500).send(`Lỗi khi đóng gói file mod: ${err.message}`);
  }
});

// =========================================================================
// 8. MOBILE CONFIGURATION PROFILE (.mobileconfig) FOR IOS
// =========================================================================
app.get('/api/install/ios-profile', (req, res) => {
  try {
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const appUrl = `${protocol}://${host}/`;

    let iconBase64 = '';
    try {
      const iconPath = path.join(__dirname, 'public', 'icon-192.png');
      if (fs.existsSync(iconPath)) {
        iconBase64 = fs.readFileSync(iconPath).toString('base64');
      }
    } catch {}

    const profileXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            ${iconBase64 ? `<key>Icon</key><data>${iconBase64}</data>` : ''}
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>MCPE Dịch Mod</string>
            <key>PayloadDescription</key>
            <string>Ứng dụng Dịch Mod MCPE Tự Động (WebClip)</string>
            <key>PayloadDisplayName</key>
            <string>MCPE Dịch Mod</string>
            <key>PayloadIdentifier</key>
            <string>com.mcpe.translator.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webclip.managed</string>
            <key>PayloadUUID</key>
            <string>4f1a2384-934c-47bc-8ef2-5b92787e9142</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>${appUrl}</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Hồ sơ cài đặt ứng dụng MCPE Mod Translator VIP cho iPhone/iPad</string>
    <key>PayloadDisplayName</key>
    <string>MCPE Mod Translator VIP</string>
    <key>PayloadIdentifier</key>
    <string>com.mcpe.translator.profile</string>
    <key>PayloadOrganization</key>
    <string>MCPE Translator Team</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>7e2d9811-1a3b-48ce-9481-dfb56c41b803</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="MCPE-Translator.mobileconfig"');
    res.send(profileXml);
  } catch (err) {
    res.status(500).send(`Lỗi tạo hồ sơ iOS: ${err.message}`);
  }
});

async function startServer() {
  // Connect to MongoDB if MONGODB_URI is provided
  await mongoDb.connectMongo();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 MCPE Mod Auto-Translator Web App is running!`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`⚡ Hot-Reload Config: Enabled (Changes in config.json apply instantly!)`);
    console.log(`🗄️  Storage: ${mongoDb.isMongoConnected() ? 'MongoDB Atlas (Cloud Permanent)' : 'Local File (data/users.json)'}`);
    console.log(`=======================================================`);
  });
}

startServer();
