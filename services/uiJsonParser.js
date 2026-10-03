/**
 * Parser for Minecraft Bedrock JSON UI files (ui/*.json)
 * Identifies and translates hardcoded display labels and menu text
 */

class UiJsonParser {
  /**
   * Extract translatable UI strings from JSON UI content
   * @param {string} rawJson 
   * @returns {Array<{key: string, originalValue: string, translatedValue: string, jsonPath: string}>}
   */
  static extractTranslatableStrings(rawJson) {
    if (!rawJson) return [];

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      // If JSON has Bedrock comments, strip them
      try {
        const stripped = rawJson.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');
        parsed = JSON.parse(stripped);
      } catch (e2) {
        return [];
      }
    }

    const entries = [];
    let counter = 0;

    function traverse(node, currentPath = '') {
      if (!node || typeof node !== 'object') return;

      for (const key of Object.keys(node)) {
        const val = node[key];
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        if (typeof val === 'string') {
          // Check if key is "text", "label", "title", "header", "description"
          const isTextKey = /^(text|label|title|header|description|tooltip|hover_text)$/i.test(key);

          if (isTextKey) {
            const trimmed = val.trim();
            // Skip .lang references (starts with %) or textures (starts with textures/)
            if (trimmed && !trimmed.startsWith('%') && !trimmed.startsWith('textures/') && !trimmed.startsWith('#') && /[a-zA-ZÀ-ỹ§]/.test(trimmed)) {
              entries.push({
                index: counter++,
                key: `ui.${newPath}`,
                originalValue: val,
                translatedValue: val,
                jsonPath: newPath,
                ref: { obj: node, prop: key }
              });
            }
          }
        } else if (typeof val === 'object') {
          traverse(val, newPath);
        }
      }
    }

    traverse(parsed);
    return { parsed, entries };
  }

  /**
   * Apply translations back into JSON UI object and serialize
   */
  static serializeWithTranslations(parsedObject, entries) {
    for (const item of entries) {
      if (item.ref && item.translatedValue) {
        item.ref.obj[item.ref.prop] = item.translatedValue;
      }
    }
    return JSON.stringify(parsedObject, null, 2);
  }
}

module.exports = UiJsonParser;
