// Frontend logic for MCPE Mod Auto-Translator with Monetization & Interactive Waiting Hub
// Includes: Minecraft Block Clicker, Live Stream Terminal, Trivia Quizzes, 8-Bit Chill Music Synthesizer

let currentSessionId = null;
let currentInspectionData = null;
let reviewDataCache = [];
let eventSource = null;
let monetizationConfig = null;
let isVipActive = false;
let currentUser = null;
let linkGateConfig = null;
let linkGateToken = '';
let pendingStartAfterAuth = false;
let vipRefreshTimer = null;

// Helper: Make authenticated fetch requests using localStorage token
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('mcpe_auth_token');
  const headers = Object.assign({}, options.headers || {});
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  options.headers = headers;
  return fetch(url, options);
}

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadLoader = document.getElementById('uploadLoader');

const uploadSection = document.getElementById('uploadSection');
const configSection = document.getElementById('configSection');
const progressSection = document.getElementById('progressSection');
const resultSection = document.getElementById('resultSection');

// Config Elements
const packIconPreview = document.getElementById('packIconPreview');
const packName = document.getElementById('packName');
const packVersion = document.getElementById('packVersion');
const packTypeBadge = document.getElementById('packTypeBadge');
const packDesc = document.getElementById('packDesc');
const packFileCount = document.getElementById('packFileCount');
const packLangLines = document.getElementById('packLangLines');
const packScriptLines = document.getElementById('packScriptLines');
const packManifestLines = document.getElementById('packManifestLines');
const packUiLines = document.getElementById('packUiLines');

const btnChangeFile = document.getElementById('btnChangeFile');
const targetLanguageSelect = document.getElementById('targetLanguageSelect');
const engineRadios = document.querySelectorAll('input[name="engine"]');
const apiKeyContainer = document.getElementById('apiKeyContainer');
const geminiApiKey = document.getElementById('geminiApiKey');

const translateScripts = document.getElementById('translateScripts');
const translateUi = document.getElementById('translateUi');
const overwriteEnUs = document.getElementById('overwriteEnUs');
const btnStartTranslate = document.getElementById('btnStartTranslate');

// Progress Elements
const currentEngineLabel = document.getElementById('currentEngineLabel');
const vipActiveBadge = document.getElementById('vipActiveBadge');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const progressCounts = document.getElementById('progressCounts');
const progressCurrentItem = document.getElementById('progressCurrentItem');

// Waiting Hub Elements (Tabs, Music, Clicker, Lucky Crate, 2048, Terminal, Quiz)
const btnToggleBgm = document.getElementById('btnToggleBgm');
const bgmLabel = document.getElementById('bgmLabel');
const btnViewVipBenefits = document.getElementById('btnViewVipBenefits');

// Clicker Elements
const clickerCurrentBlockName = document.getElementById('clickerCurrentBlockName');
const mcCube = document.getElementById('mcCube');
const mcCubeIcon = document.getElementById('mcCubeIcon');
const mcCubeCrack = document.getElementById('mcCubeCrack');
const clickerDurabilityBar = document.getElementById('clickerDurabilityBar');
const clickerDurabilityText = document.getElementById('clickerDurabilityText');
const clickerParticleContainer = document.getElementById('clickerParticleContainer');
const clickerMinedCount = document.getElementById('clickerMinedCount');
const clickerDiamondCount = document.getElementById('clickerDiamondCount');
const clickerExpCount = document.getElementById('clickerExpCount');
const btnUpgradePickaxe = document.getElementById('btnUpgradePickaxe');
const upgradePickaxeText = document.getElementById('upgradePickaxeText');
const clickerFreeLimitNotice = document.getElementById('clickerFreeLimitNotice');
const btnUnlockVipClicker = document.getElementById('btnUnlockVipClicker');

// Lucky Crate Elements
const crateVipLockOverlay = document.getElementById('crateVipLockOverlay');
const btnUnlockVipCrate = document.getElementById('btnUnlockVipCrate');
const chestVisual = document.getElementById('chestVisual');
const lootResultBox = document.getElementById('lootResultBox');
const lootResultIcon = document.getElementById('lootResultIcon');
const lootResultName = document.getElementById('lootResultName');
const lootResultDesc = document.getElementById('lootResultDesc');
const btnOpenCrate = document.getElementById('btnOpenCrate');
const crateLootCount = document.getElementById('crateLootCount');
const crateInventoryGrid = document.getElementById('crateInventoryGrid');

// Minecraft 2048 Elements
const game2048VipLockOverlay = document.getElementById('game2048VipLockOverlay');
const btnUnlockVip2048 = document.getElementById('btnUnlockVip2048');
const score2048 = document.getElementById('score2048');
const btnRestart2048 = document.getElementById('btnRestart2048');
const board2048 = document.getElementById('board2048');
const btn2048Up = document.getElementById('btn2048Up');
const btn2048Down = document.getElementById('btn2048Down');
const btn2048Left = document.getElementById('btn2048Left');
const btn2048Right = document.getElementById('btn2048Right');

// Terminal Log
const terminalStreamBox = document.getElementById('terminalStreamBox');

// Quiz Elements
const quizScoreCounter = document.getElementById('quizScoreCounter');
const quizFreeLimitNotice = document.getElementById('quizFreeLimitNotice');
const btnUnlockVipQuiz = document.getElementById('btnUnlockVipQuiz');
const quizActiveContainer = document.getElementById('quizActiveContainer');
const quizQuestion = document.getElementById('quizQuestion');
const quizOptionsGrid = document.getElementById('quizOptionsGrid');
const quizFeedback = document.getElementById('quizFeedback');
const btnNextQuiz = document.getElementById('btnNextQuiz');

// Result Elements
const resTotalLines = document.getElementById('resTotalLines');
const btnDownload = document.getElementById('btnDownload');
const btnNewFile = document.getElementById('btnNewFile');
const reviewTableBody = document.getElementById('reviewTableBody');
const searchInput = document.getElementById('searchInput');

// Monetization Elements
const btnOpenVipModal = document.getElementById('btnOpenVipModal');
const btnOpenAuthModal = document.getElementById('btnOpenAuthModal');
const authNavLabel = document.getElementById('authNavLabel');
const accountStatusCard = document.getElementById('accountStatusCard');
const accountStatusIcon = document.getElementById('accountStatusIcon');
const accountStatusTitle = document.getElementById('accountStatusTitle');
const accountStatusBadge = document.getElementById('accountStatusBadge');
const accountStatusText = document.getElementById('accountStatusText');
const btnStatusAction = document.getElementById('btnStatusAction');
const translationAccessNotice = document.getElementById('translationAccessNotice');
const translationAccessIcon = document.getElementById('translationAccessIcon');
const translationAccessTitle = document.getElementById('translationAccessTitle');
const translationAccessText = document.getElementById('translationAccessText');

// Auth Modals & Forms
const authModal = document.getElementById('authModal');
const authModalTitle = document.getElementById('authModalTitle');
const authModalHint = document.getElementById('authModalHint');
const btnAuthLoginTab = document.getElementById('btnAuthLoginTab');
const btnAuthRegisterTab = document.getElementById('btnAuthRegisterTab');
const btnAuthResetTab = document.getElementById('btnAuthResetTab');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const btnToggleAuthPassword = document.getElementById('btnToggleAuthPassword');

const resetForm = document.getElementById('resetForm');
const resetEmail = document.getElementById('resetEmail');
const resetNewPassword = document.getElementById('resetNewPassword');
const btnResetSubmit = document.getElementById('btnResetSubmit');
const btnToggleResetPassword = document.getElementById('btnToggleResetPassword');

const accountInfo = document.getElementById('accountInfo');
const accountEmail = document.getElementById('accountEmail');
const accountVipStatus = document.getElementById('accountVipStatus');
const changePasswordForm = document.getElementById('changePasswordForm');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const btnLogout = document.getElementById('btnLogout');

// VIP Modal
const vipNavLabel = document.getElementById('vipNavLabel');
const vipModal = document.getElementById('vipModal');
const vipKeyInput = document.getElementById('vipKeyInput');
const btnVerifyVip = document.getElementById('btnVerifyVip');
const vipContactInfo = document.getElementById('vipContactInfo');

// Link Gate Modal
const linkGateModal = document.getElementById('linkGateModal');
const btnOpenShortlink = document.getElementById('btnOpenShortlink');
const linkGateNote = document.getElementById('linkGateNote');
const linkGatePasscode = document.getElementById('linkGatePasscode');
const btnVerifyLinkGate = document.getElementById('btnVerifyLinkGate');

// Donate Modal
const btnOpenDonateModal = document.getElementById('btnOpenDonateModal');
const btnTipFromSuccess = document.getElementById('btnTipFromSuccess');
const donateModal = document.getElementById('donateModal');
const vietQrImg = document.getElementById('vietQrImg');
const bankNameDisplay = document.getElementById('bankNameDisplay');
const bankAccDisplay = document.getElementById('bankAccDisplay');
const bankHolderDisplay = document.getElementById('bankHolderDisplay');
const momoDisplay = document.getElementById('momoDisplay');
const btnCopyAcc = document.getElementById('btnCopyAcc');


