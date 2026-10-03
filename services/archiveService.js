const JSZip = require('jszip');
const LangParser = require('./langParser');
const ScriptParser = require('./scriptParser');
const UiJsonParser = require('./uiJsonParser');

class ArchiveService {
  /**
   * Inspect uploaded archive (.mcpack, .mcaddon, .zip)
   * Extracts metadata, pack icon, translatable .lang files, JavaScript menu strings, and UI JSON files.
   */
  static async inspectArchive(buffer, filename) {
    const zip = await JSZip.loadAsync(buffer);
    const isAddon = filename.toLowerCase().endsWith('.mcaddon');
    
    const packs = [];

    // Check if outer zip directly contains manifest.json or if it contains nested .mcpacks
    const hasOuterManifest = Object.keys(zip.files).some(p => p.toLowerCase().endsWith('manifest.json') && !p.includes('/'));

    if (!isAddon && hasOuterManifest) {
      // Standalone single pack (.mcpack or .zip)
      const packInfo = await this.extractPackFromZip(zip, filename, '');
      if (packInfo) packs.push(packInfo);
    } else {
      // Check for nested .mcpack files or subfolders with manifest.json
      const nestedPackFiles = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith('.mcpack'));

      if (nestedPackFiles.length > 0) {
        // Nested .mcpack files inside .mcaddon or .zip
        for (const mcpackPath of nestedPackFiles) {
          const innerBuffer = await zip.file(mcpackPath).async('nodebuffer');
          const innerZip = await JSZip.loadAsync(innerBuffer);
          const packInfo = await this.extractPackFromZip(innerZip, mcpackPath, mcpackPath);
          if (packInfo) packs.push(packInfo);
        }
      } else {
        // Subfolders containing manifest.json?
        const manifestFiles = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith('manifest.json'));
        if (manifestFiles.length > 0) {
          for (const mPath of manifestFiles) {
            const folderPrefix = mPath.includes('/') ? mPath.substring(0, mPath.lastIndexOf('/') + 1) : '';
            const packInfo = await this.extractPackFromZip(zip, folderPrefix || filename, folderPrefix, folderPrefix);
            if (packInfo) packs.push(packInfo);
          }
        } else {
          // Attempt fallback as standalone
          const packInfo = await this.extractPackFromZip(zip, filename, '');
          if (packInfo) packs.push(packInfo);
        }
      }
    }

    // Calculate totals
    let totalLines = 0;
    let totalScriptLines = 0;
    let totalUiLines = 0;

    packs.forEach(p => {
      p.langFiles.forEach(lf => {
        totalLines += lf.translatableEntries.length;
      });
      p.scriptFiles.forEach(sf => {
        totalScriptLines += sf.translatableEntries.length;
      });
      p.uiFiles.forEach(uf => {
        totalUiLines += uf.translatableEntries.length;
      });
    });

    return {
      filename,
      isAddon,
      packs,
      totalLines,
      totalScriptLines,
      totalUiLines,
      grandTotal: totalLines + totalScriptLines + totalUiLines
    };
  }

  /**
   * Extract info from a zip instance representing a single pack
   */
  static async extractPackFromZip(zip, displayName, packIdentifier, folderPrefix = '') {
    // 1. Find manifest.json
    let manifestData = null;
    const manifestPath = Object.keys(zip.files).find(p => {
      const norm = p.toLowerCase();
      return folderPrefix ? norm === (folderPrefix + 'manifest.json').toLowerCase() : norm.endsWith('manifest.json');
    });

    if (manifestPath) {
      try {
        const text = await zip.file(manifestPath).async('text');
        manifestData = JSON.parse(text);
      } catch (e) {
        console.warn('Could not parse manifest.json:', e);
      }
    }

    const name = manifestData?.header?.name || displayName.replace(/\.[^/.]+$/, '');
    const description = manifestData?.header?.description || 'No description';
    const uuid = manifestData?.header?.uuid || '';
    const version = manifestData?.header?.version ? manifestData.header.version.join('.') : '1.0.0';

    // 2. Find pack icon
    let iconBase64 = null;
    const iconPath = Object.keys(zip.files).find(p => {
      const norm = p.toLowerCase();
      return folderPrefix ? norm === (folderPrefix + 'pack_icon.png').toLowerCase() : norm.endsWith('pack_icon.png');
    });

    if (iconPath) {
      try {
        const iconBuf = await zip.file(iconPath).async('nodebuffer');
        iconBase64 = `data:image/png;base64,${iconBuf.toString('base64')}`;
      } catch (e) {
        console.warn('Could not read pack_icon.png');
      }
    }

    // 3. Find texts/*.lang files
    const langFiles = [];
    const textsRegex = folderPrefix ? new RegExp(`^${folderPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}texts/[^/]+\\.lang$`, 'i') : /^texts\/[^/]+\.lang$/i;

    const matchedLangPaths = Object.keys(zip.files).filter(p => textsRegex.test(p));

    matchedLangPaths.sort((a, b) => {
      if (a.toLowerCase().endsWith('en_us.lang')) return -1;
      if (b.toLowerCase().endsWith('en_us.lang')) return 1;
      return 0;
    });

    if (matchedLangPaths.length === 0) {
      const anyLang = Object.keys(zip.files).filter(p => p.toLowerCase().endsWith('.lang'));
      matchedLangPaths.push(...anyLang);
    }

    for (const lPath of matchedLangPaths) {
      const rawContent = await zip.file(lPath).async('text');
      const allEntries = LangParser.parse(rawContent);
      const translatableEntries = LangParser.getTranslatableEntries(allEntries);

      langFiles.push({
        path: lPath,
        filename: lPath.split('/').pop(),
        allEntries,
        translatableEntries
      });
    }

    // 4. Find scripts/**/*.js / .ts files (Bedrock Script API menus & forms)
    const scriptFiles = [];
    const scriptRegex = folderPrefix
      ? new RegExp(`^${folderPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}scripts/.*\\.(js|ts)$`, 'i')
      : /^scripts\/.*\\.(js|ts)$/i;

    const matchedScriptPaths = Object.keys(zip.files).filter(p => scriptRegex.test(p) || (p.toLowerCase().includes('scripts/') && (p.endsWith('.js') || p.endsWith('.ts'))));

    for (const sPath of matchedScriptPaths) {
      try {
        const rawCode = await zip.file(sPath).async('text');
        const translatableEntries = ScriptParser.extractTranslatableStrings(rawCode);
        if (translatableEntries.length > 0) {
          scriptFiles.push({
            path: sPath,
            filename: sPath.split('/').pop(),
            rawCode,
            translatableEntries
          });
        }
      } catch (err) {
        console.warn(`Error parsing script ${sPath}:`, err);
      }
    }

    // 5. Find ui/**/*.json files (Custom JSON UI menus & HUDs)
    const uiFiles = [];
    const uiRegex = folderPrefix
      ? new RegExp(`^${folderPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}ui/.*\\.json$`, 'i')
      : /^ui\/.*\\.json$/i;

    const matchedUiPaths = Object.keys(zip.files).filter(p => uiRegex.test(p) || (p.toLowerCase().includes('ui/') && p.endsWith('.json')));

    for (const uPath of matchedUiPaths) {
      // Skip _ui_defs.json
      if (uPath.toLowerCase().endsWith('_ui_defs.json')) continue;

      try {
        const rawJson = await zip.file(uPath).async('text');
        const { parsed, entries } = UiJsonParser.extractTranslatableStrings(rawJson);
        if (entries.length > 0) {
          uiFiles.push({
            path: uPath,
            filename: uPath.split('/').pop(),
            parsedObject: parsed,
            translatableEntries: entries
          });
        }
      } catch (err) {
        console.warn(`Error parsing UI JSON ${uPath}:`, err);
      }
    }

    return {
      displayName: name,
      description,
      uuid,
      version,
      iconBase64,
      packIdentifier,
      folderPrefix,
      langFiles,
      scriptFiles,
      uiFiles
    };
  }

  /**
   * Repack archive with translated texts, scripts, and UI files
   */
  static async repackArchive({
    originalBuffer,
    filename,
    translatedPacks,
    targetLangCode = 'vi_VN',
    overwriteSource = true,
    includeScripts = true,
    includeUi = true
  }) {
    const zip = await JSZip.loadAsync(originalBuffer);
    const isAddon = filename.toLowerCase().endsWith('.mcaddon');

    for (const pack of translatedPacks) {
      let targetZip = zip;
      let isNestedMcpack = false;
      let nestedZip = null;

      if (pack.packIdentifier && pack.packIdentifier.toLowerCase().endsWith('.mcpack')) {
        isNestedMcpack = true;
        const innerBuf = await zip.file(pack.packIdentifier).async('nodebuffer');
        nestedZip = await JSZip.loadAsync(innerBuf);
        targetZip = nestedZip;
      }

      const folderPrefix = pack.folderPrefix || '';

      // 1. Repack .lang files
      for (const langFile of pack.langFiles) {
        const translatedContent = LangParser.serialize(langFile.allEntries, true);

        // Create texts/<targetLangCode>.lang
        const dir = folderPrefix ? `${folderPrefix}texts/` : 'texts/';
        const newLangPath = `${dir}${targetLangCode}.lang`;
        targetZip.file(newLangPath, translatedContent);

        // Optionally overwrite en_US.lang
        if (overwriteSource) {
          targetZip.file(langFile.path, translatedContent);
        }

        // Update or create languages.json
        const languagesJsonPath = `${dir}languages.json`;
        let languagesList = ['en_US'];

        const existingLanguagesFile = Object.keys(targetZip.files).find(p => p.toLowerCase() === languagesJsonPath.toLowerCase());
        if (existingLanguagesFile) {
          try {
            const rawJson = await targetZip.file(existingLanguagesFile).async('text');
            languagesList = JSON.parse(rawJson);
          } catch (e) {
            console.warn('Could not parse languages.json, recreating:', e);
          }
        }

        if (!Array.isArray(languagesList)) languagesList = ['en_US'];
        if (!languagesList.includes(targetLangCode)) {
          languagesList.push(targetLangCode);
        }
        if (!languagesList.includes('en_US')) {
          languagesList.unshift('en_US');
        }

        targetZip.file(languagesJsonPath, JSON.stringify(languagesList, null, 2));
      }

      // 2. Repack JavaScript scripts (if enabled)
      if (includeScripts && pack.scriptFiles) {
        for (const sf of pack.scriptFiles) {
          if (sf.translatableEntries && sf.translatableEntries.length > 0) {
            const updatedCode = ScriptParser.applyTranslations(sf.rawCode, sf.translatableEntries);
            targetZip.file(sf.path, updatedCode);
          }
        }
      }

      // 3. Repack UI JSON files (if enabled)
      if (includeUi && pack.uiFiles) {
        for (const uf of pack.uiFiles) {
          if (uf.translatableEntries && uf.translatableEntries.length > 0) {
            const updatedJson = UiJsonParser.serializeWithTranslations(uf.parsedObject, uf.translatableEntries);
            targetZip.file(uf.path, updatedJson);
          }
        }
      }

      if (isNestedMcpack && nestedZip) {
        const updatedMcpackBuf = await nestedZip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        zip.file(pack.packIdentifier, updatedMcpackBuf);
      }
    }

    // Generate output archive
    const outputBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return outputBuffer;
  }
}

module.exports = ArchiveService;
