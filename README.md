# 🎮 MCPE Mod & Menu Auto-Translator (Dịch Mod, Addon & Menu Minecraft PE)

Ứng dụng Web toàn diện giúp tự động dịch **Mod, Addon, Giao diện Menu Custom và Script JavaScript** của **Minecraft Bedrock Edition (MCPE)** sang Tiếng Việt (hoặc bất kỳ ngôn ngữ nào) chỉ với 1 cú click!

---

## ✨ Tính Năng Nổi Bật

- 📦 **Hỗ trợ đầy đủ định dạng**: `.mcpack`, `.mcaddon`, `.zip`. Xử lý hoàn hảo cả addon đa pack lồng nhau (Resource Pack + Behavior Pack).
- 📜 **Dịch file ngôn ngữ chuẩn (`texts/*.lang`)**: Dịch tên vũ khí, giáp, khối, quặng, thực thể, enchant, lore mô tả...
- 🕹️ **Dịch Menu JavaScript (Bedrock Script API - `scripts/**/*.js`, `scripts/**/*.ts`)**:
  - Tự động nhận diện các form menu `@minecraft/server-ui`:
    - Tiêu đề menu (`form.title("...")`)
    - Mô tả nội dung (`form.body("...")`)
    - Các nút bấm chọn (`form.button("...")`)
    - Ô nhập văn bản, dropdown, toggle (`form.textField(...)`, `form.dropdown(...)`, `form.toggle(...)`)
    - Thông báo tin nhắn cho người chơi (`player.sendMessage("...")`, `setActionBar("...")`, `setTitle("...")`)
  - **Bảo toàn 100% logic code**: Chỉ dịch chuỗi hiển thị, tuyệt đối không đụng vào tên hàm, biến, câu lệnh điều kiện hay import!
- 🖼️ **Dịch Giao diện tùy chỉnh JSON UI (`ui/**/*.json`)**: Tự động dịch các nhãn hiển thị menu cứng trong file JSON UI (Shop UI, Custom HUD, Dialogs...).
- 🛡️ **Bảo vệ mã màu Minecraft & biến số**: Tự động nhận diện và bảo vệ nguyên vẹn các mã màu đặc trưng của Minecraft (`§0` - `§f`, `§a`, `§b`, `§c`, `§l`, `§r...`) và các biến định dạng (`%s`, `%d`, `{0}`, `\n`).
- 🤖 **Bộ máy dịch đa dạng**:
  - **Google Dịch Miễn Phí (Mặc định)**: Không cần đăng ký, không cần API Key, dịch nhanh chóng với cơ chế batch tối ưu.
  - **Google Gemini AI (Gemini 2.0 Flash)**: Hiểu sâu ngữ cảnh Minecraft, dịch chuẩn xác theo thuật ngữ chính thức của Minecraft Bedrock (Kiếm, Cúp, Phôi, Quặng, Phù phép...).
- ⚙️ **Tự động cấu hình chuẩn Bedrock**:
  - Tự động tạo file `texts/vi_VN.lang`.
  - Tự động cập nhật `texts/languages.json` để Minecraft nhận diện ngôn ngữ.
  - Tùy chọn **ghi đè song song lên `texts/en_US.lang`** (giúp mod hiển thị tiếng Việt ngay cả khi máy người chơi đang cài ngôn ngữ tiếng Anh).
- 🎬 **Video Thuyết Minh & Trình Chiếu Hệ Thống (`/video`)**:
  - Tích hợp video trình chiếu 6 cảnh chuẩn điện ảnh, có thuyết minh tiếng Việt chuẩn, sóng âm visualizer và phụ đề karaoke.
  - Tái hiện **cảnh AI trực tiếp lập trình** kiến trúc hệ thống (`server.js`, AST parsers, bộ bảo vệ mã màu §, SSE streaming).
  - Hỗ trợ xuất file video (`.webm` / `.mp4`) trực tiếp chỉ với 1 click từ trình duyệt!