const adBannerContainer = document.getElementById('adBannerContainer');
const countdownBox = document.getElementById('countdownBox');
const countdownTimer = document.getElementById('countdownTimer');

const DEFAULT_PACK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Crect width='64' height='64' rx='12' fill='%231e293b'/%3E%3Cpath d='M32 10L50 20V44L32 54L14 44V20L32 10Z' fill='%2310b981' fill-opacity='0.2' stroke='%2310b981' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M32 32L50 20M32 32L14 20M32 32V54' stroke='%2310b981' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

// =========================================================================
// 1. WEB AUDIO SYNTHESIZER (SOUND EFFECTS & 8-BIT MINECRAFT CHILL BGM)
// =========================================================================
let audioCtx = null;
let isBgmPlaying = false;
let bgmTimer = null;
let bgmMelodyIdx = 0;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playHitSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

function playBreakSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

function playFanfareSound() {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.28);
    });
  } catch {}
}

function playErrorSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

function playCrateSound() {
  try {
    const ctx = getAudioContext();
    // Chest creak effect
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);

    // Magical chime sparkle
    [659.25, 830.61, 987.77, 1318.51].forEach((freq, idx) => {
      const sOsc = ctx.createOscillator();
      const sGain = ctx.createGain();
      sOsc.type = 'sine';
      sOsc.frequency.value = freq;
      sGain.gain.setValueAtTime(0.12, ctx.currentTime + 0.1 + idx * 0.05);
      sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1 + idx * 0.05 + 0.22);
      sOsc.connect(sGain);
      sGain.connect(ctx.destination);
      sOsc.start(ctx.currentTime + 0.1 + idx * 0.05);
      sOsc.stop(ctx.currentTime + 0.1 + idx * 0.05 + 0.24);
    });
  } catch {}
}

function playSlideSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

function playMergeSound() {
  try {
    const ctx = getAudioContext();
    [523.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.05);
      osc.stop(ctx.currentTime + idx * 0.05 + 0.18);
    });
  } catch {}
}

// Relaxing Minecraft Lofi 8-bit Melody (C4, E4, G4, A4, G4, E4, D4, C4)
const CHILL_MELODY = [
  { freq: 261.63, dur: 700 }, // C4
  { freq: 329.63, dur: 700 }, // E4
  { freq: 392.00, dur: 900 }, // G4
  { freq: 440.00, dur: 700 }, // A4
  { freq: 392.00, dur: 900 }, // G4
  { freq: 329.63, dur: 700 }, // E4
  { freq: 293.66, dur: 700 }, // D4
  { freq: 261.63, dur: 1400 }, // C4
  { freq: 392.00, dur: 800 }, // G4
  { freq: 329.63, dur: 800 }, // E4
  { freq: 261.63, dur: 1200 }  // C4
];

function playNextBgmNote() {
  if (!isBgmPlaying) return;
  try {
    const ctx = getAudioContext();
    const item = CHILL_MELODY[bgmMelodyIdx % CHILL_MELODY.length];
    bgmMelodyIdx++;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(item.freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (item.dur / 1000) * 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + item.dur / 1000);

    bgmTimer = setTimeout(playNextBgmNote, item.dur);
  } catch {
    stopChillMusic();
  }
}

function toggleChillMusic() {
  if (isBgmPlaying) {
    stopChillMusic();
  } else {
    startChillMusic();
  }
}

function startChillMusic() {
  isBgmPlaying = true;
  bgmMelodyIdx = 0;
  if (bgmLabel) bgmLabel.textContent = 'Tắt Nhạc Chill ⏸️';
  if (btnToggleBgm) {
    btnToggleBgm.classList.add('bg-emerald-500/30', 'border-emerald-400');
  }
  playNextBgmNote();
}

function stopChillMusic() {
  isBgmPlaying = false;
  if (bgmTimer) clearTimeout(bgmTimer);
  if (bgmLabel) bgmLabel.textContent = 'Bật Nhạc Minecraft Chill 🎵';
  if (btnToggleBgm) {
    btnToggleBgm.classList.remove('bg-emerald-500/30', 'border-emerald-400');
  }
}


// =========================================================================
// 2. MINECRAFT BLOCK CLICKER MINI-GAME MODULE
// =========================================================================
const CLICKER_BLOCKS = [
  { name: 'Khối Đất (Dirt)', icon: '🌱', maxHp: 6, exp: 5, bg: 'linear-gradient(135deg, #5c3a21, #3b2211)', border: '#8b5a2b' },
  { name: 'Khối Đá (Stone)', icon: '🪨', maxHp: 12, exp: 10, bg: 'linear-gradient(135deg, #5a5a5a, #333333)', border: '#737373' },
  { name: 'Quặng Than (Coal Ore)', icon: '⬛', maxHp: 20, exp: 18, bg: 'linear-gradient(135deg, #2b2b2b, #121212)', border: '#444444' },
  { name: 'Quặng Sắt (Iron Ore)', icon: '🪙', maxHp: 30, exp: 30, bg: 'linear-gradient(135deg, #d8af97, #8c6853)', border: '#e6c8b5' },
  { name: 'Quặng Vàng (Gold Ore)', icon: '🧈', maxHp: 45, exp: 50, bg: 'linear-gradient(135deg, #f5c542, #a87e08)', border: '#ffd700' },
  { name: 'Quặng Kim Cương (Diamond Ore)', icon: '💎', maxHp: 65, exp: 90, diamond: 1, bg: 'linear-gradient(135deg, #2ee6d6, #0d7067)', border: '#5cfff3' },
  { name: 'Mảnh Netherite (Ancient Debris)', icon: '🛡️', maxHp: 90, exp: 150, diamond: 3, bg: 'linear-gradient(135deg, #44373a, #1f181a)', border: '#705b60' },
  { name: 'Lucky Block May Mắn ✨', icon: '❓', maxHp: 120, exp: 250, diamond: 5, bg: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '#fbbf24' }
];

const PICKAXE_TIERS = [
  { name: 'Tay Không', dmg: 1, nextCost: 15, nextName: 'Cuốc Gỗ' },
  { name: 'Cuốc Gỗ', dmg: 2, nextCost: 40, nextName: 'Cuốc Đá' },
  { name: 'Cuốc Đá', dmg: 4, nextCost: 80, nextName: 'Cuốc Sắt' },
  { name: 'Cuốc Sắt', dmg: 8, nextCost: 160, nextName: 'Cuốc Kim Cương' },
  { name: 'Cuốc Kim Cương', dmg: 16, nextCost: 320, nextName: 'Cuốc Netherite' },
  { name: 'Cuốc Netherite ⭐', dmg: 35, nextCost: 0, nextName: 'Cấp Tối Đa' }
];

let clickerBlockIdx = 0;
let clickerCurrentHp = 6;
let clickerMinedTotal = 0;
let clickerDiamondTotal = 0;
let clickerExpTotal = 0;
let pickaxeLevel = 0;

function initClicker() {
  updateClickerDisplay();
  if (mcCube) {
    mcCube.addEventListener('click', handleCubeClick);
    mcCube.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleCubeClick();
    }, { passive: false });
  }

  if (btnUpgradePickaxe) {
    btnUpgradePickaxe.addEventListener('click', handleUpgradePickaxe);
  }

  if (btnUnlockVipClicker) {
    btnUnlockVipClicker.addEventListener('click', () => {
      vipModal.classList.remove('hidden');
    });
  }
}

function updateClickerDisplay() {
  const block = CLICKER_BLOCKS[clickerBlockIdx % CLICKER_BLOCKS.length];
  if (clickerCurrentBlockName) clickerCurrentBlockName.textContent = block.name;
  if (mcCubeIcon) mcCubeIcon.textContent = block.icon;
  if (mcCube) {
    mcCube.style.background = block.bg;
    mcCube.style.border = `3px solid ${block.border}`;
    mcCube.style.boxShadow = `0 10px 25px -5px ${block.border}40`;
  }

  const percent = Math.max(0, Math.min(100, Math.round((clickerCurrentHp / block.maxHp) * 100)));
  if (clickerDurabilityBar) clickerDurabilityBar.style.width = `${percent}%`;
  if (clickerDurabilityText) clickerDurabilityText.textContent = `${Math.max(0, clickerCurrentHp)} / ${block.maxHp}`;

  // Crack opacity based on damage
  if (mcCubeCrack) {
    const damagePercent = 1 - (clickerCurrentHp / block.maxHp);
    mcCubeCrack.style.opacity = damagePercent > 0.15 ? String(damagePercent) : '0';
  }

  if (clickerMinedCount) clickerMinedCount.textContent = clickerMinedTotal;
  if (clickerDiamondCount) clickerDiamondCount.textContent = clickerDiamondTotal;
  if (clickerExpCount) clickerExpCount.textContent = clickerExpTotal;

  // Upgrade button
  const currentPickaxe = PICKAXE_TIERS[pickaxeLevel];
  if (upgradePickaxeText && btnUpgradePickaxe) {
    if (currentPickaxe.nextCost > 0) {
      upgradePickaxeText.textContent = `Nâng cấp: ${currentPickaxe.nextName} (${currentPickaxe.nextCost} EXP)`;
      btnUpgradePickaxe.disabled = clickerExpTotal < currentPickaxe.nextCost;
      btnUpgradePickaxe.classList.toggle('opacity-50', clickerExpTotal < currentPickaxe.nextCost);
    } else {
      upgradePickaxeText.textContent = 'Cuốc Netherite đã đạt Cấp Tối Đa!';
      btnUpgradePickaxe.disabled = true;
      btnUpgradePickaxe.classList.add('opacity-50');
    }
  }
}

