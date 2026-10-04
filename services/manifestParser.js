/**
 * Parser for Minecraft Bedrock manifest.json files
 * Extracts and replaces translatable strings such as:
 * - Subpacks menu options (Menu lựa chọn cài ở ngoài map)
 * - Pack display name (header.name)
 * - Pack description (header.description)
 * - Module descriptions
 */

class ManifestParser {
  /**
   * Extract translatable strings from manifest.json content
   * @param {string|object} manifestContent Raw JSON string or parsed object
   * @returns {{ parsed: object, entries: Array<{ key: string, field: string, jsonPath: string, originalValue: string, translatedValue: string }> }}
   */
  static extractTranslatableStrings(manifestContent) {
    let manifest;
    try {
      manifest = typeof manifestContent === 'string' ? JSON.parse(manifestContent) : JSON.parse(JSON.stringify(manifestContent));
    } catch (err) {
      console.warn('ManifestParser: Invalid JSON content:', err);
      return { parsed: null, entries: [] };
    }

    if (!manifest || typeof manifest !== 'object') {
      return { parsed: manifest, entries: [] };
    }

    const entries = [];
    let entryIndex = 0;

    // Helper to test if a string should be translated
    const isTranslatable = (text) => {
      if (!text || typeof text !== 'string') return false;
      const trimmed = text.trim();
      if (!trimmed) return false;
      // Skip UUIDs, paths, pure numbers, technical tags
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return false;
      if (trimmed.startsWith('textures/') || trimmed.startsWith('pack.') || trimmed.startsWith('subpack.')) return false;
      // Must contain at least one letter
      return /[a-zA-ZÀ-ỹ§]/.test(trimmed);
    };

    // 1. Pack Header Name
    if (manifest.header && isTranslatable(manifest.header.name)) {
      entries.push({
        index: entryIndex++,
        field: 'header.name',
        jsonPath: 'header.name',
        key: 'manifest.header.name',
        label: 'Tên Mod hiển thị ngoài map',
        originalValue: manifest.header.name,
        translatedValue: manifest.header.name
      });
    }

    // 2. Pack Header Description
    if (manifest.header && isTranslatable(manifest.header.description)) {
      entries.push({
        index: entryIndex++,
        field: 'header.description',
        jsonPath: 'header.description',
        key: 'manifest.header.description',
        label: 'Mô tả Mod ngoài map',
        originalValue: manifest.header.description,
        translatedValue: manifest.header.description
      });
    }

    // 3. Subpacks (Bảng menu cấu hình mod cài ở ngoài map)
    if (Array.isArray(manifest.subpacks)) {
      manifest.subpacks.forEach((subpack, idx) => {
        if (subpack && isTranslatable(subpack.name)) {
          entries.push({
            index: entryIndex++,
            field: 'subpack.name',
            jsonPath: `subpacks[${idx}].name`,
            subpackIndex: idx,
            folderName: subpack.folder_name || '',
            key: `manifest.subpack[${idx}].name`,
            label: `Menu Subpack ngoài map (${subpack.folder_name || idx + 1})`,
            originalValue: subpack.name,
            translatedValue: subpack.name
          });
        }
      });
    }

    // 4. Modules description
    if (Array.isArray(manifest.modules)) {
      manifest.modules.forEach((mod, idx) => {
        if (mod && isTranslatable(mod.description)) {
          entries.push({
            index: entryIndex++,
            field: 'modules.description',
            jsonPath: `modules[${idx}].description`,
            moduleIndex: idx,
            key: `manifest.modules[${idx}].description`,
            label: `Mô tả Module (${mod.type || idx})`,
            originalValue: mod.description,
            translatedValue: mod.description
          });
        }
      });
    }

    return { parsed: manifest, entries };
  }

  /**
   * Apply translations back into manifest object
   * @param {object} manifestObject 
   * @param {Array} entries 
   * @returns {string} Serialized JSON
   */
  static serializeWithTranslations(manifestObject, entries) {
    if (!manifestObject) return '{}';
    const cloned = JSON.parse(JSON.stringify(manifestObject));

    for (const item of entries) {
      if (!item.translatedValue || item.translatedValue === item.originalValue) continue;

      if (item.field === 'header.name' && cloned.header) {
        cloned.header.name = item.translatedValue;
      } else if (item.field === 'header.description' && cloned.header) {
        cloned.header.description = item.translatedValue;
      } else if (item.field === 'subpack.name' && Array.isArray(cloned.subpacks) && cloned.subpacks[item.subpackIndex]) {
        cloned.subpacks[item.subpackIndex].name = item.translatedValue;
      } else if (item.field === 'modules.description' && Array.isArray(cloned.modules) && cloned.modules[item.moduleIndex]) {
        cloned.modules[item.moduleIndex].description = item.translatedValue;
      }
    }

    return JSON.stringify(cloned, null, 2);
  }
}

module.exports = ManifestParser;
