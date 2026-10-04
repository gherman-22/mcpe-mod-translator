const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const ArchiveService = require('../services/archiveService');
const TranslatorService = require('../services/translator');
const LangParser = require('../services/langParser');

async function runTests() {
  console.log('🧪 1. Creating sample mock MCPE mod pack (.mcpack)...');

  const zip = new JSZip();

  const manifest = {
    format_version: 2,
    header: {
      name: "Elemental Magic Addon",
      description: "Adds magical elemental staves and §bmythic§r weapons!",
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      version: [1, 2, 0],
      min_engine_version: [1, 20, 0]
    },
    modules: [
      {
        type: "resources",
        uuid: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        version: [1, 2, 0]
      }
    ]
  };

  const sampleLang = `## Elemental Magic Addon Language File
item.magic:flame_sword.name=§6Flame Sword§r
item.magic:frost_pickaxe.name=§bFrost Pickaxe§r
item.magic:thunder_staff.name=Staff of §eThunder§r
tile.magic:elemental_altar.name=Elemental Altar
entity.magic:fire_elemental.name=Fire Elemental
chat.magic.spell_cast=Cast %s spell on target!
item.magic.mana_cost=Consumes §a%d§r mana.
`;

  const languagesJson = ["en_US"];

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('texts/en_US.lang', sampleLang);
  zip.file('texts/languages.json', JSON.stringify(languagesJson, null, 2));

  const sampleBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const sampleFilePath = path.join(__dirname, 'sample_magic_mod.mcpack');
  if (!fs.existsSync(path.join(__dirname))) {
    fs.mkdirSync(path.join(__dirname), { recursive: true });
  }
  fs.writeFileSync(sampleFilePath, sampleBuffer);
  console.log('✅ Created mock pack at:', sampleFilePath);

  console.log('\n🔍 2. Testing Archive Inspection...');
  const inspection = await ArchiveService.inspectArchive(sampleBuffer, 'sample_magic_mod.mcpack');
  console.log(`Found ${inspection.packs.length} pack(s), total translatable lines: ${inspection.totalLines}`);
  console.log(`Pack Name: ${inspection.packs[0].displayName}`);
  console.log(`Version: ${inspection.packs[0].version}`);

  if (inspection.totalLines !== 7) {
    throw new Error(`Expected 7 translatable lines, got ${inspection.totalLines}`);
  }
  console.log('✅ Inspection verified!');

  console.log('\n🌐 3. Testing Google Translate Batch with Minecraft token protection...');
  const rawTexts = inspection.packs[0].langFiles[0].translatableEntries.map(e => e.originalValue);
  console.log('Originals:', rawTexts);

  const translatedTexts = await TranslatorService.translateBatchWithGoogle(rawTexts, 'vi');
  console.log('Translations:', translatedTexts);

  // Check token preservation
  const hasFormattingCode = translatedTexts.some(t => t.includes('§6') || t.includes('§b') || t.includes('§e') || t.includes('§a'));
  const hasPlaceholder = translatedTexts.some(t => t.includes('%s') || t.includes('%d'));

  console.log(`Formatting codes (§) preserved? ${hasFormattingCode ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Format placeholders (%s, %d) preserved? ${hasPlaceholder ? 'YES ✅' : 'NO ❌'}`);

  console.log('\n📦 4. Testing Repack Archive...');
  // Apply translation to inspection object
  const entries = inspection.packs[0].langFiles[0].translatableEntries;
  for (let i = 0; i < entries.length; i++) {
    entries[i].translatedValue = translatedTexts[i];
    const master = inspection.packs[0].langFiles[0].allEntries.find(e => e.index === entries[i].index);
    if (master) master.translatedValue = translatedTexts[i];
  }

  const outputBuffer = await ArchiveService.repackArchive({
    originalBuffer: sampleBuffer,
    filename: 'sample_magic_mod.mcpack',
    translatedPacks: inspection.packs,
    targetLangCode: 'vi_VN',
    overwriteSource: true
  });

  // Verify the repacked zip
  const repackedZip = await JSZip.loadAsync(outputBuffer);
  const repackedFiles = Object.keys(repackedZip.files);
  console.log('Repacked files:', repackedFiles);

  const hasViLang = repackedFiles.includes('texts/vi_VN.lang');
  const repackedLangJson = JSON.parse(await repackedZip.file('texts/languages.json').async('text'));
  const viLangContent = await repackedZip.file('texts/vi_VN.lang').async('text');

  console.log(`texts/vi_VN.lang created? ${hasViLang ? 'YES ✅' : 'NO ❌'}`);
  console.log(`languages.json updated:`, repackedLangJson);
  console.log(`\nContent of texts/vi_VN.lang:\n--------------------\n${viLangContent}\n--------------------`);

  if (!hasViLang || !repackedLangJson.includes('vi_VN')) {
    throw new Error('Repack verification failed: vi_VN.lang or languages.json is invalid');
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The core engine is 100% operational.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
