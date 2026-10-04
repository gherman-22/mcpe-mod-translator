/**
 * Parser for Bedrock Script API JavaScript/TypeScript files
 * Extracts and replaces user-facing UI strings (ActionFormData, ModalFormData, MessageFormData,
 * chat messages, onScreenDisplay titles, actionbars, rawtext, tellraw, etc.)
 * without breaking code logic or syntax.
 */

class ScriptParser {
  /**
   * Extract translatable UI strings from a script file
   * @param {string} code JavaScript source code
   * @returns {Array<{index: number, method: string, key: string, originalValue: string, translatedValue: string, start: number, end: number, quote: string}>}
   */
  static extractTranslatableStrings(code) {
    if (!code) return [];

    const entries = [];
    const usedRanges = []; // Keep track of [start, end] to avoid overlapping duplicates

    const isRangeOccupied = (start, end) => {
      return usedRanges.some(r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end) || (start <= r.start && end >= r.end));
    };

    const addEntry = (method, quote, rawText, start, end) => {
      // Basic validity checks
      if (!rawText || rawText.trim() === '') return;
      if (rawText.startsWith('minecraft:') || rawText.startsWith('textures/') || rawText.startsWith('scripts/')) return;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawText.trim())) return;
      if (/^@[saperv](\[[^\]]*\])?$/.test(rawText.trim())) return; // pure target selector
      if (/^#[0-9a-fA-F]{3,8}$/.test(rawText.trim())) return; // pure hex color

      // Must contain at least one Vietnamese/English character or Minecraft section formatting symbol
      if (!/[a-zA-ZÀ-ỹ§]/.test(rawText)) return;

      if (isRangeOccupied(start, end)) return;

      const idx = entries.length;
      entries.push({
        index: idx,
        method: method,
        key: `script.${method}[${idx}]`,
        originalValue: rawText,
        translatedValue: rawText,
        start,
        end,
        quote
      });
      usedRanges.push({ start, end });
    };

    // 1. Regex matching standard Minecraft Bedrock server-ui & message methods:
    // .title("..."), .body("..."), .button("..."), .button1("..."), .button2("..."),
    // .textField("..."), .toggle("..."), .dropdown("..."), .slider("..."), .header("..."), .label("..."),
    // .sendMessage("..."), .setActionBar("..."), .setTitle("..."), .setSubtitle("..."),
    // .sendTip("..."), .sendPopup("..."), .broadcast("..."), .notify("..."), .sendMsg("..."), .tell("..."), .chat("...")
    const methodRegex = /\.(title|body|button|button1|button2|textField|toggle|dropdown|slider|header|label|sendMessage|setActionBar|setTitle|setSubtitle|sendTip|sendPopup|broadcast|notify|sendMsg|tell|chat)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

    let match;
    while ((match = methodRegex.exec(code)) !== null) {
      const methodName = match[1];
      const quote = match[2];
      const rawText = match[3];

      const matchStart = match.index;
      const fullMatch = match[0];
      const quoteOffset = fullMatch.indexOf(quote);
      const start = matchStart + quoteOffset + 1;
      const end = start + rawText.length;

      addEntry(methodName, quote, rawText, start, end);
    }

    // 2. Secondary string in textField: .textField("label", "placeholder")
    const textFieldRegex = /\.textField\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;
    while ((match = textFieldRegex.exec(code)) !== null) {
      const quote = match[2];
      const rawText = match[3];

      const fullMatch = match[0];
      const lastQuoteIndex = fullMatch.lastIndexOf(quote, fullMatch.length - 2);
      const start = match.index + lastQuoteIndex + 1;
      const end = start + rawText.length;

      addEntry('textField.placeholder', quote, rawText, start, end);
    }

    // 3. Array elements in dropdown options: .dropdown("Label", ["Option 1", "Option 2", ...])
    const dropdownArrayRegex = /\.dropdown\s*\(\s*(?:['"`](?:\\.|[^\\])*?['"`])\s*,\s*\[([\s\S]*?)\]/g;
    while ((match = dropdownArrayRegex.exec(code)) !== null) {
      const arrayContent = match[1];
      const arrayStartOffset = match.index + match[0].indexOf('[') + 1;

      const strInArrayRegex = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
      let elemMatch;
      while ((elemMatch = strInArrayRegex.exec(arrayContent)) !== null) {
        const quote = elemMatch[1];
        const rawText = elemMatch[2];
        const elemStart = arrayStartOffset + elemMatch.index + 1;
        const elemEnd = elemStart + rawText.length;

        addEntry('dropdown.option', quote, rawText, elemStart, elemEnd);
      }
    }

    // 4. Minecraft Bedrock RawText object properties: { text: "..." } or "text": "..."
    // Frequently used in player.sendMessage({ rawtext: [{ text: "Hello" }] }) or player.sendMessage({ text: "Hello" })
    const rawTextPropRegex = /(?:^|[{,\s])(["']?text["']?)\s*:\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;
    while ((match = rawTextPropRegex.exec(code)) !== null) {
      const quote = match[2];
      const rawText = match[3];

      const fullMatch = match[0];
      const quoteIdx = fullMatch.lastIndexOf(quote, fullMatch.length - 2);
      const start = match.index + quoteIdx + 1;
      const end = start + rawText.length;

      // Filter out technical strings or single words like "chat", "hover", "insertion"
      if (rawText && !['true', 'false', 'reset', 'none'].includes(rawText.toLowerCase())) {
        addEntry('rawtext.message', quote, rawText, start, end);
      }
    }

    // Sort entries by position in code
    entries.sort((a, b) => a.start - b.start);
    // Re-index cleanly
    entries.forEach((e, i) => {
      e.index = i;
      e.key = `script.${e.method}[${i}]`;
    });

    return entries;
  }

  /**
   * Replace translated strings back into JavaScript code
   * @param {string} originalCode 
   * @param {Array} entries 
   * @returns {string} Updated JavaScript code
   */
  static applyTranslations(originalCode, entries) {
    if (!entries || entries.length === 0) return originalCode;

    // Sort entries in descending order of start position so replacements don't offset subsequent indices
    const sorted = [...entries].sort((a, b) => b.start - a.start);

    let updated = originalCode;
    for (const item of sorted) {
      if (item.translatedValue && item.translatedValue !== item.originalValue) {
        // Escape quotes to match string delimiter
        let escapedTranslation = item.translatedValue;
        if (item.quote === '"') {
          escapedTranslation = escapedTranslation.replace(/(?<!\\)"/g, '\\"');
        } else if (item.quote === "'") {
          escapedTranslation = escapedTranslation.replace(/(?<!\\)'/g, "\\'");
        }

        updated = updated.slice(0, item.start) + escapedTranslation + updated.slice(item.end);
      }
    }

    return updated;
  }
}

module.exports = ScriptParser;
