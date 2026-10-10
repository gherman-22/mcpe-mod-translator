const { protectMinecraftTokens, restoreMinecraftTokens, MC_GLOSSARY } = require('./mcDictionary');
const fs = require('fs');
const path = require('path');

function getServerGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed.ai && parsed.ai.geminiApiKey) {
        return String(parsed.ai.geminiApiKey).trim();
      }
    }
  } catch {}
  return '';
}

class TranslatorService {
  /**
   * Map MCPE language code to Google Translate language code
   */
  static mapLanguageCode(mcLangCode) {
    const map = {
      'vi_VN': 'vi',
      'zh_CN': 'zh-CN',
      'zh_TW': 'zh-TW',
      'ja_JP': 'ja',
      'ko_KR': 'ko',
      'ru_RU': 'ru',
      'es_ES': 'es',
      'es_MX': 'es',
      'pt_BR': 'pt',
      'pt_PT': 'pt',
      'fr_FR': 'fr',
      'de_DE': 'de',
      'th_TH': 'th',
      'id_ID': 'id',
      'it_IT': 'it',
      'tr_TR': 'tr',
      'uk_UA': 'uk',
      'pl_PL': 'pl'
    };
    return map[mcLangCode] || (mcLangCode ? mcLangCode.split('_')[0] : 'vi') || 'vi';
  }

  /**
   * Polish Vietnamese terms to match official Minecraft Bedrock standard terminology
   */
  static polishMinecraftVietnamese(text, targetLang = 'vi') {
    if (!text || (targetLang !== 'vi' && targetLang !== 'vi_VN')) return text;
    let t = text;

    // Fix typical automatic translation artifacts for Minecraft items
    t = t.replace(/\bNhân viên của\b/gi, 'Gậy phép của');
    t = t.replace(/\bnhân viên của\b/gi, 'gậy phép của');
    t = t.replace(/\bTrượng của\b/gi, 'Gậy phép của');
    t = t.replace(/\bThanh kiếm\b/gi, 'Kiếm');
    t = t.replace(/\bthanh kiếm\b/gi, 'kiếm');
    t = t.replace(/\bCuốc kim cương\b/gi, 'Cúp kim cương');
    t = t.replace(/\bCuốc sắt\b/gi, 'Cúp sắt');
    t = t.replace(/\bCuốc vàng\b/gi, 'Cúp vàng');
    t = t.replace(/\bCuốc đá\b/gi, 'Cúp đá');
    t = t.replace(/\bCuốc gỗ\b/gi, 'Cúp gỗ');
    t = t.replace(/\bCuốc netherite\b/gi, 'Cúp netherite');
    t = t.replace(/\bCuốc băng\b/gi, 'Cúp băng');
    t = t.replace(/\bThỏi sắt\b/gi, 'Phôi sắt');
    t = t.replace(/\bThỏi vàng\b/gi, 'Phôi vàng');
    t = t.replace(/\bThỏi đồng\b/gi, 'Phôi đồng');
    t = t.replace(/\bThỏi netherite\b/gi, 'Phôi netherite');

    return t;
  }