- 👁️ **Giao diện trực quan & Chỉnh sửa trực tiếp**:
  - Phân loại rõ ràng nguồn chuỗi: `.LANG`, `MENU JS`, `JSON UI`.
  - Thanh tiến trình dịch thời gian thực (Server-Sent Events).
  - Bảng xem lại bản dịch cho phép **nhấp vào sửa trực tiếp từng dòng** trước khi tải về.

---

## 🚀 Hướng Dẫn Sử Dụng Nhanh

### 1. Khởi động ứng dụng
- **Cách 1 (Nhanh nhất)**: Nhấp đúp chuột vào file **`start.bat`**. Ứng dụng sẽ tự động khởi động và mở trình duyệt tại `http://localhost:2208`.
- **Cách 2 (Bằng dòng lệnh)**:
  ```bash
  cd C:\Users\vuong\.gemini\antigravity\scratch\mcpe-mod-translator
  node server.js
  ```

### 2. Dịch mod
1. Kéo & thả file mod (`.mcpack`, `.mcaddon`, `.zip`) vào trang web.
2. Hệ thống sẽ thống kê số dòng `.lang`, số chuỗi **Menu JS** và nhãn **JSON UI**.
3. Chọn ngôn ngữ muốn dịch (mặc định là **Tiếng Việt - vi_VN**).
4. Tích chọn các mục muốn dịch:
   - File ngôn ngữ chuẩn (`texts/*.lang`)
   - Menu JavaScript (`scripts/**/*.js`)
   - Giao diện tùy chỉnh (`ui/**/*.json`)
5. Bấm **"Bắt Đầu Dịch Tự Động"** và theo dõi thanh tiến trình.
6. Sau khi dịch xong, bạn có thể xem lại bản dịch trong bảng và chỉnh sửa nếu muốn.
7. Bấm **"Tải Về File Mod Đã Dịch"**.

---

## 📂 Cấu Trúc Mã Nguồn

```
mcpe-mod-translator/
├── server.js               # Máy chủ Express, API kiểm tra, dịch SSE và đóng gói file
├── services/
│   ├── archiveService.js   # Đọc, phân tích và đóng gói .mcpack / .mcaddon / .zip
│   ├── langParser.js       # Phân tích cú pháp file texts/*.lang và serialize lại
│   ├── scriptParser.js     # Trích xuất và thay thế chuỗi menu trong JavaScript Script API
│   ├── uiJsonParser.js     # Trích xuất và thay thế chuỗi nhãn trong JSON UI
│   ├── translator.js       # Tích hợp Google Translate & Gemini 2.0 Flash AI
│   └── mcDictionary.js     # Từ điển Minecraft & thuật toán bảo vệ mã màu §
├── public/
│   ├── index.html          # Giao diện Web hiện đại, responsive
│   ├── app.js              # Xử lý kéo thả, SSE live stream, bảng edit trực tiếp
│   └── style.css           # Hiệu ứng giao diện, dark mode Minecraft
├── test/
│   ├── verify.js           # Kiểm thử tự động hệ thống .lang
│   └── verify_menus.js     # Kiểm thử tự động hệ thống dịch JS Menu & JSON UI
├── start.bat               # File khởi động 1-click cho Windows
└── package.json            # Cấu hình thư viện Node.js
```

## 🔐 Tài khoản, VIP có thời hạn & vượt link

Phiên bản này đã thêm hệ thống tài khoản ở phía server:

- **Đăng ký / đăng nhập** bằng email + mật khẩu.
- Phiên đăng nhập dùng **HTTP-only cookie**, không lưu VIP bằng `localStorage`.
- VIP được lưu trong `data/users.json` bằng trường `vipUntil` nên khi đăng nhập lại hoặc đổi trình duyệt vẫn giữ thời hạn VIP.
- Mỗi VIP Key mặc định cộng **30 ngày**. Có thể đổi tại `monetization.vipSystem.defaultVipDays` trong `config.json`.
- Tài khoản VIP còn hạn được phép bắt đầu dịch trực tiếp.
- Tài khoản thường phải hoàn thành **link gate** trước khi bắt đầu dịch. Mã mở khóa được kiểm tra ở server và token vượt link có thời hạn theo `monetization.linkGate.passDurationMinutes`.
- API `/api/inspect`, `/api/translate-stream`, `/api/update-entry` và `/api/download/:sessionId` đều kiểm tra tài khoản/phiên sở hữu, nên không thể chỉ sửa giao diện để bỏ qua bước VIP.

