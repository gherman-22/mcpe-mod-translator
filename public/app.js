// Frontend logic for MCPE Mod Auto-Translator with Monetization (VIP & VietQR Donation)

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
const authModal = document.getElementById('authModal');
const authModalTitle = document.getElementById('authModalTitle');
const authModalHint = document.getElementById('authModalHint');
const btnAuthLoginTab = document.getElementById('btnAuthLoginTab');
const btnAuthRegisterTab = document.getElementById('btnAuthRegisterTab');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const accountInfo = document.getElementById('accountInfo');
const accountEmail = document.getElementById('accountEmail');
const accountVipStatus = document.getElementById('accountVipStatus');
const btnLogout = document.getElementById('btnLogout');
const vipNavLabel = document.getElementById('vipNavLabel');
const vipModal = document.getElementById('vipModal');
const vipKeyInput = document.getElementById('vipKeyInput');
const btnVerifyVip = document.getElementById('btnVerifyVip');
const vipContactInfo = document.getElementById('vipContactInfo');

const linkGateModal = document.getElementById('linkGateModal');
const btnOpenShortlink = document.getElementById('btnOpenShortlink');
const linkGateNote = document.getElementById('linkGateNote');
const linkGatePasscode = document.getElementById('linkGatePasscode');
const btnVerifyLinkGate = document.getElementById('btnVerifyLinkGate');

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

function init() {
  setupDragAndDrop();
  setupConfigListeners();
  setupTableSearch();
  setupModals();
  loadMonetizationConfig();
  loadLinkGateConfig();
  loadCurrentUser();
  setupAuth();
  refreshVipStatus();
  vipRefreshTimer = setInterval(refreshVipStatus, 60 * 1000);
}

async function loadMonetizationConfig() {
  try {
    const res = await fetch('/api/monetization/config');
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
        vipContactInfo.textContent = monetizationConfig.vipSystem.contactInfo || '';
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
    const res = await fetch('/api/auth/me');
    if (!res.ok) return setCurrentUser(null);
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
  vipNavLabel.textContent = isVipActive ? 'VIP Đang Hoạt Động' : 'Kích Hoạt VIP';
  vipActiveBadge.classList.toggle('hidden', !isVipActive);
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
    accountStatusBadge.textContent = 'VIP';
    accountStatusText.textContent = `${formatVipRemaining(currentUser.vipUntil)} • Hết hạn ${new Date(currentUser.vipUntil).toLocaleString('vi-VN')}`;
    btnStatusAction.innerHTML = '<i class="fa-solid fa-user-gear mr-1"></i> Tài khoản';
  } else {
    accountStatusIcon.className = 'w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400';
    accountStatusIcon.innerHTML = '<i class="fa-solid fa-user-check"></i>';
    accountStatusTitle.textContent = currentUser.email;
    accountStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-800 text-gray-300 border-gray-700';
    accountStatusBadge.textContent = 'CHƯA CÓ VIP';
    accountStatusText.textContent = 'Tài khoản thường • Khi bắt đầu dịch, bạn sẽ cần vượt link để mở khóa.';
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
    translationAccessTitle.textContent = 'VIP đang hoạt động — dịch ngay';
    translationAccessText.textContent = `${formatVipRemaining(currentUser.vipUntil)}. Bạn không cần vượt link trước khi dịch.`;
  } else {
    translationAccessIcon.className = 'fa-solid fa-link text-emerald-400 mt-0.5';
    translationAccessTitle.textContent = 'Tài khoản thường — cần vượt link';
    translationAccessText.textContent = 'Bấm Bắt đầu dịch để mở bước vượt link. Sau khi xác nhận mã, bạn sẽ được phép dịch trong thời gian đã cấu hình.';
  }
}

async function refreshVipStatus() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) {
      setCurrentUser(null);
      return;
    }
    const data = await res.json();
    setCurrentUser(data.user || null);
  } catch {}
}

async function loadLinkGateConfig() {
  try {
    const res = await fetch('/api/link-gate/config');
    linkGateConfig = await res.json();
  } catch {
    linkGateConfig = { enabled: false };
  }
}

function setAuthMode(mode) {
  const register = mode === 'register';
  authModalTitle.textContent = register ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản';
  authModalHint.textContent = register
    ? 'Tạo tài khoản để lưu VIP trên server.'
    : 'VIP được lưu theo tài khoản và không phụ thuộc trình duyệt.';
  btnAuthSubmit.textContent = register ? 'Đăng ký' : 'Đăng nhập';
  authPassword.autocomplete = register ? 'new-password' : 'current-password';
  btnAuthLoginTab.className = register ? 'py-2 rounded-lg text-gray-400 hover:text-white text-sm font-semibold' : 'py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold';
  btnAuthRegisterTab.className = register ? 'py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold' : 'py-2 rounded-lg text-gray-400 hover:text-white text-sm font-semibold';
  authForm.dataset.mode = register ? 'register' : 'login';
}