function handleCubeClick() {
  const block = CLICKER_BLOCKS[clickerBlockIdx % CLICKER_BLOCKS.length];
  const pickaxe = PICKAXE_TIERS[pickaxeLevel];

  // If free user already reached limit and Coal is broken
  if (!isVipActive && clickerBlockIdx >= 2 && clickerCurrentHp <= 0) {
    if (clickerFreeLimitNotice) clickerFreeLimitNotice.classList.remove('hidden');
    spawnParticle('Cần VIP! 🔒', '#f59e0b');
    playErrorSound();
    return;
  }

  // Animation shake
  if (mcCube) {
    mcCube.classList.remove('block-shake');
    void mcCube.offsetWidth; // trigger reflow
    mcCube.classList.add('block-shake');
  }

  playHitSound();

  // Apply Damage
  clickerCurrentHp -= pickaxe.dmg;

  // Spawn click damage particle
  spawnParticle(`-${pickaxe.dmg}`, '#f87171');

  if (clickerCurrentHp <= 0) {
    // Check if free user reached end of Coal Ore (index 2)
    if (!isVipActive && clickerBlockIdx >= 2) {
      clickerCurrentHp = 0;
      updateClickerDisplay();
      if (clickerFreeLimitNotice) clickerFreeLimitNotice.classList.remove('hidden');
      spawnParticle('Cần VIP! 🔒', '#f59e0b');
      playErrorSound();
      return;
    }

    // Block Broken!
    playBreakSound();
    clickerMinedTotal++;
    clickerExpTotal += block.exp;
    if (block.diamond) {
      clickerDiamondTotal += block.diamond;
      spawnParticle(`+${block.diamond} 💎`, '#2ee6d6');
    }
    spawnParticle(`+${block.exp} EXP`, '#fbbf24');

    // Next Block
    clickerBlockIdx++;
    const nextBlock = CLICKER_BLOCKS[clickerBlockIdx % CLICKER_BLOCKS.length];
    clickerCurrentHp = nextBlock.maxHp;
  }

  updateClickerDisplay();
}

function spawnParticle(text, color) {
  if (!clickerParticleContainer) return;
  const p = document.createElement('div');
  p.className = 'floating-exp text-sm';
  p.textContent = text;
  p.style.color = color;

  const randX = (Math.random() - 0.5) * 80;
  p.style.setProperty('--tx', `${randX}px`);
  p.style.left = '50%';
  p.style.top = '40%';

  clickerParticleContainer.appendChild(p);
  setTimeout(() => p.remove(), 800);
}

function handleUpgradePickaxe() {
  const currentPickaxe = PICKAXE_TIERS[pickaxeLevel];
  if (currentPickaxe.nextCost > 0 && clickerExpTotal >= currentPickaxe.nextCost) {
    clickerExpTotal -= currentPickaxe.nextCost;
    pickaxeLevel++;
    playFanfareSound();
    spawnParticle('UPGRADE!', '#10b981');
    updateClickerDisplay();
  }
}


// =========================================================================
// 3. LIVE STREAM TERMINAL LOG MODULE
// =========================================================================
function appendTerminalLog(text, type = 'info') {
  if (!terminalStreamBox) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const row = document.createElement('div');
  row.className = 'text-xs truncate';

  if (type === 'success') {
    row.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> <span class="text-emerald-400 font-semibold">✓</span> <span class="text-gray-300 font-sans">${escapeHtml(text)}</span>`;
  } else if (type === 'item') {
    row.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> <span class="text-teal-400">⚡</span> <span class="text-gray-200 font-sans">Dịch: "${escapeHtml(text)}"</span>`;
  } else {
    row.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> <span class="text-amber-400">✦</span> <span class="text-gray-400 font-sans">${escapeHtml(text)}</span>`;
  }

  terminalStreamBox.appendChild(row);

  // Keep max 50 rows
  while (terminalStreamBox.children.length > 50) {
    terminalStreamBox.removeChild(terminalStreamBox.firstChild);
  }

  terminalStreamBox.scrollTop = terminalStreamBox.scrollHeight;
}


// =========================================================================
// 4. MINECRAFT TRIVIA QUIZ MODULE (ĐỐ VUI GIẢI TRÍ)
// =========================================================================
const MINECRAFT_QUIZZES = [
  {
    q: "Lá chắn (Shield) trong Minecraft có thể đỡ được vụ nổ Creeper ở cự ly cận chiến không?",
    options: ["Có, chặn 100% sát thương", "Không, vẫn mất máu", "Chỉ chặn 50% sát thương", "Bị nổ bay màu lá chắn"],
    correct: 0,
    explain: "Chính xác! Khi ngồi thụp (Sneak) và giơ lá chắn, bạn chặn hoàn toàn 100% sát thương nổ của Creeper."
  },
  {
    q: "Khối nào sau đây hoàn toàn không thể bị rồng Ender phá hủy?",
    options: ["Khối Sắt", "Khối Đá Obsidian", "Gỗ Bạch Dương", "Đá Phát Sáng (Glowstone)"],
    correct: 1,
    explain: "Đúng rồi! Rồng Ender không thể phá hủy Obsidian, Crying Obsidian, Đá Đáy (Bedrock) và Khối Cổng."
  },
  {
    q: "Mã màu nào trong Minecraft dùng để tạo chữ màu Vàng Kim huyền thoại?",
    options: ["§6", "§a", "§c", "§e"],
    correct: 0,
    explain: "Chuẩn luôn! §6 là màu Vàng Gold, còn §e là màu Vàng Chanh (Yellow), §a là Xanh Lá (Green)."
  },
  {
    q: "Hiệu ứng mã màu §k trong Minecraft có tác dụng gì đặc biệt?",
    options: ["Chữ in nghiêng", "Chữ ma trận nhảy ký tự bí ẩn", "Chữ gạch ngang", "Chữ in đậm"],
    correct: 1,
    explain: "Đúng! §k tạo hiệu ứng chữ 'Obfuscated' nhảy ký tự liên tục giống ma trận trong Minecraft."
  },
  {
    q: "Trong Minecraft PE, quặng Netherite xuất hiện nhiều nhất ở tầng độ cao Y nào?",
    options: ["Tầng Y = -58", "Tầng Y = 15", "Tầng Y = 64", "Tầng Y = 128"],
    correct: 1,
    explain: "Chính xác! Mảnh vỡ cổ đại (Ancient Debris) xuất hiện nhiều nhất tại tầng Y = 14 đến 15 ở Địa Ngục."
  },
  {
    q: "Khi dịch mod MCPE, tệp nào chứa bảng menu bánh răng ⚙️ cài đặt ở ngoài map?",
    options: ["pack_icon.png", "manifest.json (subpacks)", "en_US.lang", "settings.json"],
    correct: 1,
    explain: "Chính xác! Mục 'subpacks' trong manifest.json quyết định các menu tùy chọn bánh răng ngoài map."
  },
  {
    q: "Muốn thuần hóa một chú Vẹt (Parrot) trong Minecraft, bạn cần cho nó ăn gì?",
    options: ["Thịt bò", "Các loại Hạt giống (Seeds)", "Bánh quy (Cookie)", "Táo vàng"],
    correct: 1,
    explain: "Chuẩn xác! Cho vẹt ăn các loại hạt giống sẽ thuần hóa được, cho ăn Bánh quy sẽ làm vẹt chết ngay!"
  },
  {
    q: "Cấp độ bùa phép Cường hóa (Sharpness) tối đa bình thường trên bàn chế tạo là bao nhiêu?",
    options: ["Sharpness IV (4)", "Sharpness V (5)", "Sharpness X (10)", "Sharpness III (3)"],
    correct: 1,
    explain: "Chính xác! Cấp độ Sharpness tối đa trong game thuần là cấp 5 (Sharpness V)."
  }
];

let currentQuizIdx = 0;
let quizAnswered = false;
let quizAnsweredCount = 0;

function loadRandomQuiz() {
  if (!isVipActive && quizAnsweredCount >= 3) {
    if (quizFreeLimitNotice) quizFreeLimitNotice.classList.remove('hidden');
    if (quizActiveContainer) quizActiveContainer.classList.add('hidden');
    return;
  }

  if (quizFreeLimitNotice) quizFreeLimitNotice.classList.add('hidden');
  if (quizActiveContainer) quizActiveContainer.classList.remove('hidden');

  quizAnswered = false;
  currentQuizIdx = Math.floor(Math.random() * MINECRAFT_QUIZZES.length);
  const quiz = MINECRAFT_QUIZZES[currentQuizIdx];

  if (quizQuestion) quizQuestion.textContent = quiz.q;
  if (quizFeedback) {
    quizFeedback.classList.add('hidden');
    quizFeedback.innerHTML = '';
  }

  if (quizOptionsGrid) {
    quizOptionsGrid.innerHTML = '';
    quiz.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn p-2.5 rounded-lg border border-gray-800 bg-gray-900/80 hover:bg-gray-800 text-left text-gray-200 transition-all font-medium';
      btn.textContent = `${String.fromCharCode(65 + optIdx)}. ${optText}`;
      btn.addEventListener('click', () => handleQuizAnswer(optIdx));
      quizOptionsGrid.appendChild(btn);
    });
  }
}

function handleQuizAnswer(selectedIdx) {
  if (quizAnswered) return;
  quizAnswered = true;
  quizAnsweredCount++;

  if (quizScoreCounter) {
    quizScoreCounter.textContent = isVipActive ? `Đã làm: ${quizAnsweredCount} (VIP vô hạn)` : `Đã làm: ${quizAnsweredCount}/3`;
  }

  const quiz = MINECRAFT_QUIZZES[currentQuizIdx];
  const buttons = quizOptionsGrid.querySelectorAll('.quiz-opt-btn');

  if (selectedIdx === quiz.correct) {
    playFanfareSound();
    buttons[selectedIdx].classList.add('bg-emerald-500/20', 'border-emerald-500', 'text-emerald-300');
    clickerExpTotal += 20;
    spawnParticle('+20 EXP! ⭐', '#10b981');
    updateClickerDisplay();

    if (quizFeedback) {
      quizFeedback.className = 'mt-2.5 p-2 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
      quizFeedback.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-emerald-400"></i> ${quiz.explain} <strong>(+20 EXP cho Thợ Mỏ!)</strong>`;
      quizFeedback.classList.remove('hidden');
    }
  } else {
    playErrorSound();
    buttons[selectedIdx].classList.add('bg-red-500/20', 'border-red-500', 'text-red-300');
    buttons[quiz.correct].classList.add('bg-emerald-500/20', 'border-emerald-500', 'text-emerald-300');

    if (quizFeedback) {
      quizFeedback.className = 'mt-2.5 p-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-300';
      quizFeedback.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1 text-red-400"></i> Chưa chính xác! Đáp án đúng: <strong>${quiz.options[quiz.correct]}</strong>. ${quiz.explain}`;
      quizFeedback.classList.remove('hidden');
    }
  }

  // If free user reached 3 questions, prompt after showing feedback
  if (!isVipActive && quizAnsweredCount >= 3) {
    setTimeout(() => {
      if (quizFreeLimitNotice) quizFreeLimitNotice.classList.remove('hidden');
      if (quizActiveContainer) quizActiveContainer.classList.add('hidden');
    }, 2400);
  }
}


