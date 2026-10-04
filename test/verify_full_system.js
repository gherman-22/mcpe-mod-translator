const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const ArchiveService = require('../services/archiveService');
const ScriptParser = require('../services/scriptParser');
const ManifestParser = require('../services/manifestParser');
const bcrypt = require('bcryptjs');

async function testFullSystem() {
  console.log('========================================================');
  console.log('🚀 KIỂM TRA TOÀN DIỆN CÁC YÊU CẦU SỬA ĐỔI');
  console.log('========================================================\n');

  // 1. Kiểm tra 5 Gói VIP trong config
  console.log('⭐ 1. KIỂM TRA CẤU HÌNH & TÍNH TOÁN 5 GÓI VIP...');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
  const tiers = config.monetization?.vipSystem?.tiers || [];
  console.log(`Tìm thấy ${tiers.length} gói VIP trong config:`);
  tiers.forEach(t => console.log(` - [${t.name}]: ${t.days} ngày, giá ${t.price}, keys: ${t.keys.join(', ')}`));

  if (tiers.length !== 5) {
    throw new Error(`Cần đúng 5 gói VIP, hiện có: ${tiers.length}`);
  }

  const expectedDays = [5, 15, 30, 150, 365];
  tiers.forEach((t, i) => {
    if (t.days !== expectedDays[i]) {
      throw new Error(`Gói ${t.name} có số ngày ${t.days}, mong đợi ${expectedDays[i]}`);
    }
  });
  console.log('✅ 5 Gói VIP đã được cấu hình chuẩn xác 100%!\n');

  // 2. Kiểm tra Authentication & Hash Password
  console.log('🔑 2. KIỂM TRA TÀI KHOẢN VÀ ĐĂNG NHẬP...');
  const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8'));
  const user = users[0];
  console.log(`Tài khoản trong data/users.json: ${user.email}`);

  // Test compare password '123456'
  const isMatch = bcrypt.compareSync('123456', user.passwordHash);
  console.log(`Mật khẩu 123456 khớp với passwordHash? ${isMatch ? 'CHÍNH XÁC ✅' : 'SAI ❌'}`);
  if (!isMatch) {
    throw new Error('Password check failed!');
  }
  console.log('✅ Xác thực tài khoản hoạt động hoàn hảo!\n');

  // 3. Kiểm tra trích xuất tin nhắn JS & Dropdown & Button1/2
  console.log('💬 3. KIỂM TRA DỊCH TIN NHẮN VÀ MENU TRONG JAVASCRIPT...');
  const sampleScript = `
    import { world } from "@minecraft/server";
    import { MessageFormData, ModalFormData } from "@minecraft/server-ui";

    function showDialog(player) {
      const msg = new MessageFormData();
      msg.title("Thông Báo Hệ Thống");
      msg.body("Bạn nhận được phần thưởng điểm danh hàng ngày!");
      msg.button1("Nhận Ngay");
      msg.button2("Để Sau");

      const modal = new ModalFormData();
      modal.title("Tùy Chọn Chế Độ");
      modal.dropdown("Chọn độ khó:", ["Dễ", "Vừa", "Khó", "Cực Khó"]);

      player.sendMessage("§aBạn đã mở rương thành công!§r");
      player.onScreenDisplay.setActionBar("§eĐiểm năng lượng: §a100%§r");
      world.sendMessage({ rawtext: [{ text: "§6[Server] Chúc người chơi may mắn!§r" }] });
    }
  `;

  const scriptEntries = ScriptParser.extractTranslatableStrings(sampleScript);
  console.log(`Trích xuất được ${scriptEntries.length} chuỗi UI & tin nhắn:`);
  scriptEntries.forEach(e => console.log(` - [${e.method}] => "${e.originalValue}"`));

  // Kiểm tra các trường tin nhắn quan trọng
  const hasMsg1 = scriptEntries.some(e => e.originalValue === 'Nhận Ngay');
  const hasMsg2 = scriptEntries.some(e => e.originalValue === 'Để Sau');
  const hasDropdown = scriptEntries.some(e => e.originalValue === 'Cực Khó');
  const hasChat = scriptEntries.some(e => e.originalValue.includes('mở rương thành công'));
  const hasRawtext = scriptEntries.some(e => e.originalValue.includes('Chúc người chơi may mắn'));

  if (!hasMsg1 || !hasMsg2 || !hasDropdown || !hasChat || !hasRawtext) {
    throw new Error('Chưa trích xuất đầy đủ các loại tin nhắn/dropdown/rawtext!');
  }
  console.log('✅ Trích xuất tất cả tin nhắn, dropdown, button1/button2 và rawtext thành công!\n');

  // 4. Kiểm tra trích xuất menu subpacks ngoài map trong manifest.json
  console.log('📜 4. KIỂM TRA DỊCH BẢNG MENU MANIFEST (SUBPACKS CÀI NGOÀI MAP)...');
  const manifestData = {
    format_version: 2,
    header: {
      name: "Super Magic UI & Weapons",
      description: "Mod vũ khí phép thuật và menu tùy chỉnh ngoài map",
      uuid: "11111111-2222-3333-4444-555555555555",
      version: [1, 0, 0]
    },
    subpacks: [
      {
        folder_name: "sub_3d",
        name: "Giao Diện 3D Nổi (Cài ngoài map)",
        memory_tier: 1
      },
      {
        folder_name: "sub_compact",
        name: "Giao Diện Tối Giản Cho Điện Thoại (Cài ngoài map)",
        memory_tier: 2
      }
    ]
  };

  const manifestResult = ManifestParser.extractTranslatableStrings(manifestData);
  console.log(`Tìm thấy ${manifestResult.entries.length} mục trong manifest.json:`);
  manifestResult.entries.forEach(e => console.log(` - [${e.field}] => "${e.originalValue}"`));

  if (manifestResult.entries.length !== 4) {
    throw new Error(`Mong đợi 4 mục trong manifest, tìm thấy ${manifestResult.entries.length}`);
  }
  console.log('✅ Trích xuất bảng menu Subpacks ngoài map từ manifest.json thành công!\n');

  // 5. Kiểm tra đóng gói & tạo file .mcpack hoàn chỉnh với ArchiveService
  console.log('📦 5. KIỂM TRA ĐÓNG GÓI HOÀN CHỈNH (MCPACK + MANIFEST + SCRIPTS + LANG)...');
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifestData, null, 2));
  zip.file('texts/en_US.lang', 'item.magic:wand.name=Magic Wand\n');
  zip.file('scripts/main.js', sampleScript);

  const packBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const inspection = await ArchiveService.inspectArchive(packBuffer, 'test_addon.mcpack');

  console.log(`Kết quả Inspect Archive:`);
  console.log(` - Số pack: ${inspection.packs.length}`);
  console.log(` - Tổng dòng .lang: ${inspection.totalLines}`);
  console.log(` - Tổng menu/tin nhắn JS: ${inspection.totalScriptLines}`);
  console.log(` - Tổng menu ngoài map (manifest): ${inspection.totalManifestLines}`);
  console.log(` - Tổng toàn bộ: ${inspection.grandTotal}`);

  if (inspection.totalManifestLines !== 4 || inspection.totalScriptLines === 0) {
    throw new Error('Inspect Archive không nhận diện được manifest lines!');
  }

  // Giả lập dịch 1 subpack menu
  inspection.packs[0].manifestEntries[2].translatedValue = "Giao Diện 3D Nổi [Tiếng Việt]";
  const repackedBuffer = await ArchiveService.repackArchive({
    originalBuffer: packBuffer,
    filename: 'test_addon.mcpack',
    translatedPacks: inspection.packs,
    targetLangCode: 'vi_VN',
    overwriteSource: true,
    includeScripts: true,
    includeUi: true
  });

  const repackedZip = await JSZip.loadAsync(repackedBuffer);
  const repackedManifestText = await repackedZip.file('manifest.json').async('text');
  const repackedManifest = JSON.parse(repackedManifestText);

  console.log(`Subpack sau khi repack: "${repackedManifest.subpacks[0].name}"`);
  if (repackedManifest.subpacks[0].name !== "Giao Diện 3D Nổi [Tiếng Việt]") {
    throw new Error('Repack manifest không lưu được chuỗi dịch của subpack!');
  }

  console.log('✅ Repack lưu chính xác bản dịch subpacks vào manifest.json!');
  console.log('\n========================================================');
  console.log('🎉 TẤT CẢ 5 HẠNG MỤC TEST HOÀN TOÀN THÀNH CÔNG 100%!');
  console.log('========================================================');
}

testFullSystem().catch(err => {
  console.error('❌ Thất bại:', err);
  process.exit(1);
});
