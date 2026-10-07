const JSZip = require('jszip');
const LangParser = require('./langParser');
const ScriptParser = require('./scriptParser');
const UiJsonParser = require('./uiJsonParser');
const ManifestParser = require('./manifestParser');
const BrArchiveService = require('./brArchiveService');

class ArchiveService {
  /**
   * Inspect uploaded archive (.mcpack, .mcaddon, .zip)
   * Extracts metadata, pack icon, manifest strings (menus/subpacks),
   * translatable .lang files, JavaScript menu strings, and UI JSON files.
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
    let totalManifestLines = 0;

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
      if (p.manifestEntries) {
        totalManifestLines += p.manifestEntries.length;
      }
    });

    return {
      filename,
      isAddon,
      packs,
      totalLines,
      totalScriptLines,
      totalUiLines,
      totalManifestLines,
      grandTotal: totalLines + totalScriptLines + totalUiLines + totalManifestLines
    };
  }

  /**
   * Extract info from a zip instance representing a single pack
   */
  static async extractPackFromZip(zip, displayName, packIdentifier, folderPrefix = '') {
    // 1. Find and parse manifest.json (Includes subpacks menu options)
    let manifestData = null;
    let manifestEntries = [];
    const manifestPath = Object.keys(zip.files).find(p => {
      const norm = p.toLowerCase();
      return folderPrefix ? norm === (folderPrefix + 'manifest.json').toLowerCase() : norm.endsWith('manifest.json');
    });

    if (manifestPath) {
      try {
        const rawManifestText = await zip.file(manifestPath).async('text');
        const extracted = ManifestParser.extractTranslatableStrings(rawManifestText);
        manifestData = extracted.parsed;
        manifestEntries = extracted.entries;
      } catch (e) {
        console.warn('Could not parse manifest.json:', e);
      }
    }

    const name = (typeof manifestData?.header?.name === 'string' ? manifestData.header.name : '') || displayName.replace(/\.[^/.]+$/, '');
    const description = (typeof manifestData?.header?.description === 'string' ? manifestData.header.description : '') || 'No description';
    const uuid = manifestData?.header?.uuid || '';
    const version = Array.isArray(manifestData?.header?.version)
      ? manifestData.header.version.join('.')
      : (manifestData?.header?.version != null ? String(manifestData.header.version) : '1.0.0');

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

    // 3. Find texts/*.lang files, including the Bedrock .brarchive container
    // introduced for pack optimization in newer Minecraft versions.
    const langCandidates = [];
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

      langCandidates.push({
        path: lPath,
        filename: lPath.split('/').pop(),
        allEntries,
        translatableEntries,
        sourceGroup: `folder:${lPath.substring(0, lPath.lastIndexOf('/') + 1)}`
      });
    }

    const brTextArchives = Object.keys(zip.files).filter((archivePath) => {
      const normalizedPath = archivePath.toLowerCase();
      const expectedStart = folderPrefix.toLowerCase();
      return normalizedPath.startsWith(expectedStart)
        && normalizedPath.endsWith('__brarchive/texts.brarchive');
    });

    for (const archivePath of brTextArchives) {
      try {
        const archiveBuffer = await zip.file(archivePath).async('nodebuffer');
        const archiveEntries = BrArchiveService.deserialize(archiveBuffer);

        for (const archiveEntry of archiveEntries) {
          if (!archiveEntry.name.toLowerCase().endsWith('.lang')) continue;

          const rawContent = archiveEntry.data.toString('utf8');
          const allEntries = LangParser.parse(rawContent);
          const translatableEntries = LangParser.getTranslatableEntries(allEntries);

          langCandidates.push({
            path: `${archivePath}#/${archiveEntry.name}`,
            filename: archiveEntry.name.split('/').pop(),
            allEntries,
            translatableEntries,
            isBrArchive: true,
            brArchivePath: archivePath,
            brEntryName: archiveEntry.name,
            sourceGroup: `brarchive:${archivePath.toLowerCase()}`
          });
        }
      } catch (err) {
        console.warn(`Could not read ${archivePath}:`, err.message);
      }
    }

    // A language pack commonly contains the same keys in many languages.
    // Translate the English source once per texts container, then generate the
    // requested target language from that source.
    const sourceByGroup = new Map();
    for (const candidate of langCandidates) {
      const selected = sourceByGroup.get(candidate.sourceGroup);
      const isEnglish = candidate.filename.toLowerCase() === 'en_us.lang';
      const selectedIsEnglish = selected?.filename.toLowerCase() === 'en_us.lang';
      if (!selected || (isEnglish && !selectedIsEnglish)) {
        sourceByGroup.set(candidate.sourceGroup, candidate);
      }
    }
    const langFiles = Array.from(sourceByGroup.values());

    // 4. Find scripts/**/*.js / .ts files (Bedrock Script API menus, chat messages & forms)
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
      manifestPath,
      parsedManifest: manifestData,
      manifestEntries,
      langFiles,
      scriptFiles,
      uiFiles
    };
  }

  /**
   * Repack archive with translated texts, scripts, manifest menus, and UI files
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
      const brArchivesToWrite = new Map();

      const getBrArchive = async (archivePath) => {
        const cached = brArchivesToWrite.get(archivePath);
        if (cached) return cached;

        const archiveFile = targetZip.file(archivePath);
        if (!archiveFile) {
          throw new Error(`Không tìm thấy ${archivePath} trong gói mod.`);
        }

        const entries = BrArchiveService.deserialize(await archiveFile.async('nodebuffer'));
        const state = { entries };
        brArchivesToWrite.set(archivePath, state);
        return state;
      };

      // 1. Repack .lang files
      for (const langFile of pack.langFiles) {
        const translatedContent = LangParser.serialize(langFile.allEntries, true);

        if (langFile.isBrArchive && langFile.brArchivePath) {
          const archive = await getBrArchive(langFile.brArchivePath);
          BrArchiveService.upsertText(archive.entries, `${targetLangCode}.lang`, translatedContent);

          if (overwriteSource) {
            BrArchiveService.upsertText(archive.entries, langFile.brEntryName, translatedContent);
          }

          const languagesEntry = BrArchiveService.findEntry(archive.entries, 'languages.json');
          let languagesList = ['en_US'];
          if (languagesEntry) {
            try {
              languagesList = JSON.parse(languagesEntry.data.toString('utf8'));
            } catch (err) {
              console.warn(`Could not parse languages.json in ${langFile.brArchivePath}, recreating:`, err);
            }
          }

          if (!Array.isArray(languagesList)) languagesList = ['en_US'];
          if (!languagesList.includes(targetLangCode)) languagesList.push(targetLangCode);
          if (!languagesList.includes('en_US')) languagesList.unshift('en_US');
          BrArchiveService.upsertText(archive.entries, 'languages.json', JSON.stringify(languagesList, null, 2));
          continue;
        }

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

      for (const [archivePath, archive] of brArchivesToWrite) {
        targetZip.file(archivePath, BrArchiveService.serialize(archive.entries));
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

      // 4. Repack manifest.json (Menu subpacks & metadata ngoài map)
      if (pack.manifestPath && pack.manifestEntries && pack.manifestEntries.length > 0) {
        try {
          const updatedManifestJson = ManifestParser.serializeWithTranslations(pack.parsedManifest, pack.manifestEntries);
          targetZip.file(pack.manifestPath, updatedManifestJson);
        } catch (e) {
          console.warn(`Could not repack manifest ${pack.manifestPath}:`, e);
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