// =========================================================================
// 5. LUCKY CRATE MINI-GAME MODULE (EXCLUSIVE VIP)
// =========================================================================
const CRATE_LOOT_TABLE = [
  { name: 'Kiếm Thần Netherite (Sharpness X)', icon: '🗡️', rarity: 'Thần Thoại', color: '#f59e0b', desc: '+999 Sát thương chí mạng, chém chém xuyên giáp' },
  { name: 'Khiên Rồng Ender Bất Hoại', icon: '🛡️', rarity: 'Huyền Thoại', color: '#a855f7', desc: 'Chặn 100% sát thương nổ Creeper và đòn cận chiến' },
  { name: 'Táo Vàng Notch Cổ Đại', icon: '🍎', rarity: 'Sử Thi', color: '#eab308', desc: 'Hồi phục vĩnh cửu, buff Giáp Vàng cấp IV và Kháng Lửa' },
  { name: 'Cuốc Netherite Gia Bảo (Fortune V)', icon: '⛏️', rarity: 'Huyền Thoại', color: '#06b6d4', desc: 'Đập 1 quặng rơi x5 Kim Cương và Netherite' },
  { name: 'Cung Thần Sấm Sét (Infinity Flame)', icon: '🏹', rarity: 'Sử Thi', color: '#3b82f6', desc: 'Bắn tên vô tận triệu hồi sấm sét giáng vào quái vật' },
  { name: 'Vương Miện Chúa Tể Minecraft (VIP Crown)', icon: '👑', rarity: 'Thần Thoại', color: '#f59e0b', desc: 'Hào quang tôn quý dành riêng cho thành viên VIP' },
  { name: 'Thuốc Thần Biến Thân Bất Tử', icon: '🧪', rarity: 'Hiếm', color: '#ec4899', desc: 'Tăng 200% tốc độ chạy và nhảy cao gấp 3 lần' },
  { name: 'Ngôi Sao Địa Ngục Nether Star', icon: '🌟', rarity: 'Thần Thoại', color: '#fbbf24', desc: 'Vật phẩm tối thượng dùng kích hoạt Hải Đăng' }
];

let crateInventory = [];

function initCrateGame() {
  try {
    const saved = localStorage.getItem('mcpe_vip_crate_inventory');
    if (saved) crateInventory = JSON.parse(saved);
  } catch {}
  renderCrateInventory();

  if (btnOpenCrate) {
    btnOpenCrate.addEventListener('click', handleOpenCrate);
  }
  if (chestVisual) {
    chestVisual.addEventListener('click', handleOpenCrate);
  }
  if (btnUnlockVipCrate) {
    btnUnlockVipCrate.addEventListener('click', () => {
      vipModal.classList.remove('hidden');
    });
  }
}

function handleOpenCrate() {
  if (!isVipActive) {
    vipModal.classList.remove('hidden');
    return;
  }

  // Animation on chest
  if (chestVisual) {
    chestVisual.classList.remove('block-shake');
    void chestVisual.offsetWidth;
    chestVisual.classList.add('block-shake');
    chestVisual.textContent = '✨📦✨';
    setTimeout(() => {
      if (chestVisual) chestVisual.textContent = '📦';
    }, 600);
  }

  playCrateSound();

  // Pick random loot
  const loot = CRATE_LOOT_TABLE[Math.floor(Math.random() * CRATE_LOOT_TABLE.length)];

  // Display result
  if (lootResultBox && lootResultName && lootResultDesc && lootResultIcon) {
    lootResultIcon.textContent = loot.icon;
    lootResultName.textContent = `${loot.name} [${loot.rarity}]`;
    lootResultName.style.color = loot.color;
    lootResultDesc.textContent = loot.desc;
    lootResultBox.classList.remove('hidden');
    lootResultBox.classList.remove('animate-loot-pop');
    void lootResultBox.offsetWidth;
    lootResultBox.classList.add('animate-loot-pop');
  }

  // Add to inventory
  crateInventory.unshift(loot);
  if (crateInventory.length > 30) crateInventory.pop();
  try {
    localStorage.setItem('mcpe_vip_crate_inventory', JSON.stringify(crateInventory));
  } catch {}

  renderCrateInventory();
}

function renderCrateInventory() {
  if (!crateInventoryGrid) return;
  if (crateLootCount) crateLootCount.textContent = `${crateInventory.length} vật phẩm`;

  if (crateInventory.length === 0) {
    crateInventoryGrid.innerHTML = `<span class="text-gray-500 text-[11px] italic self-center mx-auto">Chưa mở rương nào. Hãy nhấp mở rương ở trên!</span>`;
    return;
  }

  crateInventoryGrid.innerHTML = '';
  crateInventory.forEach((item) => {
    const badge = document.createElement('div');
    badge.className = 'px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm hover:border-amber-500/50 transition-colors cursor-default';
    badge.title = `${item.name} (${item.rarity}): ${item.desc}`;
    badge.innerHTML = `<span>${item.icon}</span> <span style="color:${item.color}">${escapeHtml(item.name.split(' (')[0])}</span>`;
    crateInventoryGrid.appendChild(badge);
  });
}


// =========================================================================
// 6. MINECRAFT 2048: TIẾN HÓA TRANG BỊ MODULE (EXCLUSIVE VIP)
// =========================================================================
const TILES_2048 = {
  2: { text: 'Gỗ', icon: '🪵', cls: 'tile-2' },
  4: { text: 'Đá', icon: '🪨', cls: 'tile-4' },
  8: { text: 'Sắt', icon: '🪙', cls: 'tile-8' },
  16: { text: 'Vàng', icon: '🧈', cls: 'tile-16' },
  32: { text: 'Redstone', icon: '🔴', cls: 'tile-32' },
  64: { text: 'Emerald', icon: '🟢', cls: 'tile-64' },
  128: { text: 'K.Cương', icon: '💎', cls: 'tile-128' },
  256: { text: 'Lapis', icon: '🔷', cls: 'tile-256' },
  512: { text: 'Netherite', icon: '🛡️', cls: 'tile-512' },
  1024: { text: 'Rồng Ender', icon: '🐉', cls: 'tile-1024' },
  2048: { text: 'Thần Thoại', icon: '👑', cls: 'tile-2048' }
};

let grid2048 = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
];
let scoreVal2048 = 0;
let is2048Initialized = false;

