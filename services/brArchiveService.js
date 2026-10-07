/**
 * Read and write Minecraft Bedrock .brarchive files.
 *
 * A .brarchive keeps the same text files that older packs store in folders
 * such as texts/en_US.lang, but places them in one binary container.
 */
class BrArchiveService {
  static get MAGIC() {
    return Buffer.from('7d2725b1a0527026', 'hex');
  }

  static isBrArchive(buffer) {
    return Buffer.isBuffer(buffer)
      && buffer.length >= 16
      && buffer.subarray(0, 8).equals(BrArchiveService.MAGIC);
  }

  static deserialize(buffer) {
    if (!BrArchiveService.isBrArchive(buffer)) {
      throw new Error('Tệp .brarchive không hợp lệ hoặc chưa được hỗ trợ.');
    }

    const entryCount = buffer.readUInt32LE(8);
    const version = buffer.readUInt32LE(12);
    const contentBase = 16 + (entryCount * 256);

    if (version !== 1 || !Number.isSafeInteger(contentBase) || contentBase > buffer.length) {
      throw new Error('Cấu trúc .brarchive không hợp lệ.');
    }

    const entries = [];
    for (let index = 0; index < entryCount; index += 1) {
      const descriptorOffset = 16 + (index * 256);
      const nameLength = buffer.readUInt8(descriptorOffset);

      if (nameLength > 247) {
        throw new Error('Tên tệp trong .brarchive không hợp lệ.');
      }

      const name = buffer.subarray(descriptorOffset + 1, descriptorOffset + 1 + nameLength).toString('utf8');
      const contentOffset = buffer.readUInt32LE(descriptorOffset + 248);
      const contentLength = buffer.readUInt32LE(descriptorOffset + 252);
      const start = contentBase + contentOffset;
      const end = start + contentLength;

      if (!Number.isSafeInteger(end) || start < contentBase || end > buffer.length) {
        throw new Error(`Nội dung tệp "${name}" trong .brarchive không hợp lệ.`);
      }

      entries.push({
        name,
        data: Buffer.from(buffer.subarray(start, end))
      });
    }

    return entries;
  }

  static serialize(entries) {
    if (!Array.isArray(entries) || entries.length > 0xffffffff) {
      throw new Error('Danh sách tệp .brarchive không hợp lệ.');
    }

    const normalizedEntries = entries.map((entry) => {
      const name = String(entry?.name || '');
      const nameBuffer = Buffer.from(name, 'utf8');
      if (!name || nameBuffer.length > 247) {
        throw new Error('Tên tệp .brarchive phải dài từ 1 đến 247 byte UTF-8.');
      }

      return {
        nameBuffer,
        data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '')
      };
    });

    const headerSize = 16 + (normalizedEntries.length * 256);
    const descriptors = Buffer.alloc(headerSize);
    BrArchiveService.MAGIC.copy(descriptors, 0);
    descriptors.writeUInt32LE(normalizedEntries.length, 8);
    descriptors.writeUInt32LE(1, 12);

    let contentOffset = 0;
    const contents = [];
    normalizedEntries.forEach((entry, index) => {
      const descriptorOffset = 16 + (index * 256);
      descriptors.writeUInt8(entry.nameBuffer.length, descriptorOffset);
      entry.nameBuffer.copy(descriptors, descriptorOffset + 1);
      descriptors.writeUInt32LE(contentOffset, descriptorOffset + 248);
      descriptors.writeUInt32LE(entry.data.length, descriptorOffset + 252);
      contents.push(entry.data);
      contentOffset += entry.data.length;
    });

    return Buffer.concat([descriptors, ...contents]);
  }

  static findEntry(entries, name) {
    const normalizedName = String(name).toLowerCase();
    return entries.find((entry) => entry.name.toLowerCase() === normalizedName) || null;
  }

  static upsertText(entries, name, text) {
    const data = Buffer.from(String(text), 'utf8');
    const existing = BrArchiveService.findEntry(entries, name);
    if (existing) {
      existing.data = data;
    } else {
      entries.push({ name, data });
    }
  }
}

module.exports = BrArchiveService;
