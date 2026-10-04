const ScriptParser = require('../services/scriptParser');
const ManifestParser = require('../services/manifestParser');
const ArchiveService = require('../services/archiveService');

console.log('🧪 Testing ScriptParser enhanced message extraction...');

const sampleJs = `
import { world } from "@minecraft/server";
import { MessageFormData, ModalFormData, ActionFormData } from "@minecraft/server-ui";

function testMessage(player) {
  // MessageFormData with button1 and button2
  const msgForm = new MessageFormData();
  msgForm.title("§eXác nhận giao dịch§r");
  msgForm.body("Bạn có chắc chắn muốn mua VIP không?");
  msgForm.button1("§aĐồng ý mua");
  msgForm.button2("§cHủy bỏ");

  // ModalFormData with dropdown options
  const modal = new ModalFormData();
  modal.title("Cài đặt Mod");
  modal.dropdown("Chọn độ khó:", ["Dễ (Easy)", "Bình thường (Normal)", "Khó (Hard)"], 1);

  // Chat message & onScreenDisplay
  player.sendMessage("§bChào mừng bạn đã vào server!");
  player.onScreenDisplay.setActionBar("§aĐiểm năng lượng: 100%");

  // RawText object in sendMessage
  world.sendMessage({ rawtext: [{ text: "§6[Thông báo toàn server] Boss đã xuất hiện!" }] });
}
`;

const extracted = ScriptParser.extractTranslatableStrings(sampleJs);
console.log(`Extracted ${extracted.length} strings from script:`);
extracted.forEach(e => console.log(` [${e.method}] => "${e.originalValue}"`));

const expectedMethods = [
  'title', 'body', 'button1', 'button2',
  'title', 'dropdown', 'dropdown.option', 'dropdown.option', 'dropdown.option',
  'sendMessage', 'setActionBar', 'rawtext.message'
];

for (const m of ['button1', 'button2', 'dropdown.option', 'rawtext.message', 'setActionBar']) {
  if (!extracted.some(e => e.method === m)) {
    throw new Error(`Missing expected method: ${m}`);
  }
}
console.log('✅ ScriptParser extracted all UI forms, dropdown options, and chat messages successfully!');

// Test ManifestParser
console.log('\n🧪 Testing ManifestParser (Subpacks & Menu ngoài map)...');
const sampleManifest = {
  format_version: 2,
  header: {
    name: "Master RPG Addon",
    description: "Epic RPG skills, dungeons and custom UI",
    uuid: "11111111-2222-3333-4444-555555555555",
    version: [1, 2, 0]
  },
  subpacks: [
    {
      folder_name: "default_ui",
      name: "Giao diện 3D RPG (Default)",
      memory_tier: 1
    },
    {
      folder_name: "compact_ui",
      name: "Giao diện Tối Giản Cho Điện Thoại Yếu",
      memory_tier: 2
    }
  ]
};

const manifestRes = ManifestParser.extractTranslatableStrings(sampleManifest);
console.log(`Found ${manifestRes.entries.length} translatable items in manifest:`);
manifestRes.entries.forEach(e => console.log(` [${e.field}] => "${e.originalValue}" (${e.label})`));

if (manifestRes.entries.length !== 4) {
  throw new Error(`Expected 4 manifest entries, found ${manifestRes.entries.length}`);
}

// Test serialize
manifestRes.entries[2].translatedValue = "Giao diện 3D RPG Đã Dịch";
const updatedJson = ManifestParser.serializeWithTranslations(manifestRes.parsed, manifestRes.entries);
const updatedObj = JSON.parse(updatedJson);
if (updatedObj.subpacks[0].name !== "Giao diện 3D RPG Đã Dịch") {
  throw new Error('Manifest serialization failed to update subpack name!');
}

console.log('✅ ManifestParser verified successfully!');
console.log('\n🎉 ALL NEW PARSER FEATURES ARE WORKING 100%!');
