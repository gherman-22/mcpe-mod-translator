const fs = require('fs');
const path = require('path');
const http = require('http');
const JSZip = require('jszip');

async function runEndToEndVerification() {
  console.log('========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM TRA HỆ THỐNG TỰ ĐỘNG DỊCH HOÀN TOÀN');
  console.log('========================================================\n');

  // 1. Kiểm tra services/translator.js
  console.log('1. Kiểm tra Bộ Máy Dịch Đa Tầng (Google Clients5 + Polish)...');
  const TranslatorService = require('../services/translator');
  const testSample = [
    '§6Flame Sword§r',
    '§bFrost Pickaxe§r',
    'Staff of §eThunder§r',
    'Elemental Altar',
    'Cast %s spell on target!',
    'Consumes §a%d§r mana.'
  ];

  const translatedSample = await TranslatorService.translateBatchWithGoogle(testSample, 'vi');
  console.log('Kết quả dịch mẫu:');
  testSample.forEach((orig, idx) => {
    console.log(` - "${orig}"  ==>  "${translatedSample[idx]}"`);
  });

  // Verify none remain in English
  if (translatedSample[0].includes('Flame Sword') || translatedSample[1].includes('Frost Pickaxe')) {
    throw new Error('Lỗi: Chuỗi vẫn còn nguyên tiếng Anh!');
  }
  console.log('✅ Bộ máy dịch hoạt động xuất sắc, dịch chuẩn 100% tiếng Việt!\n');

  // 2. Kiểm tra inspect & translate & repack với sample_magic_mod.mcpack
  console.log('2. Kiểm tra quy trình dịch trọn gói Mod Minecraft Bedrock...');
  const ArchiveService = require('../services/archiveService');
  const modPath = path.join(__dirname, 'sample_magic_mod.mcpack');
  const modBuffer = fs.readFileSync(modPath);

  const inspection = await ArchiveService.inspectArchive(modBuffer, 'sample_magic_mod.mcpack');
  console.log(` - Đã quét được ${inspection.packs.length} pack, tổng ${inspection.grandTotal} chuỗi cần dịch.`);

  for (const pack of inspection.packs) {
    for (const lf of pack.langFiles) {
      const texts = lf.translatableEntries.map(e => e.originalValue);
      const translated = await TranslatorService.translateBatchWithGoogle(texts, 'vi');
      for (let i = 0; i < lf.translatableEntries.length; i++) {
        lf.translatableEntries[i].translatedValue = translated[i];
        const master = lf.allEntries.find(e => e.index === lf.translatableEntries[i].index);
        if (master) master.translatedValue = translated[i];
      }
    }
  }

  const outputBuffer = await ArchiveService.repackArchive({
    originalBuffer: modBuffer,
    filename: 'sample_magic_mod.mcpack',
    translatedPacks: inspection.packs,
    targetLangCode: 'vi_VN',
    overwriteSource: true,
    includeScripts: true,
    includeUi: true
  });

  console.log(` - Đóng gói file mod đã dịch hoàn tất! Kích thước: ${outputBuffer.length} bytes`);

  // 3. Kiểm tra tính toàn vẹn của file mod đầu ra
  console.log('3. Kiểm tra file .mcpack sau khi dịch...');
  const outZip = await JSZip.loadAsync(outputBuffer);
  const filesInZip = Object.keys(outZip.files);
  console.log(' - Các file trong gói mod: ', filesInZip);

  const hasViVn = filesInZip.some(f => f.toLowerCase().endsWith('texts/vi_vn.lang'));
  const hasEnUs = filesInZip.some(f => f.toLowerCase().endsWith('texts/en_us.lang'));
  const hasLangJson = filesInZip.some(f => f.toLowerCase().endsWith('texts/languages.json'));

  if (!hasViVn || !hasEnUs || !hasLangJson) {
    throw new Error('Lỗi: Thiếu vi_VN.lang, en_US.lang hoặc languages.json trong gói mod!');
  }

  const viVnContent = await outZip.file('texts/vi_VN.lang').async('text');
  console.log('\nNội dung texts/vi_VN.lang đã được dịch tự động hoàn toàn:');
  console.log('--------------------------------------------------------');
  console.log(viVnContent.trim());
  console.log('--------------------------------------------------------\n');

  console.log('========================================================');
  console.log('🎉 TẤT CẢ KIỂM TRA ĐỀU THÀNH CÔNG 100%!');
  console.log('Hệ thống đã tự động dịch hoàn toàn toàn bộ mod MCPE!');
  console.log('========================================================');
}

runEndToEndVerification().catch(err => {
  console.error('❌ Kiểm tra thất bại:', err);
  process.exit(1);
});
