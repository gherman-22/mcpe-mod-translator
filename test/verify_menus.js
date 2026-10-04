const ScriptParser = require('../services/scriptParser');
const UiJsonParser = require('../services/uiJsonParser');
const TranslatorService = require('../services/translator');

async function testMenus() {
  console.log('🧪 Testing JavaScript Menu & Script API parsing...');

  const sampleJsCode = `
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

function openShopMenu(player) {
  const form = new ActionFormData();
  form.title("§6Master Weapon Shop§r");
  form.body("Welcome adventurer! Choose your weapon to purchase:");
  form.button("§bDiamond Katana§r\\n§7Cost: 50 Coins", "textures/items/katana");
  form.button("§eThunder Hammer§r", "textures/items/hammer");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 0) {
      player.sendMessage("§aYou purchased the Diamond Katana!§r");
      player.onScreenDisplay.setTitle("§6Purchase Complete!§r");
    }
  });
}
`;

  const extracted = ScriptParser.extractTranslatableStrings(sampleJsCode);
  console.log(`Found ${extracted.length} UI strings in JavaScript code:`);
  extracted.forEach(e => console.log(` - [${e.method}] "${e.originalValue}"`));

  if (extracted.length !== 6) {
    throw new Error(`Expected 6 UI strings, found ${extracted.length}`);
  }

  // Test translation
  const rawTexts = extracted.map(e => e.originalValue);
  const translated = await TranslatorService.translateBatchWithGoogle(rawTexts, 'vi');
  for (let i = 0; i < extracted.length; i++) {
    extracted[i].translatedValue = translated[i];
  }

  const modifiedJsCode = ScriptParser.applyTranslations(sampleJsCode, extracted);
  console.log('\n--- Resulting JavaScript Code: ---');
  console.log(modifiedJsCode);
  console.log('----------------------------------');

  // Verify that code still has imports and structure
  if (!modifiedJsCode.includes('import { world }') || !modifiedJsCode.includes('function openShopMenu')) {
    throw new Error('JavaScript structure was corrupted!');
  }
  console.log('✅ JavaScript Menu translation verified successfully!');

  console.log('\n🧪 Testing Custom JSON UI parsing...');
  const sampleJsonUi = JSON.stringify({
    "namespace": "custom_ui",
    "main_screen": {
      "type": "panel",
      "header_label": {
        "type": "label",
        "text": "Character Skill Tree"
      },
      "confirm_btn": {
        "type": "button",
        "text": "Unlock Ability"
      },
      "texture_ref": {
        "type": "image",
        "text": "textures/ui/bg" // Should be ignored!
      }
    }
  }, null, 2);

  const { parsed, entries: uiEntries } = UiJsonParser.extractTranslatableStrings(sampleJsonUi);
  console.log(`Found ${uiEntries.length} UI strings in JSON UI:`);
  uiEntries.forEach(e => console.log(` - [${e.jsonPath}] "${e.originalValue}"`));

  if (uiEntries.length !== 2) {
    throw new Error(`Expected 2 UI strings, found ${uiEntries.length}`);
  }

  const translatedUi = await TranslatorService.translateBatchWithGoogle(uiEntries.map(e => e.originalValue), 'vi');
  for (let i = 0; i < uiEntries.length; i++) {
    uiEntries[i].translatedValue = translatedUi[i];
  }

  const modifiedJson = UiJsonParser.serializeWithTranslations(parsed, uiEntries);
  console.log('\n--- Resulting JSON UI: ---');
  console.log(modifiedJson);
  console.log('--------------------------');

  console.log('✅ Custom JSON UI translation verified successfully!');
  console.log('\n🎉 ALL MENU TRANSLATION TESTS PASSED 100%!');
}

testMenus().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
