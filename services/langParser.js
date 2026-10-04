/**
 * Parser and Serializer for Minecraft Bedrock .lang files
 */

class LangParser {
  /**
   * Parse a .lang file content into an array of lines/entries
   * @param {string} content Raw .lang file content
   * @returns {Array<{type: 'comment'|'blank'|'entry', raw: string, key?: string, value?: string, comment?: string}>}
   */
  static parse(content) {
    if (!content) return [];
    
    // Normalize newlines
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        result.push({ type: 'blank', raw: line, index: i });
        continue;
      }

      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        result.push({ type: 'comment', raw: line, index: i });
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) {
        // Line doesn't have an equal sign, preserve as raw/comment
        result.push({ type: 'comment', raw: line, index: i });
        continue;
      }

      const key = line.substring(0, eqIndex).trim();
      const valuePart = line.substring(eqIndex + 1);

      // Check if there is an inline comment (e.g. key=value\t## comment)
      // Minecraft Bedrock typically uses \t# or \t## for inline comments
      let value = valuePart;
      let inlineComment = '';
      
      const tabCommentIndex = valuePart.search(/\t+#/);
      if (tabCommentIndex !== -1) {
        value = valuePart.substring(0, tabCommentIndex);
        inlineComment = valuePart.substring(tabCommentIndex);
      }

      result.push({
        type: 'entry',
        raw: line,
        key: key,
        originalValue: value,
        translatedValue: value,
        inlineComment: inlineComment,
        index: i
      });
    }

    return result;
  }

  /**
   * Reconstruct .lang content from parsed entries
   * @param {Array} entries 
   * @param {boolean} useTranslation If true, uses translatedValue, else originalValue
   * @returns {string}
   */
  static serialize(entries, useTranslation = true) {
    const lines = [];

    for (const item of entries) {
      if (item.type === 'blank') {
        lines.push('');
      } else if (item.type === 'comment') {
        lines.push(item.raw);
      } else if (item.type === 'entry') {
        const val = useTranslation ? (item.translatedValue ?? item.originalValue) : item.originalValue;
        const inline = item.inlineComment || '';
        lines.push(`${item.key}=${val}${inline}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Filter only translatable entries from parsed items
   * @param {Array} entries 
   * @returns {Array}
   */
  static getTranslatableEntries(entries) {
    return entries.filter(e => e.type === 'entry' && e.originalValue && e.originalValue.trim().length > 0);
  }
}

module.exports = LangParser;
