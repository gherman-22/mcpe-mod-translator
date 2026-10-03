const { protectMinecraftTokens, restoreMinecraftTokens, MC_GLOSSARY } = require('./mcDictionary');

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
    return map[mcLangCode] || mcLangCode.split('_')[0] || 'vi';
  }

  /**
   * Translate a single text string using Google Translate Free Web API
   */
  static async translateWithGoogleSingle(text, targetLang = 'vi') {
    if (!text || text.trim() === '') return text;

    // Protect Minecraft codes
    const { maskedText, tokens } = protectMinecraftTokens(text);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(maskedText)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate HTTP error: ${response.status}`);
    }

    const data = await response.json();
    let translated = '';
    if (data && data[0] && Array.isArray(data[0])) {
      for (const piece of data[0]) {
        if (piece && piece[0]) {
          translated += piece[0];
        }
      }
    } else {
      translated = maskedText;
    }

    // Restore Minecraft codes
    return restoreMinecraftTokens(translated, tokens);
  }

  /**
   * Translate a batch of texts using Google Translate Free Web API
   * Uses delimiter joining to minimize HTTP requests while keeping accuracy high
   */
  static async translateBatchWithGoogle(texts, targetLang = 'vi', onBatchProgress) {
    const BATCH_SIZE = 15;
    const results = [...texts];
    const DELIMITER = ' ___MC_SPLIT___ ';

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      const maskedChunks = [];
      const tokensList = [];

      for (const item of chunk) {
        const { maskedText, tokens } = protectMinecraftTokens(item);
        maskedChunks.push(maskedText);
        tokensList.push(tokens);
      }

      const combinedText = maskedChunks.join(DELIMITER);

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(combinedText)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });

        if (!response.ok) {
          throw new Error(`Google Translate status ${response.status}`);
        }

        const data = await response.json();
        let fullTranslated = '';
        if (data && data[0] && Array.isArray(data[0])) {
          for (const piece of data[0]) {
            if (piece && piece[0]) {
              fullTranslated += piece[0];
            }
          }
        }

        // Split back by delimiter (flexible regex for spacing)
        const translatedParts = fullTranslated.split(/\s*___MC_SPLIT___\s*/);

        for (let j = 0; j < chunk.length; j++) {
          const trans = translatedParts[j] || maskedChunks[j];
          results[i + j] = restoreMinecraftTokens(trans, tokensList[j]);
        }
      } catch (err) {
        console.warn(`Batch failed, falling back to individual lines: ${err.message}`);
        // Fallback item by item
        for (let j = 0; j < chunk.length; j++) {
          try {
            results[i + j] = await this.translateWithGoogleSingle(chunk[j], targetLang);
          } catch (e) {
            results[i + j] = chunk[j]; // keep original on complete failure
          }
        }
      }

      if (onBatchProgress) {
        onBatchProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length);
      }

      // Small delay to be polite to the endpoint
      await new Promise(r => setTimeout(r, 120));
    }

    return results;
  }

  /**
   * Translate entries using Gemini AI (Gemini 2.0 Flash / 1.5 Flash)
   */
  static async translateBatchWithGemini(entries, targetLangName, apiKey, onBatchProgress) {
    if (!apiKey) {
      throw new Error('Chưa cung cấp Gemini API Key!');
    }

    const BATCH_SIZE = 30;
    const results = [...entries.map(e => e.originalValue)];

    // Target language name in Vietnamese or English
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
3. Use official standard Minecraft terms where appropriate (e.g. Diamond = Kim cương, Pickaxe = Cúp, Sword = Kiếm, Ingot = Phôi, Ore = Quặng, Netherite = Netherite, Enchantment = Phù phép, etc.).
4. Return ONLY a valid JSON array of objects with keys "id" and "translated". No extra markdown or conversational text.`;

      const userPrompt = `Translate this JSON array:
${JSON.stringify(itemsToTranslate, null, 2)}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        let parsed = [];
        try {
          parsed = JSON.parse(responseText);
        } catch (e) {
          // Attempt markdown json extraction
          const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
          parsed = JSON.parse(cleanJson);
        }

        if (Array.isArray(parsed)) {
          for (const transItem of parsed) {
            if (typeof transItem.id === 'number' && chunk[transItem.id]) {
              results[i + transItem.id] = transItem.translated;
            }
          }
        }
      } catch (err) {
        console.error(`Gemini translation batch ${i} failed:`, err);
        // Fallback to Google Translate for this batch
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

      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  }

  /**
   * Translate entries using OpenAI (GPT-4o-mini)
   */
  static async translateBatchWithOpenAI(entries, targetLangName, apiKey, onBatchProgress) {
    if (!apiKey) {
      throw new Error('Chưa cung cấp OpenAI API Key!');
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

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

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
        }
      } catch (err) {
        console.error(`OpenAI batch error:`, err);
        // Fallback to Google
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

      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  }
}

module.exports = TranslatorService;
