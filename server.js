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

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-mcpe-translator-2026';

const app = express();
const PORT = process.env.PORT || 8080;

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

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading users.json:', e);
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

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
 * Identify VIP tier and duration from VIP Key
 * Supports 5 Tiers:
 * VIP 1: 5 days
 * VIP 2: 15 days
 * VIP 3: 30 days (1 month)
 * VIP 4: 150 days (5 months)
 * VIP 5: 365 days (1 year)
 */
function getVipTierInfo(key, appConfig) {
  const normalized = String(key || '').trim().toUpperCase();
  if (!normalized) return null;

  const vipSystem = appConfig?.monetization?.vipSystem || {};
  const tiers = vipSystem.tiers || [];

  // 1. Check exact key match in tiers
  for (const tier of tiers) {
    const keys = (tier.keys || []).map(k => String(k).trim().toUpperCase());
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
  const generalKeys = (vipSystem.keys || []).map(k => (typeof k === 'string' ? k : k?.key || '').trim().toUpperCase());
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

function getGatePasscodes(appConfig) {
  return (appConfig?.monetization?.linkGate?.passcodes || [])
    .map(x => String(x).trim().toUpperCase())
    .filter(Boolean);
}

const gateTokens = new Map();

function createGateToken(userId, minutes) {
  const token = crypto.randomUUID();
  gateTokens.set(token, {
    userId,
    expiresAt: Date.now() + minutes * 60 * 1000
  });
  return token;
}

function hasValidGateToken(token, userId) {
  const item = gateTokens.get(token);
  if (!item) return false;
  if (item.userId !== userId || item.expiresAt <= Date.now()) {
    gateTokens.delete(token);
    return false;
  }
  return true;
}

function attachUser(req, res, next) {
  req.authUser = null;
  req.authUserRecord = null;

  const token = getTokenFromRequest(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = loadUsers();
    const user = users.find(u => u.id === payload.id);
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

setInterval(() => {
  const now = Date.now();
  for (const [token, item] of gateTokens.entries()) {
    if (item.expiresAt <= now) gateTokens.delete(token);
  }
}, 10 * 60 * 1000);


// ---------- Authentication API ----------
app.post('/api/auth/register', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '').trim();

  if (!email || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Email hợp lệ và mật khẩu tối thiểu 6 ký tự là bắt buộc.'
    });
  }

  const users = loadUsers();
  if (users.some(u => normalizeEmail(u.email) === email)) {
    return res.status(400).json({ success: false, message: 'Email đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.' });
  }

  const newUser = {
    id: crypto.randomUUID(),
    email,
    passwordHash: bcrypt.hashSync(password, 12),
    vipUntil: null,
    vipTier: null,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '365d' });
  setAuthCookie(res, token);
  res.json({ success: true, token, user: userPublic(newUser) });
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '').trim();
  const users = loadUsers();
  const user = users.find(u => normalizeEmail(u.email) === email);

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
app.post('/api/auth/reset-password', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const newPassword = String(req.body.newPassword || '').trim();

  if (!email || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Email hợp lệ và mật khẩu mới tối thiểu 6 ký tự là bắt buộc.'
    });
  }

  const users = loadUsers();
  const user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại chính xác email đã đăng ký.'
    });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 12);
  saveUsers(users);

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
  setAuthCookie(res, token);
  res.json({
    success: true,
    token,
    user: userPublic(user),
    message: 'Đặt lại mật khẩu thành công và đã đăng nhập tự động!'
  });
});

app.post('/api/auth/change-password', (req, res) => {
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

  const users = loadUsers();
  const user = users.find(u => u.id === req.authUserRecord.id);
  if (user) {
    user.passwordHash = bcrypt.hashSync(newPassword, 12);
    saveUsers(users);
  }

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

app.post('/api/monetization/verify-vip', (req, res) => {
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
  user.vipUntil = new Date(currentUntil + durationDays * 24 * 60 * 60 * 1000).toISOString();
  user.vipTier = tierInfo.name;

  const users = loadUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) users[index] = user;
  saveUsers(users);

  res.json({
    success: true,
    message: `Kích hoạt thành công gói ${tierInfo.name}! Đã cộng ${durationDays} ngày VIP vào tài khoản.`,
    user: userPublic(user)
  });
});

// Admin endpoint: upgrade by number of days or tier
app.post('/api/admin/upgrade-vip', (req, res) => {
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

  const users = loadUsers();
  const user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

  const currentUntil = Math.max(Date.now(), getVipUntil(user));
  user.vipUntil = new Date(currentUntil + days * 24 * 60 * 60 * 1000).toISOString();
  if (tierName) user.vipTier = tierName;
  saveUsers(users);

  res.json({ success: true, user: userPublic(user) });
});

// Link-gate config
app.get('/api/link-gate/config', (req, res) => {
  const gate = getAppConfig().monetization?.linkGate || {};
  res.json({
    enabled: !!gate.enabled,
    shortlinkUrl: gate.shortlinkUrl || '',
    passDurationMinutes: Number(gate.passDurationMinutes) || 60,
    note: gate.note || 'Hoàn thành bước vượt link rồi nhập mã mở khóa.'
  });
});

app.post('/api/link-gate/verify', (req, res) => {
  if (!req.authUserRecord) {
    return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập trước.' });
  }

  const appConfig = getAppConfig();
  const gate = appConfig.monetization?.linkGate || {};
  if (!gate.enabled) return res.json({ success: true, token: null, expiresAt: null });

  const passcode = String(req.body.passcode || '').trim().toUpperCase();
  if (!getGatePasscodes(appConfig).includes(passcode)) {
    return res.status(400).json({ success: false, message: 'Mã vượt link không đúng.' });
  }

  const minutes = Math.max(1, Number(gate.passDurationMinutes) || 60);
  const token = createGateToken(req.authUserRecord.id, minutes);

  res.json({
    success: true,
    token,
    expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString()
  });
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

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 MCPE Mod Auto-Translator Web App is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`⚡ Hot-Reload Config: Enabled (Changes in config.json apply instantly!)`);
  console.log(`=======================================================`);
});