### Cấu hình VIP

Trong `config.json`:

```json
"vipSystem": {
  "enabled": true,
  "keys": ["VIP-MCPE", "VIP-MCPE-PREMIUM", "VIP-PRO-MAX"],
  "defaultVipDays": 30,
  "contactInfo": "Liên hệ quản trị viên để nhận key VIP"
}
```

### Cấu hình vượt link

```json
"linkGate": {
  "enabled": true,
  "shortlinkUrl": "https://link1s.com/mcpe-key",
  "passcodes": ["MCPE2026", "MODVN888", "TRANSLATE123"],
  "passDurationMinutes": 60
}
```

`passcodes` chỉ được đọc ở server và **không được gửi xuống trình duyệt**.

### Chạy bản mới

Sau khi giải nén, chạy:

```bash
npm install
node server.js
```

Nếu triển khai public, nên đặt biến môi trường `JWT_SECRET` thành một chuỗi bí mật dài và đặt `ADMIN_TOKEN` để dùng API nâng VIP thủ công.


## Luồng tài khoản & VIP hiện tại

- **Chưa đăng nhập:** vẫn có thể tải file lên và xem thông tin mod. Khi bấm **Bắt đầu dịch**, hệ thống yêu cầu đăng nhập/đăng ký.
- **Đã đăng nhập, chưa có VIP:** khi bấm **Bắt đầu dịch**, modal **Mở khóa dịch miễn phí** xuất hiện. Người dùng mở trang vượt link, lấy mã rồi nhập mã để được cấp `gateToken` trong thời gian cấu hình.
- **Đã có VIP:** hệ thống kiểm tra `vipUntil` ở server. Nếu còn hạn thì dịch ngay, không cần vượt link.
- **VIP hết hạn:** tự động trở thành tài khoản thường và phải vượt link ở lần dịch tiếp theo.
- **VIP được lưu theo tài khoản:** dữ liệu nằm trong `data/users.json`, không dựa vào `localStorage`.
- **VIP Key cộng dồn thời gian:** nếu tài khoản còn 10 ngày và kích hoạt thêm 30 ngày, hạn mới thành 40 ngày.
- **Tự làm mới trạng thái:** giao diện kiểm tra tài khoản/VIP lại định kỳ để khi VIP hết hạn, UI chuyển về trạng thái tài khoản thường.

### Lưu ý khi triển khai

Đặt biến môi trường `JWT_SECRET` thành một chuỗi bí mật riêng khi chạy trên máy chủ thật. Có thể đặt `ADMIN_TOKEN` để sử dụng API cộng VIP cho tài khoản quản trị.

## Kho Mod (trang riêng, chỉ 1 admin duy nhất)

- Kho mod là trang index riêng: `/kho-mod` (file `public/kho-mod.html`). Ai cũng xem và bấm vào vật phẩm để mở link tải.
- Web chỉ có **một tài khoản admin duy nhất**, cấu hình bằng 2 biến môi trường: `ADMIN_EMAIL` và `ADMIN_PASSWORD` (mật khẩu tối thiểu 8 ký tự). Tài khoản này tách riêng khỏi user đăng ký, không cần đăng ký trước.
- Đăng nhập tại `/kho-mod` bằng nút "Admin". Chỉ phiên admin mới tạo/xóa được vật phẩm: `POST /api/mods` và `DELETE /api/mods/:id` trả 401 nếu không phải admin.
- Trên Render: thêm `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong mục Environment. Chạy local: điền 2 giá trị này ở đầu `start.bat` / `mo_web_online.bat`.
- Chưa đặt 2 biến này thì không ai đăng nhập admin được (không có mật khẩu mặc định).