function init2048Game() {
  grid2048 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  scoreVal2048 = 0;
  addRandomTile2048();
  addRandomTile2048();
  render2048Board();

  if (!is2048Initialized) {
    is2048Initialized = true;
    if (btnRestart2048) {
      btnRestart2048.addEventListener('click', init2048Game);
    }
    if (btnUnlockVip2048) {
      btnUnlockVip2048.addEventListener('click', () => {
        vipModal.classList.remove('hidden');
      });
    }

    // Mobile D-Pad touch buttons
    if (btn2048Up) btn2048Up.addEventListener('click', () => move2048('up'));
    if (btn2048Down) btn2048Down.addEventListener('click', () => move2048('down'));
    if (btn2048Left) btn2048Left.addEventListener('click', () => move2048('left'));
    if (btn2048Right) btn2048Right.addEventListener('click', () => move2048('right'));

    // Keyboard listener (Arrow keys and WASD)
    window.addEventListener('keydown', (e) => {
      const tab2048 = document.getElementById('tabContent2048');
      if (!tab2048 || tab2048.classList.contains('hidden')) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        move2048('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        move2048('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        move2048('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        move2048('right');
      }
    });
  }
}

function addRandomTile2048() {
  const emptyCells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid2048[r][c] === 0) emptyCells.push({ r, c });
    }
  }
  if (emptyCells.length === 0) return;
  const randCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  grid2048[randCell.r][randCell.c] = Math.random() < 0.9 ? 2 : 4;
}

function render2048Board() {
  if (!board2048) return;
  board2048.innerHTML = '';
  if (score2048) score2048.textContent = scoreVal2048;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = grid2048[r][c];
      const cell = document.createElement('div');
      cell.className = 'tile-2048';

      if (val === 0) {
        cell.classList.add('tile-empty');
      } else {
        const info = TILES_2048[val] || { text: `${val}`, icon: '⚡', cls: 'tile-2048' };
        cell.className = `tile-2048 ${info.cls}`;
        cell.innerHTML = `<span class="text-base sm:text-lg">${info.icon}</span><span class="text-[10px] font-bold">${info.text}</span>`;
      }
      board2048.appendChild(cell);
    }
  }
}

function slideArray2048(row) {
  let arr = row.filter(val => val !== 0);
  let merged = false;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      scoreVal2048 += arr[i];
      arr.splice(i + 1, 1);
      merged = true;
    }
  }
  while (arr.length < 4) {
    arr.push(0);
  }
  return { newRow: arr, merged };
}

function move2048(dir) {
  if (!isVipActive) {
    vipModal.classList.remove('hidden');
    return;
  }

  let moved = false;
  let didMerge = false;

  if (dir === 'left') {
    for (let r = 0; r < 4; r++) {
      const orig = [...grid2048[r]];
      const res = slideArray2048(grid2048[r]);
      grid2048[r] = res.newRow;
      if (res.merged) didMerge = true;
      if (orig.some((v, idx) => v !== grid2048[r][idx])) moved = true;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < 4; r++) {
      const orig = [...grid2048[r]];
      const reversed = [...grid2048[r]].reverse();
      const res = slideArray2048(reversed);
      grid2048[r] = res.newRow.reverse();
      if (res.merged) didMerge = true;
      if (orig.some((v, idx) => v !== grid2048[r][idx])) moved = true;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < 4; c++) {
      const col = [grid2048[0][c], grid2048[1][c], grid2048[2][c], grid2048[3][c]];
      const orig = [...col];
      const res = slideArray2048(col);
      for (let r = 0; r < 4; r++) grid2048[r][c] = res.newRow[r];
      if (res.merged) didMerge = true;
      if (orig.some((v, idx) => v !== res.newRow[idx])) moved = true;
    }
  } else if (dir === 'down') {
    for (let c = 0; c < 4; c++) {
      const col = [grid2048[3][c], grid2048[2][c], grid2048[1][c], grid2048[0][c]];
      const orig = [...col];
      const res = slideArray2048(col);
      const reversed = res.newRow.reverse();
      for (let r = 0; r < 4; r++) grid2048[r][c] = reversed[r];
      if (res.merged) didMerge = true;
      if (orig.some((v, idx) => v !== col[idx])) moved = true;
    }
  }

  if (moved) {
    if (didMerge) playMergeSound();
    else playSlideSound();
    addRandomTile2048();
    render2048Board();
  }
}


// =========================================================================
// 7. WAITING HUB TAB SYSTEM
// =========================================================================
const hubTabs = [
  { id: 'clicker', btn: 'tabBtnClicker', content: 'tabContentClicker' },
  { id: 'crate', btn: 'tabBtnCrate', content: 'tabContentCrate' },
  { id: '2048', btn: 'tabBtn2048', content: 'tabContent2048' },
  { id: 'terminal', btn: 'tabBtnTerminal', content: 'tabContentTerminal' },
  { id: 'quiz', btn: 'tabBtnQuiz', content: 'tabContentQuiz' }
];

function setupHubTabs() {
  hubTabs.forEach(tab => {
    const btn = document.getElementById(tab.btn);
    if (btn) {
      btn.addEventListener('click', () => switchHubTab(tab.id));
    }
  });

  if (btnViewVipBenefits) {
    btnViewVipBenefits.addEventListener('click', () => {
      vipModal.classList.remove('hidden');
    });
  }

  if (btnUnlockVipQuiz) {
    btnUnlockVipQuiz.addEventListener('click', () => {
      vipModal.classList.remove('hidden');
    });
  }
}

function switchHubTab(targetId) {
  hubTabs.forEach(tab => {
    const btn = document.getElementById(tab.btn);
    const content = document.getElementById(tab.content);
    if (!btn || !content) return;

    if (tab.id === targetId) {
      btn.className = 'hub-tab-btn px-3.5 py-2 rounded-lg bg-gray-800 text-white font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all shadow-sm';
      content.classList.remove('hidden');
      content.classList.add('animate-fade-in');

      if (tab.id === '2048') {
        init2048Game();
      }
    } else {
      btn.className = 'hub-tab-btn px-3.5 py-2 rounded-lg text-gray-400 hover:text-white font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all';
      content.classList.add('hidden');
      content.classList.remove('animate-fade-in');
    }
  });
}


// =========================================================================
// 8. MAIN INITIALIZATION & EVENT LISTENERS
// =========================================================================
function init() {
  // Wire account actions first. A broken optional page widget must not disable
  // registration, login, or password recovery.
  safelyInitialize('account controls', setupAuth);
  // Keep the primary account and support dialogs available even if an unrelated
  // page feature fails while initializing.
  safelyInitialize('dialogs', setupModals);
  safelyInitialize('file upload controls', setupDragAndDrop);
  safelyInitialize('translation settings', setupConfigListeners);
  safelyInitialize('translation table search', setupTableSearch);
  loadMonetizationConfig();
  loadLinkGateConfig();
  loadCurrentUser();
  safelyInitialize('clicker game', initClicker);
  safelyInitialize('waiting hub tabs', setupHubTabs);
  safelyInitialize('VIP crate game', initCrateGame);
  safelyInitialize('2048 game', init2048Game);

  if (btnToggleBgm) {
    btnToggleBgm.addEventListener('click', toggleChillMusic);
  }

  if (btnNextQuiz) {
    btnNextQuiz.addEventListener('click', loadRandomQuiz);
  }
  loadRandomQuiz();

  vipRefreshTimer = setInterval(refreshVipStatus, 60 * 1000);
}

function safelyInitialize(featureName, initialize) {
  try {
    initialize();
  } catch (error) {
    console.error(`Could not initialize ${featureName}:`, error);
  }
}

async function loadMonetizationConfig() {
  try {
    const res = await authFetch('/api/monetization/config');
    monetizationConfig = await res.json();

    if (monetizationConfig) {
      if (monetizationConfig.donation) {
        vietQrImg.src = monetizationConfig.donation.vietQrUrl || '/qr_code.png';
        bankNameDisplay.textContent = monetizationConfig.donation.bankCode || 'BIDV';
        bankAccDisplay.textContent = monetizationConfig.donation.accountNumber || '';
        bankHolderDisplay.textContent = monetizationConfig.donation.accountHolder || '';
        if (momoDisplay) {
          momoDisplay.textContent = monetizationConfig.donation.momoPhone || '0978921749';
        }
      }
      if (monetizationConfig.vipSystem) {
        vipContactInfo.textContent = monetizationConfig.vipSystem.contactInfo || 'Liên hệ quản trị viên để mua key VIP';
      }
      if (monetizationConfig.downloadGate?.adBannerHtml) {
        adBannerContainer.innerHTML = monetizationConfig.downloadGate.adBannerHtml;
      }
    }
  } catch (err) {
    console.warn('Could not load monetization config:', err);
  }
}

async function loadCurrentUser() {
  try {
    const res = await authFetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('mcpe_auth_token');
      }
      return setCurrentUser(null);
    }
    const data = await res.json();
    setCurrentUser(data.user || null);
  } catch {
    setCurrentUser(null);
  }
}