function openAuthModal(mode = 'login') {
  authModal.classList.remove('hidden');
  if (currentUser) {
    authForm.classList.add('hidden');
    accountInfo.classList.remove('hidden');
    accountEmail.textContent = currentUser.email;
    accountVipStatus.textContent = currentUser.isVip
      ? `VIP đến ${new Date(currentUser.vipUntil).toLocaleString('vi-VN')}`
      : 'Tài khoản thường — chưa có VIP';
  } else {
    authForm.classList.remove('hidden');
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

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = authForm.dataset.mode || 'login';
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail.value.trim(), password: authPassword.value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể xác thực.');
      setCurrentUser(data.user);
      authModal.classList.add('hidden');
      authEmail.value = '';
      authPassword.value = '';
      if (pendingStartAfterAuth && currentSessionId) {
        pendingStartAfterAuth = false;
        setTimeout(startTranslation, 120);
      } else {
        alert(mode === 'register' ? 'Đăng ký thành công!' : 'Đăng nhập thành công!');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  btnLogout.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    linkGateToken = '';
    pendingStartAfterAuth = false;
    authModal.classList.add('hidden');
    alert('Đã đăng xuất.');
  });
}

function setupModals() {
  // Open VIP modal
  btnOpenVipModal.addEventListener('click', () => {
    if (!currentUser) return openAuthModal('login');
    vipModal.classList.remove('hidden');
  });

  // Open Donate modal
  btnOpenDonateModal.addEventListener('click', () => {
    donateModal.classList.remove('hidden');
  });

  if (btnTipFromSuccess) {
    btnTipFromSuccess.addEventListener('click', () => {
      donateModal.classList.remove('hidden');
    });
  }

  // Close modals
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
  });

  // Copy account number
  btnCopyAcc.addEventListener('click', () => {
    const acc = bankAccDisplay.textContent;
    navigator.clipboard.writeText(acc).then(() => {
      const orig = btnCopyAcc.innerHTML;
      btnCopyAcc.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i>';
      setTimeout(() => btnCopyAcc.innerHTML = orig, 1500);
    });
  });

  // Verify VIP
  btnVerifyVip.addEventListener('click', async () => {
    if (!currentUser) {
      vipModal.classList.add('hidden');
      return openAuthModal('login');
    }

    const key = vipKeyInput.value.trim();
    if (!key) return alert('Vui lòng nhập mã VIP Key!');

    try {
      const res = await fetch('/api/monetization/verify-vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();

      if (!res.ok) return alert(data.message || 'VIP Key không chính xác!');

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
    const res = await fetch('/api/link-gate/verify', {
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
  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.mcpack') && !ext.endsWith('.mcaddon') && !ext.endsWith('.zip')) {
    alert('Định dạng không hợp lệ! Vui lòng chọn file .mcpack, .mcaddon hoặc .zip');
    return;
  }

  uploadLoader.classList.remove('hidden');

  const formData = new FormData();
  formData.append('modFile', file);

  try {
    const response = await fetch('/api/inspect', {
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
  packScriptLines.innerHTML = `<i class="fa-brands fa-js text-amber-400 mr-1"></i> ${data.totalScriptLines} menu JS`;
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
  progressCurrentItem.textContent = 'Đang phân tích các dòng văn bản & menu...';

  const url = `/api/translate-stream?sessionId=${encodeURIComponent(currentSessionId)}&engine=${encodeURIComponent(selectedEngine)}&apiKey=${encodeURIComponent(apiKey)}&targetLang=${encodeURIComponent(targetLang)}&overwriteSource=${overwrite}&translateScripts=${doScripts}&translateUi=${doUi}&gateToken=${encodeURIComponent(linkGateToken)}`;

  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(url);

  eventSource.addEventListener('start', (e) => {
    const data = JSON.parse(e.data);
    progressCounts.textContent = `Đã xử lý: 0 / ${data.totalLines} chuỗi`;
    if (data.isVip) {
      vipActiveBadge.classList.remove('hidden');
    }
  });

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    progressBar.style.width = `${data.percent}%`;
    progressPercent.textContent = `${data.percent}%`;
    progressCounts.textContent = `Đã xử lý: ${data.current} / ${data.total} chuỗi`;
    if (data.currentItem) {
      progressCurrentItem.textContent = data.currentItem;
    }
  });

  eventSource.addEventListener('complete', (e) => {
    const data = JSON.parse(e.data);
    eventSource.close();
    eventSource = null;

    handleTranslationComplete(data);
  });

  eventSource.addEventListener('error', (e) => {
    eventSource.close();
    eventSource = null;
    alert('Có lỗi xảy ra trong quá trình dịch thuật. Vui lòng kiểm tra lại kết nối mạng hoặc API key.');
    resetToUpload();
  });
}

function handleTranslationComplete(data) {
  progressSection.classList.add('hidden');
  resultSection.classList.remove('hidden');

  resTotalLines.textContent = data.totalTranslated;
  btnDownload.href = `/api/download/${currentSessionId}`;

  // Handle Download Gate (Monetization countdown)
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
    if (item.type === 'script') {
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
      <td class="py-2.5 px-4 text-gray-400 font-mono text-[11px] truncate max-w-[180px]" title="${item.key}">
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
        const res = await fetch('/api/update-entry', {
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

  uploadSection.classList.remove('hidden');
  configSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  resultSection.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