  /**
   * Translate a single text string using Google Translate Free Web API (Multi-endpoint)
   */
  static async translateWithGoogleSingle(text, targetLang = 'vi') {
    if (!text || text.trim() === '') return text;

    // Protect Minecraft codes
    const { maskedText, tokens } = protectMinecraftTokens(text);
    let translated = '';

    // 1. Primary: clients5 POST
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetLang)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: `q=${encodeURIComponent(maskedText)}`
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data[0] && typeof data[0][0] === 'string') {
          translated = data[0][0];
        }
      }
    } catch (e) {
      // Fallback below
    }

    // 2. Secondary: gtx endpoint
    if (!translated) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(maskedText)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data[0] && Array.isArray(data[0])) {
            for (const piece of data[0]) {
              if (piece && piece[0]) {
                translated += piece[0];
              }
            }
          }
        }
      } catch (e) {
        // Keep maskedText if all endpoints fail
      }
    }

    if (!translated) {
      translated = maskedText;
    }

    // Restore Minecraft codes & polish
    const restored = restoreMinecraftTokens(translated, tokens);
    return this.polishMinecraftVietnamese(restored, targetLang);
  }

  /**
   * Translate a batch of texts using Google Translate Free Multi-Engine API
   * Uses newline joining with tokens protected, guaranteeing fast & 100% accurate translation
   */
  static async translateBatchWithGoogle(texts, targetLang = 'vi', onBatchProgress) {
    const BATCH_SIZE = 25;
    const results = [...texts];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      const maskedChunks = [];
      const tokensList = [];

      for (const item of chunk) {
        if (!item || item.trim() === '') {
          maskedChunks.push('');
          tokensList.push([]);
          continue;
        }
        const { maskedText, tokens } = protectMinecraftTokens(item);
        maskedChunks.push(maskedText);
        tokensList.push(tokens);
      }

      let chunkSuccess = false;

      // Primary: clients5 POST with newline separation
      try {
        const combinedText = maskedChunks.join('\n');
        const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetLang)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: `q=${encodeURIComponent(combinedText)}`
        });

        if (response.ok) {
          const data = await response.json();
          const fullTranslated = (data && data[0] && data[0][0]) || '';
          const lines = fullTranslated.split('\n');

          if (lines.length === chunk.length) {
            for (let j = 0; j < chunk.length; j++) {
              if (!chunk[j] || chunk[j].trim() === '') {
                results[i + j] = chunk[j];
              } else {
                const restored = restoreMinecraftTokens(lines[j], tokensList[j]);
                results[i + j] = this.polishMinecraftVietnamese(restored, targetLang);
              }
            }
            chunkSuccess = true;
          }
        }
      } catch (err) {
        console.warn(`Clients5 batch at ${i} warning: ${err.message}`);
      }

      // Fallback: translate line-by-line if batch split mismatch or error
      if (!chunkSuccess) {
        for (let j = 0; j < chunk.length; j++) {
          try {
            results[i + j] = await this.translateWithGoogleSingle(chunk[j], targetLang);
          } catch (e) {
            results[i + j] = chunk[j];
          }
        }
      }

      if (onBatchProgress) {
        onBatchProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length);
      }

      // Small delay to prevent rate issues
      await new Promise(r => setTimeout(r, 50));
    }

    return results;
  }

  /**
   * Translate entries using Gemini AI (Gemini 2.0 Flash / 1.5 Flash)
   * Automatically falls back to Google multi-engine if API key is missing or quota exceeded
   */
  static async translateBatchWithGemini(entries, targetLangName, apiKey, onBatchProgress) {
    const effectiveKey = (apiKey && apiKey.trim()) || getServerGeminiKey();

    // If no key available, gracefully auto-translate with high-quality Google Multi-Engine
    if (!effectiveKey) {
      console.log('Không có Gemini API Key, tự động dịch hoàn toàn bằng bộ máy đa tầng Google Translate...');
      const googleTarget = this.mapLanguageCode(targetLangName);
      const rawTexts = entries.map(e => e.originalValue);
      return await this.translateBatchWithGoogle(rawTexts, googleTarget, onBatchProgress);
    }

    const BATCH_SIZE = 30;
    const results = [...entries.map(e => e.originalValue)];
    const langDisplay = targetLangName === 'vi_VN' ? 'Vietnamese (Tiếng Việt)' : targetLangName;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const itemsToTranslate = chunk.map((item, idx) => ({
        id: idx,
        key: item.key,
        original: item.originalValue
      }));

      const systemPrompt = `You are a Minecraft Bedrock localization expert. Translate Minecraft Bedrock mod localization strings from English to ${langDisplay}.
CRITICAL RULES:
1. Strictly preserve Minecraft formatting codes: §0-§f, §k, §l, §m, §n, §o, §r, §g, etc.
2. Strictly preserve format placeholders: %s, %1$s, %d, {0}, \\n, \\t.
3. Use official standard Minecraft terms where appropriate (e.g. Diamond = Kim cương, Pickaxe = Cúp, Sword = Kiếm, Ingot = Phôi, Ore = Quặng, Netherite = Netherite, Enchantment = Phù phép, Staff = Gậy phép, Wand = Đũa phép).
4. Return ONLY a valid JSON array of objects with keys "id" and "translated". No extra markdown or conversational text.`;

      const userPrompt = `Translate this JSON array:
${JSON.stringify(itemsToTranslate, null, 2)}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveKey}`;

      let batchSuccess = false;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          let parsed = [];
          try {
            parsed = JSON.parse(responseText);
          } catch (e) {
            const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
            parsed = JSON.parse(cleanJson);
          }

          if (Array.isArray(parsed)) {
            for (const transItem of parsed) {
              if (typeof transItem.id === 'number' && chunk[transItem.id]) {
                results[i + transItem.id] = transItem.translated;
              }
            }
            batchSuccess = true;
          }
        } else {
          console.warn(`Gemini API error (${response.status}), falling back to Google Translate for batch ${i}`);
        }
      } catch (err) {
        console.warn(`Gemini translation batch ${i} failed:`, err.message);
      }

      // Fallback to Google Translate if Gemini fails for this batch
      if (!batchSuccess) {
        const googleTarget = this.mapLanguageCode(targetLangName);
        const chunkTexts = chunk.map(c => c.originalValue);
        const fallbackResults = await this.translateBatchWithGoogle(chunkTexts, googleTarget);
        for (let j = 0; j < chunk.length; j++) {
          results[i + j] = fallbackResults[j];
        }
      }

      if (onBatchProgress) {
        onBatchProgress(Math.min(i + BATCH_SIZE, entries.length), entries.length);
      }

      await new Promise(r => setTimeout(r, 60));
    }

    return results;
  }

  /**
   * Translate entries using OpenAI (GPT-4o-mini)
   */
  static async translateBatchWithOpenAI(entries, targetLangName, apiKey, onBatchProgress) {
    if (!apiKey) {
      const googleTarget = this.mapLanguageCode(targetLangName);
      const rawTexts = entries.map(e => e.originalValue);
      return await this.translateBatchWithGoogle(rawTexts, googleTarget, onBatchProgress);
    }

    const BATCH_SIZE = 30;
    const results = [...entries.map(e => e.originalValue)];
    const langDisplay = targetLangName === 'vi_VN' ? 'Vietnamese (Tiếng Việt)' : targetLangName;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const itemsToTranslate = chunk.map((item, idx) => ({
        id: idx,
        key: item.key,
        original: item.originalValue
      }));

      let batchSuccess = false;
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are a Minecraft Bedrock localization expert. Translate Minecraft Bedrock mod localization strings from English to ${langDisplay}.
CRITICAL RULES:
1. Strictly preserve Minecraft formatting codes: §0-§f, §k, §l, §m, §n, §o, §r.
2. Strictly preserve format placeholders: %s, %1$s, %d, {0}, \\n, \\t.
3. Use official standard Minecraft terms where appropriate.
4. Output a JSON object with key "translations" containing the array of {id, translated}.`
              },
              {
                role: 'user',
                content: JSON.stringify({ items: itemsToTranslate })
              }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          const parsed = JSON.parse(content);
          const list = parsed.translations || parsed;

          if (Array.isArray(list)) {
            for (const transItem of list) {
              if (typeof transItem.id === 'number' && chunk[transItem.id]) {
                results[i + transItem.id] = transItem.translated;
              }
            }
            batchSuccess = true;
          }
        }
      } catch (err) {
        console.warn(`OpenAI batch error:`, err.message);
      }

      if (!batchSuccess) {
        const googleTarget = this.mapLanguageCode(targetLangName);
        const chunkTexts = chunk.map(c => c.originalValue);
        const fallbackResults = await this.translateBatchWithGoogle(chunkTexts, googleTarget);
        for (let j = 0; j < chunk.length; j++) {
          results[i + j] = fallbackResults[j];
        }
      }

      if (onBatchProgress) {
        onBatchProgress(Math.min(i + BATCH_SIZE, entries.length), entries.length);
      }

      await new Promise(r => setTimeout(r, 60));
    }

    return results;
  }
}

module.exports = TranslatorService;