function formatVipRemaining(vipUntil) {
  if (!vipUntil) return '';
  const diff = new Date(vipUntil).getTime() - Date.now();
  if (diff <= 0) return 'VIP đã hết hạn';
  const totalMinutes = Math.ceil(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Còn ${days} ngày ${hours} giờ`;
  if (hours > 0) return `Còn ${hours} giờ ${minutes} phút`;
  return `Còn ${minutes} phút`;
}

function setCurrentUser(user) {
  currentUser = user;
  isVipActive = !!user?.isVip && !!user?.vipUntil && new Date(user.vipUntil).getTime() > Date.now();
  authNavLabel.textContent = user ? (user.email.length > 18 ? `${user.email.slice(0, 15)}...` : user.email) : 'Đăng nhập';
  btnOpenAuthModal.classList.toggle('bg-gray-800/80', !user);
  btnOpenAuthModal.classList.toggle('bg-emerald-500/10', !!user);
  btnOpenAuthModal.classList.toggle('border-emerald-500/30', !!user);
  btnOpenAuthModal.classList.toggle('text-emerald-300', !!user);
  updateVipUi();
  updateAccountStatusCard();
  updateTranslationAccess();
}

function updateVipUi() {
  isVipActive = !!currentUser?.isVip && !!currentUser?.vipUntil && new Date(currentUser.vipUntil).getTime() > Date.now();
  const tierLabel = currentUser?.vipTier ? `VIP: ${currentUser.vipTier}` : 'VIP Đang Hoạt Động';
  vipNavLabel.textContent = isVipActive ? tierLabel : 'Kích Hoạt VIP';
  vipActiveBadge.classList.toggle('hidden', !isVipActive);
  if (isVipActive && currentUser?.vipTier) {
    vipActiveBadge.innerHTML = `<i class="fa-solid fa-crown mr-1"></i>${currentUser.vipTier}`;
  }

  // Update Mini-games VIP Lock Overlays
  if (crateVipLockOverlay) {
    crateVipLockOverlay.classList.toggle('hidden', isVipActive);
  }
  if (game2048VipLockOverlay) {
    game2048VipLockOverlay.classList.toggle('hidden', isVipActive);
  }

  // Clicker free limit notice
  if (clickerFreeLimitNotice && isVipActive) {
    clickerFreeLimitNotice.classList.add('hidden');
  }

  // Quiz free limit notice
  if (quizFreeLimitNotice && quizActiveContainer && isVipActive) {
    quizFreeLimitNotice.classList.add('hidden');
    quizActiveContainer.classList.remove('hidden');
  }

  if (quizScoreCounter) {
    quizScoreCounter.textContent = isVipActive ? `Đã làm: ${quizAnsweredCount} (VIP vô hạn)` : `Đã làm: ${quizAnsweredCount}/3`;
  }
}

function updateAccountStatusCard() {
  if (!accountStatusCard) return;
  accountStatusCard.classList.toggle('border-amber-500/30', isVipActive);
  accountStatusCard.classList.toggle('border-emerald-500/30', !!currentUser && !isVipActive);
  accountStatusCard.classList.toggle('border-gray-800', !currentUser);

  if (!currentUser) {
    accountStatusIcon.className = 'w-11 h-11 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400';
    accountStatusIcon.innerHTML = '<i class="fa-solid fa-user"></i>';
    accountStatusTitle.textContent = 'Chưa đăng nhập';
    accountStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-800 text-gray-400 border-gray-700';
    accountStatusBadge.textContent = 'TÀI KHOẢN THƯỜNG';
    accountStatusText.textContent = 'Đăng nhập để lưu VIP theo tài khoản và sử dụng dịch vụ dịch mod.';
    btnStatusAction.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-1"></i> Đăng nhập / Đăng ký';
    return;
  }

  if (isVipActive) {
    accountStatusIcon.className = 'w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400';
    accountStatusIcon.innerHTML = '<i class="fa-solid fa-crown"></i>';
    accountStatusTitle.textContent = currentUser.email;
    accountStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/10 text-amber-300 border-amber-500/30';
    accountStatusBadge.textContent = currentUser.vipTier ? currentUser.vipTier.toUpperCase() : 'VIP';
    accountStatusText.textContent = `${currentUser.vipTier ? currentUser.vipTier + ' • ' : ''}${formatVipRemaining(currentUser.vipUntil)} • Hết hạn ${new Date(currentUser.vipUntil).toLocaleString('vi-VN')}`;
    btnStatusAction.innerHTML = '<i class="fa-solid fa-user-gear mr-1"></i> Quản lý tài khoản';
  } else {
    accountStatusIcon.className = 'w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400';
    accountStatusIcon.innerHTML = '<i class="fa-solid fa-user-check"></i>';
    accountStatusTitle.textContent = currentUser.email;
    accountStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-800 text-gray-300 border-gray-700';
    accountStatusBadge.textContent = 'CHƯA CÓ VIP';
    accountStatusText.textContent = 'Tài khoản thường • Nâng cấp 1 trong 5 gói VIP để dịch không cần vượt link!';
    btnStatusAction.innerHTML = '<i class="fa-solid fa-crown mr-1"></i> Kích hoạt VIP';
  }
}

function updateTranslationAccess() {
  if (!translationAccessNotice) return;
  if (!currentUser) {
    translationAccessIcon.className = 'fa-solid fa-right-to-bracket text-gray-400 mt-0.5';
    translationAccessTitle.textContent = 'Đăng nhập khi bắt đầu dịch';
    translationAccessText.textContent = 'Bạn có thể tải và kiểm tra mod trước. Khi bấm Bắt đầu dịch, hệ thống sẽ yêu cầu đăng nhập.';
    return;
  }
  if (isVipActive) {
    translationAccessIcon.className = 'fa-solid fa-crown text-amber-400 mt-0.5';
    translationAccessTitle.textContent = `${currentUser.vipTier || 'VIP'} đang hoạt động — dịch ngay lập tức`;
    translationAccessText.textContent = `${formatVipRemaining(currentUser.vipUntil)}. Bạn được ưu tiên tốc độ cao và không cần vượt link.`;
  } else {
    translationAccessIcon.className = 'fa-solid fa-link text-emerald-400 mt-0.5';
    translationAccessTitle.textContent = 'Tài khoản thường — cần vượt link';
    translationAccessText.textContent = 'Bấm Bắt đầu dịch để mở bước vượt link. Hoặc nâng cấp VIP để dịch trực tiếp.';
  }
}

async function refreshVipStatus() {
  if (!currentUser) return;
  try {
    const res = await authFetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('mcpe_auth_token');
        setCurrentUser(null);
      }
      return;
    }
    const data = await res.json();
    setCurrentUser(data.user || null);
  } catch {}
}

async function loadLinkGateConfig() {
  try {
    const res = await authFetch('/api/link-gate/config');
    linkGateConfig = await res.json();
  } catch {
    linkGateConfig = { enabled: false };
  }
}

function setAuthMode(mode) {
  const register = mode === 'register';
  const reset = mode === 'reset';

  btnAuthLoginTab.className = (!register && !reset) ? 'py-2 rounded-lg bg-gray-800 text-white transition-colors' : 'py-2 rounded-lg text-gray-400 hover:text-white transition-colors';
  btnAuthRegisterTab.className = register ? 'py-2 rounded-lg bg-gray-800 text-white transition-colors' : 'py-2 rounded-lg text-gray-400 hover:text-white transition-colors';
  btnAuthResetTab.className = reset ? 'py-2 rounded-lg bg-gray-800 text-white transition-colors' : 'py-2 rounded-lg text-gray-400 hover:text-white transition-colors';

  if (reset) {
    authModalTitle.textContent = 'Đặt lại mật khẩu';
    authModalHint.textContent = 'Nhập email tài khoản và mật khẩu mới để khôi phục quyền truy cập.';
    authForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
    accountInfo.classList.add('hidden');
  } else {
    resetForm.classList.add('hidden');
    authForm.classList.remove('hidden');
    authModalTitle.textContent = register ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản';
    authModalHint.textContent = register
      ? 'Tạo tài khoản để lưu VIP trên server và đồng bộ trên mọi thiết bị.'
      : 'Đăng nhập để duy trì phiên làm việc không bị mất sau mỗi ngày.';
    btnAuthSubmit.textContent = register ? 'Đăng ký ngay' : 'Đăng nhập';
    authPassword.autocomplete = register ? 'new-password' : 'current-password';
    authForm.dataset.mode = register ? 'register' : 'login';
  }
}

function openAuthModal(mode = 'login') {
  authModal.classList.remove('hidden');
  if (currentUser) {
    authForm.classList.add('hidden');
    resetForm.classList.add('hidden');
    accountInfo.classList.remove('hidden');
    accountEmail.textContent = currentUser.email;
    accountVipStatus.textContent = isVipActive
      ? `${currentUser.vipTier || 'VIP'} (Hết hạn: ${new Date(currentUser.vipUntil).toLocaleDateString('vi-VN')})`
      : 'Tài khoản thường (Chưa có VIP)';
  } else {
    accountInfo.classList.add('hidden');
    setAuthMode(mode);
  }
}

function setupAuth() {
  btnOpenAuthModal.addEventListener('click', () => openAuthModal());
  btnStatusAction.addEventListener('click', () => {
    if (!currentUser) return openAuthModal('login');
    if (!isVipActive) return vipModal.classList.remove('hidden');
    openAuthModal();
  });

  btnAuthLoginTab.addEventListener('click', () => { if (!currentUser) setAuthMode('login'); });
  btnAuthRegisterTab.addEventListener('click', () => { if (!currentUser) setAuthMode('register'); });
  btnAuthResetTab.addEventListener('click', () => { if (!currentUser) setAuthMode('reset'); });

  if (btnToggleAuthPassword) {
    btnToggleAuthPassword.addEventListener('click', () => {
      const isPassword = authPassword.type === 'password';
      authPassword.type = isPassword ? 'text' : 'password';
      btnToggleAuthPassword.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash text-emerald-400"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  if (btnToggleResetPassword) {
    btnToggleResetPassword.addEventListener('click', () => {
      const isPassword = resetNewPassword.type === 'password';
      resetNewPassword.type = isPassword ? 'text' : 'password';
      btnToggleResetPassword.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash text-teal-400"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = authForm.dataset.mode || 'login';
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể xác thực.');

      if (data.token) {
        localStorage.setItem('mcpe_auth_token', data.token);
      }

      setCurrentUser(data.user);
      authModal.classList.add('hidden');
      authEmail.value = '';
      authPassword.value = '';

      if (pendingStartAfterAuth && currentSessionId) {
        pendingStartAfterAuth = false;
        setTimeout(startTranslation, 120);
      } else {
        alert(mode === 'register' ? 'Đăng ký thành công! Tài khoản đã được lưu.' : 'Đăng nhập thành công!');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resetEmail.value.trim();
    const newPasswordVal = resetNewPassword.value.trim();

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: newPasswordVal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể đặt lại mật khẩu.');

      if (data.token) {
        localStorage.setItem('mcpe_auth_token', data.token);
      }

      setCurrentUser(data.user);
      authModal.classList.add('hidden');
      resetEmail.value = '';
      resetNewPassword.value = '';
      alert(data.message || 'Đặt lại mật khẩu thành công!');
    } catch (err) {
      alert(err.message);
    }
  });

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await authFetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldPassword: currentPassword.value.trim(),
            newPassword: newPassword.value.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi khi đổi mật khẩu.');
        alert(data.message || 'Đổi mật khẩu thành công!');
        currentPassword.value = '';
        newPassword.value = '';
      } catch (err) {
        alert(err.message);
      }
    });
  }

  btnLogout.addEventListener('click', async () => {
    await authFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('mcpe_auth_token');
    setCurrentUser(null);
    linkGateToken = '';
    pendingStartAfterAuth = false;
    authModal.classList.add('hidden');
    alert('Đã đăng xuất.');
  });
}

function setupModals() {
  // Bind these first so a failure in optional install or clipboard controls
  // cannot prevent the VIP and donation dialogs from opening.
  if (btnOpenVipModal) {
    btnOpenVipModal.addEventListener('click', () => {
      vipModal.classList.remove('hidden');
    });
  }

  if (btnOpenDonateModal) {
    btnOpenDonateModal.addEventListener('click', () => {
      donateModal.classList.remove('hidden');
    });
  }

  if (btnOpenInstallModal) {
    btnOpenInstallModal.addEventListener('click', () => {
      installAppModal.classList.remove('hidden');
    });
  }

  if (btnTabAppAndroid && btnTabAppIos) {
    btnTabAppAndroid.addEventListener('click', () => {
      btnTabAppAndroid.className = 'py-2.5 rounded-lg bg-gray-800 text-white flex items-center justify-center gap-2 transition-all';
      btnTabAppIos.className = 'py-2.5 rounded-lg text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all';
      if (tabContentAppAndroid) tabContentAppAndroid.classList.remove('hidden');
      if (tabContentAppIos) tabContentAppIos.classList.add('hidden');
    });

    btnTabAppIos.addEventListener('click', () => {
      btnTabAppIos.className = 'py-2.5 rounded-lg bg-gray-800 text-white flex items-center justify-center gap-2 transition-all';
      btnTabAppAndroid.className = 'py-2.5 rounded-lg text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all';
      if (tabContentAppIos) tabContentAppIos.classList.remove('hidden');
      if (tabContentAppAndroid) tabContentAppAndroid.classList.add('hidden');
    });
  }

  if (btnTriggerPwaInstall) {
    btnTriggerPwaInstall.addEventListener('click', async () => {
      if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const { outcome } = await deferredPwaPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPwaPrompt = null;
          installAppModal.classList.add('hidden');
        }
      } else {
        alert('Để cài app trên Android:\n1. Bấm vào biểu tượng 3 dấu chấm (⋮) ở góc trên trình duyệt Chrome/Cốc Cốc.\n2. Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".');
      }
    });
  }

  if (btnTipFromSuccess) {
    btnTipFromSuccess.addEventListener('click', () => {
      donateModal.classList.remove('hidden');
    });
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.fixed').classList.add('hidden');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target === vipModal) vipModal.classList.add('hidden');
    if (e.target === donateModal) donateModal.classList.add('hidden');
    if (e.target === authModal) authModal.classList.add('hidden');
    if (e.target === linkGateModal) linkGateModal.classList.add('hidden');
    if (e.target === installAppModal) installAppModal.classList.add('hidden');
  });

  // PWA beforeinstallprompt handler
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
  });

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  btnCopyAcc.addEventListener('click', () => {
    const acc = bankAccDisplay.textContent;
    navigator.clipboard.writeText(acc).then(() => {
      const orig = btnCopyAcc.innerHTML;
      btnCopyAcc.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i>';
      setTimeout(() => btnCopyAcc.innerHTML = orig, 1500);
    });
  });

  btnVerifyVip.addEventListener('click', async () => {
    if (!currentUser) {
      vipModal.classList.add('hidden');
      return openAuthModal('login');
    }

    const key = vipKeyInput.value.trim();
    if (!key) return alert('Vui lòng nhập mã VIP Key!');

    try {
      const res = await authFetch('/api/monetization/verify-vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();

      if (!res.ok) return alert(data.message || 'VIP Key không chính xác hoặc đã hết hạn!');

      setCurrentUser(data.user);
      vipKeyInput.value = '';
      vipModal.classList.add('hidden');
      alert(data.message);
    } catch {
      alert('Lỗi kết nối khi kiểm tra VIP key.');
    }
  });
}

btnVerifyLinkGate.addEventListener('click', async () => {
  if (!currentUser) {
    linkGateModal.classList.add('hidden');
    return openAuthModal('login');
  }

  const passcode = linkGatePasscode.value.trim();
  if (!passcode) return alert('Vui lòng nhập mã sau khi vượt link.');

  try {
    const res = await authFetch('/api/link-gate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Mã vượt link không đúng.');

    linkGateToken = data.token || '';
    linkGatePasscode.value = '';
    linkGateModal.classList.add('hidden');
    launchTranslation();
  } catch {
    alert('Không thể xác nhận bước vượt link.');
  }
});

function setupDragAndDrop() {
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-emerald-500', 'bg-gray-800/80', 'scale-[1.01]');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-emerald-500', 'bg-gray-800/80', 'scale-[1.01]');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  btnChangeFile.addEventListener('click', resetToUpload);
  btnNewFile.addEventListener('click', resetToUpload);
}

function setupConfigListeners() {
  engineRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'gemini') {
        apiKeyContainer.classList.remove('hidden');
      } else {
        apiKeyContainer.classList.add('hidden');
      }
    });
  });

  btnStartTranslate.addEventListener('click', startTranslation);
}

async function handleFileUpload(file) {
  const name = file.name.toLowerCase();
  const validExts = ['.mcpack', '.mcaddon', '.zip'];
  const hasValidExt = validExts.some(ext => name.endsWith(ext));

  if (!hasValidExt && !file.type.includes('zip') && !file.type.includes('octet-stream')) {
    alert('Định dạng không hợp lệ! Vui lòng chọn file .mcpack, .mcaddon hoặc .zip');
    return;
  }

  uploadLoader.classList.remove('hidden');

  const formData = new FormData();
  formData.append('modFile', file);

  try {
    const response = await authFetch('/api/inspect', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Lỗi khi đọc file mod.');
    }

    currentSessionId = data.sessionId;
    currentInspectionData = data;
    renderModInspection(data);

  } catch (err) {
    alert(`Lỗi: ${err.message}`);
  } finally {
    uploadLoader.classList.add('hidden');
    fileInput.value = '';
  }
}

function renderModInspection(data) {
  uploadSection.classList.add('hidden');
  configSection.classList.remove('hidden');
  progressSection.classList.add('hidden');
  resultSection.classList.add('hidden');

  const firstPack = data.packs[0] || {};
  packName.textContent = firstPack.displayName || data.filename;
  packVersion.textContent = `v${firstPack.version || '1.0.0'}`;
  packDesc.textContent = firstPack.description || 'Không có mô tả.';
  packIconPreview.src = firstPack.iconBase64 || DEFAULT_PACK_ICON;

  if (data.isAddon || data.packs.length > 1) {
    packTypeBadge.textContent = `Addon (${data.packs.length} gói con)`;
    packFileCount.innerHTML = `<i class="fa-solid fa-boxes-stacked text-emerald-400 mr-1"></i> ${data.packs.length} gói mod tích hợp`;
  } else {
    packTypeBadge.textContent = 'MCPE Pack';
    packFileCount.innerHTML = `<i class="fa-solid fa-box text-emerald-400 mr-1"></i> 1 gói mod`;
  }

  packLangLines.innerHTML = `<i class="fa-solid fa-font text-emerald-400 mr-1"></i> ${data.totalLines} dòng .lang`;
  packScriptLines.innerHTML = `<i class="fa-brands fa-js text-amber-400 mr-1"></i> ${data.totalScriptLines} menu/tin nhắn JS`;
  if (packManifestLines) {
    packManifestLines.innerHTML = `<i class="fa-solid fa-gear text-purple-400 mr-1"></i> ${data.totalManifestLines || 0} menu ngoài map`;
  }
  packUiLines.innerHTML = `<i class="fa-solid fa-window-restore text-cyan-400 mr-1"></i> ${data.totalUiLines} nhãn UI`;
}

async function startTranslation() {
  if (!currentSessionId) {
    alert('Vui lòng chọn file mod trước.');
    return;
  }

  if (!currentUser) {
    pendingStartAfterAuth = true;
    openAuthModal('login');
    return;
  }

  if (!isVipActive && linkGateConfig?.enabled && !linkGateToken) {
    btnOpenShortlink.href = linkGateConfig.shortlinkUrl || '#';
    linkGateNote.textContent = linkGateConfig.note || 'Hoàn thành bước vượt link rồi nhập mã mở khóa.';
    linkGateModal.classList.remove('hidden');
    return;
  }

  launchTranslation();
}

function launchTranslation() {
  if (!currentSessionId) return;

  const selectedEngine = document.querySelector('input[name="engine"]:checked').value;
  const apiKey = geminiApiKey.value.trim();
  const targetLang = targetLanguageSelect.value;
  const overwrite = overwriteEnUs.checked;
  const doScripts = translateScripts.checked;
  const doUi = translateUi.checked;

  if (selectedEngine === 'gemini' && !apiKey && !isVipActive) {
    alert('Vui lòng nhập Google Gemini API Key, hoặc nâng cấp VIP, hoặc chọn Google Dịch (Miễn phí)!');
    geminiApiKey.focus();
    return;
  }

  configSection.classList.add('hidden');
  progressSection.classList.remove('hidden');
  resultSection.classList.add('hidden');

  currentEngineLabel.textContent = selectedEngine === 'gemini' ? 'Google Gemini 2.0 AI' : 'Google Translate';
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  progressCounts.textContent = 'Chuẩn bị kết nối...';
  progressCurrentItem.textContent = 'Đang phân tích các dòng văn bản, tin nhắn & menu...';

  // Clear and initialize terminal stream
  if (terminalStreamBox) {
    terminalStreamBox.innerHTML = '';
    appendTerminalLog('Bắt đầu kết nối luồng dịch thời gian thực...', 'info');
  }

  // Load a fresh random quiz
  loadRandomQuiz();

  const token = localStorage.getItem('mcpe_auth_token') || '';
  const url = `/api/translate-stream?sessionId=${encodeURIComponent(currentSessionId)}&engine=${encodeURIComponent(selectedEngine)}&apiKey=${encodeURIComponent(apiKey)}&targetLang=${encodeURIComponent(targetLang)}&overwriteSource=${overwrite}&translateScripts=${doScripts}&translateUi=${doUi}&gateToken=${encodeURIComponent(linkGateToken)}`;

  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(url);

  eventSource.addEventListener('start', (e) => {
    const data = JSON.parse(e.data);
    progressCounts.textContent = `Đã xử lý: 0 / ${data.totalLines} chuỗi`;
    appendTerminalLog(`Khởi động phiên dịch! Tổng cộng: ${data.totalLines} chuỗi cần dịch.`, 'info');
    if (data.isVip) {
      vipActiveBadge.classList.remove('hidden');
      appendTerminalLog('Kích hoạt băng thông ưu tiên VIP siêu tốc!', 'success');
    }
  });

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    progressBar.style.width = `${data.percent}%`;
    progressPercent.textContent = `${data.percent}%`;
    progressCounts.textContent = `Đã xử lý: ${data.current} / ${data.total} chuỗi`;
    if (data.currentItem) {
      progressCurrentItem.textContent = data.currentItem;
      appendTerminalLog(data.currentItem, 'item');
    }
  });

  eventSource.addEventListener('complete', (e) => {
    const data = JSON.parse(e.data);
    eventSource.close();
    eventSource = null;
    appendTerminalLog(`Hoàn tất xuất sắc toàn bộ ${data.totalTranslated} chuỗi!`, 'success');
    playFanfareSound();
    handleTranslationComplete(data);
  });

  eventSource.addEventListener('error', (e) => {
    eventSource.close();
    eventSource = null;
    alert('Có lỗi xảy ra trong quá trình dịch thuật. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.');
    resetToUpload();
  });
}

function handleTranslationComplete(data) {
  progressSection.classList.add('hidden');
  resultSection.classList.remove('hidden');

  resTotalLines.textContent = data.totalTranslated;
  btnDownload.href = `/api/download/${currentSessionId}`;

  // Stop background music when complete
  stopChillMusic();

  const countdownSec = monetizationConfig?.downloadGate?.countdownSeconds ?? 5;
  if (!isVipActive && countdownSec > 0) {
    countdownBox.classList.remove('hidden');
    btnDownload.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');

    let remaining = countdownSec;
    countdownTimer.textContent = remaining;

    const timerInterval = setInterval(() => {
      remaining--;
      countdownTimer.textContent = remaining;

      if (remaining <= 0) {
        clearInterval(timerInterval);
        countdownBox.classList.add('hidden');
        btnDownload.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
      }
    }, 1000);
  } else {
    countdownBox.classList.add('hidden');
    btnDownload.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
  }

  reviewDataCache = data.reviewData || [];
  renderReviewTable(reviewDataCache);
}

function renderReviewTable(items) {
  reviewTableBody.innerHTML = '';

  if (items.length === 0) {
    reviewTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Không tìm thấy dòng ngôn ngữ hay menu nào.</td></tr>`;
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-800/40 transition-colors group';

    let badge = '';
    if (item.type === 'manifest') {
      badge = `<span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold"><i class="fa-solid fa-gear mr-1"></i>MANIFEST</span>`;
    } else if (item.type === 'script') {
      badge = `<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold"><i class="fa-brands fa-js mr-1"></i>MENU JS</span>`;
    } else if (item.type === 'ui') {
      badge = `<span class="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold"><i class="fa-solid fa-window-restore mr-1"></i>JSON UI</span>`;
    } else {
      badge = `<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold"><i class="fa-solid fa-language mr-1"></i>.LANG</span>`;
    }

    tr.innerHTML = `
      <td class="py-2.5 px-4 whitespace-nowrap">
        ${badge}
      </td>
      <td class="py-2.5 px-4 text-gray-400 font-mono text-[11px] truncate max-w-[200px]" title="${item.key}">
        ${escapeHtml(item.key)}
      </td>
      <td class="py-2.5 px-4 text-gray-300 font-sans text-xs">
        ${renderColorCodes(item.original)}
      </td>
      <td class="py-1 px-4">
        <div class="relative flex items-center">
          <input type="text" value="${escapeHtml(item.translated)}" 
                 data-type="${item.type || 'lang'}"
                 data-pidx="${item.pIdx}" data-fidx="${item.fIdx}" data-eidx="${item.eIdx}"
                 class="editable-input w-full bg-gray-950/80 border border-transparent hover:border-gray-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-sans transition-all">
          <span class="save-status absolute right-2 text-emerald-400 text-xs opacity-0 transition-opacity pointer-events-none">
            <i class="fa-solid fa-check"></i>
          </span>
        </div>
      </td>
    `;

    reviewTableBody.appendChild(tr);
  });

  const inputs = reviewTableBody.querySelectorAll('.editable-input');
  inputs.forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const type = e.target.dataset.type;
      const pIdx = parseInt(e.target.dataset.pidx);
      const fIdx = parseInt(e.target.dataset.fidx);
      const eIdx = parseInt(e.target.dataset.eidx);
      const newValue = e.target.value;
      const statusIcon = e.target.parentElement.querySelector('.save-status');

      try {
        const res = await authFetch('/api/update-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            type,
            pIdx,
            fIdx,
            eIdx,
            newValue
          })
        });

        if (res.ok) {
          statusIcon.classList.remove('opacity-0');
          setTimeout(() => statusIcon.classList.add('opacity-0'), 1500);
        }
      } catch (err) {
        console.error('Update entry error:', err);
      }
    });
  });
}

function setupTableSearch() {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderReviewTable(reviewDataCache);
      return;
    }

    const filtered = reviewDataCache.filter(item => {
      return item.key.toLowerCase().includes(q) ||
             item.original.toLowerCase().includes(q) ||
             item.translated.toLowerCase().includes(q);
    });

    renderReviewTable(filtered);
  });
}

function renderColorCodes(str) {
  if (!str) return '';
  let escaped = escapeHtml(str);
  escaped = escaped.replace(/§([0-9a-gk-or])/gi, (match, code) => {
    return `<span class="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">§${code}</span>`;
  });
  return escaped;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resetToUpload() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  currentSessionId = null;
  currentInspectionData = null;
  reviewDataCache = [];
  stopChillMusic();

  uploadSection.classList.remove('hidden');
  configSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  resultSection.classList.add('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
