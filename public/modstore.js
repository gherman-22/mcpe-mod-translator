/* Kho Mod: danh sách vật phẩm (tên + ảnh) -> bấm để mở link tải */
(function () {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = 'mcpe_admin_token';
  const authFetch = (url, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = Object.assign({}, options.headers || {});
    if (token) headers['X-Admin-Session'] = token;
    return fetch(url, Object.assign({}, options, { headers }));
  };
  let canManage = false;
  const createModal = $('modCreateModal'), loginModal = $('adminLoginModal');
  const grid = $('modGrid'), emptyMsg = $('modEmpty'), form = $('modCreateForm');
  const nameInput = $('modNameInput'), linkInput = $('modLinkInput'), imgInput = $('modImageInput');
  const preview = $('modImagePreview'), errBox = $('modCreateError'), saveBtn = $('modSaveBtn');
  let imageData = '';

  const needLogin = (msg) => {
    createModal.classList.add('hidden');
    alert(msg || 'Chỉ admin web mới có quyền thực hiện thao tác này.');
  };

  function applyAdminUi() {
    $('btnCreateMod').classList.toggle('hidden', !canManage);
    $('btnAdminLogin').classList.toggle('hidden', canManage);
    $('btnAdminLogout').classList.toggle('hidden', !canManage);
  }

  async function loadMods() {
    grid.innerHTML = '';
    emptyMsg.textContent = 'Đang tải...'; emptyMsg.classList.remove('hidden');
    try {
      const res = await authFetch('/api/mods', { cache: 'no-store' });
      const data = await res.json();
      canManage = !!data.canManage; applyAdminUi();
      render(data.mods || []);
    } catch { emptyMsg.textContent = 'Không tải được kho mod. Thử lại sau.'; }
  }

  function render(mods) {
    grid.innerHTML = '';
    emptyMsg.textContent = 'Chưa có vật phẩm nào.';
    emptyMsg.classList.toggle('hidden', mods.length > 0);
    mods.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'relative group flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/70 hover:border-emerald-500/50 transition-all p-2 pr-12 cursor-pointer';
      const img = document.createElement('img');
      img.src = m.image; img.alt = m.name; img.loading = 'lazy';
      img.className = 'w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg object-cover bg-gray-800';
      const title = document.createElement('div');
      title.className = 'min-w-0 text-left text-sm font-semibold text-gray-100 line-clamp-2';
      title.textContent = m.name;
      card.append(img, title);
      card.addEventListener('click', () => window.open(m.link, '_blank', 'noopener,noreferrer'));
      if (canManage) {
        const del = document.createElement('button');
        del.type = 'button'; del.title = 'Xóa vật phẩm';
        del.className = 'absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-gray-950/80 hover:bg-red-600 text-gray-200 text-xs';
        del.innerHTML = '<i class="fa-solid fa-trash"></i>';
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Xóa vật phẩm "${m.name}"?`)) return;
          const r = await authFetch('/api/mods/' + encodeURIComponent(m.id), { method: 'DELETE' });
          if (r.status === 401 || r.status === 403) return needLogin();
          if (!r.ok) return alert('Không xóa được vật phẩm.');
          loadMods();
        });
        card.append(del);
      }
      grid.append(card);
    });
  }

  // Nén ảnh về tối đa 480px (JPEG) để lưu nhẹ
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 480 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      im.src = url;
    });
  }

  imgInput.addEventListener('change', async () => {
    const f = imgInput.files[0];
    imageData = ''; preview.classList.add('hidden');
    if (!f) return;
    if (!f.type.startsWith('image/')) { errBox.textContent = 'Vui lòng chọn file ảnh.'; return; }
    try {
      imageData = await compressImage(f);
      preview.src = imageData; preview.classList.remove('hidden'); errBox.textContent = '';
    } catch { errBox.textContent = 'Không đọc được ảnh này.'; }
  });

  $('btnCloseModCreate').addEventListener('click', () => createModal.classList.add('hidden'));
  createModal.addEventListener('click', (e) => { if (e.target === createModal) createModal.classList.add('hidden'); });

  $('btnCreateMod').addEventListener('click', () => {
    form.reset(); imageData = ''; preview.classList.add('hidden'); errBox.textContent = '';
    createModal.classList.remove('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    const name = nameInput.value.trim(), link = linkInput.value.trim();
    if (!name) return (errBox.textContent = 'Vui lòng nhập tên vật phẩm.');
    if (!imageData) return (errBox.textContent = 'Vui lòng chọn ảnh vật phẩm.');
    if (!/^https?:\/\//i.test(link)) return (errBox.textContent = 'Link tải phải bắt đầu bằng http:// hoặc https://');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';
    try {
      const res = await authFetch('/api/mods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image: imageData, link })
      });
      if (res.status === 401 || res.status === 403) return needLogin();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return (errBox.textContent = data.message || 'Không lưu được vật phẩm.');
      createModal.classList.add('hidden');
      loadMods();
    } catch { errBox.textContent = 'Lỗi kết nối, thử lại.'; }
    finally { saveBtn.disabled = false; saveBtn.textContent = 'Lưu'; }
  });

  // ---- Đăng nhập / đăng xuất admin ----
  $('btnAdminLogin').addEventListener('click', () => { $('adminLoginError').textContent = ''; loginModal.classList.remove('hidden'); });
  $('btnCloseAdminLogin').addEventListener('click', () => loginModal.classList.add('hidden'));
  $('btnAdminLogout').addEventListener('click', async () => {
    localStorage.removeItem(TOKEN_KEY); loadMods();
  });
  $('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('adminLoginError'); err.textContent = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('adminEmail').value.trim(), password: $('adminPassword').value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) return (err.textContent = data.message || 'Đăng nhập thất bại.');
      localStorage.setItem(TOKEN_KEY, data.token);
      $('adminPassword').value = '';
      loginModal.classList.add('hidden');
      loadMods();
    } catch { err.textContent = 'Lỗi kết nối, thử lại.'; }
  });

  loadMods();
})();
