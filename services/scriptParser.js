/**
 * Parser for Bedrock Script API JavaScript/TypeScript files
 * Extracts and replaces user-facing UI strings (ActionFormData, ModalFormData, messages, etc.)
 * without breaking code logic or syntax.
 */

class ScriptParser {
  /**
   * Extract translatable UI strings from a script file
   * @param {string} code JavaScript source code
   * @returns {Array<{key: string, originalValue: string, translatedValue: string, start: number, end: number, quote: string}>}
   */
  static extractTranslatableStrings(code) {
    if (!code) return [];

    const entries = [];
    
    // Regex matching Minecraft Bedrock server-ui and chat methods:
    // .title("..."), .body("..."), .button("..."), .textField("...", "..."),
    // .toggle("..."), .dropdown("...", [...]), .slider("..."),
    // .sendMessage("..."), .setActionBar("..."), .setTitle("..."), .setSubtitle("...")
    const methodRegex = /\.(title|body|button|textField|toggle|dropdown|slider|sendMessage|setActionBar|setTitle|setSubtitle)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

    let match;
    let index = 0;
    while ((match = methodRegex.exec(code)) !== null) {
      const methodName = match[1];
      const quote = match[2];
      const rawText = match[3];

      // Ignore empty strings, pure identifiers, or Minecraft command references
      if (!rawText || rawText.trim() === '' || rawText.startsWith('minecraft:') || rawText.startsWith('textures/')) {
        continue;
      }

      // Check if text has letters or spaces or Minecraft color codes
      if (!/[a-zA-ZÀ-ỹ§]/.test(rawText)) {
        continue;
      }

      const matchStart = match.index;
      // Calculate start and end offset of the string contents (excluding quotes)
      const fullMatch = match[0];
      const quoteOffset = fullMatch.indexOf(quote);
      const start = matchStart + quoteOffset + 1;
      const end = start + rawText.length;

      entries.push({
        index: index++,
        method: methodName,
        key: `script.${methodName}[${index}]`,
        originalValue: rawText,
        translatedValue: rawText,
        start,
        end,
        quote
      });
    }

    // Also detect secondary string in textField: .textField("label", "placeholder")
    const textFieldRegex = /\.textField\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;
    while ((match = textFieldRegex.exec(code)) !== null) {
      const quote = match[2];
      const rawText = match[3];

      if (!rawText || rawText.trim() === '' || !/[a-zA-ZÀ-ỹ§]/.test(rawText)) continue;

      const fullMatch = match[0];
      const lastQuoteIndex = fullMatch.lastIndexOf(quote, fullMatch.length - 2);
      const start = match.index + lastQuoteIndex + 1;
      const end = start + rawText.length;

      entries.push({
        index: index++,
        method: 'textField.placeholder',
        key: `script.placeholder[${index}]`,
        originalValue: rawText,
        translatedValue: rawText,
        start,
        end,
        quote
      });
    }

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
