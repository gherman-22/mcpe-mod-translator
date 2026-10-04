// Official and Community Minecraft Bedrock Vietnamese Terminology Dictionary
// Helps ensure translated items, blocks, and mechanics conform to standard Minecraft Bedrock terms

const MC_GLOSSARY = {
  // Equipment & Tools
  "Sword": "Kiếm",
  "Pickaxe": "Cúp",
  "Axe": "Rìu",
  "Shovel": "Xẻng",
  "Hoe": "Cuốc",
  "Helmet": "Mũ giáp",
  "Chestplate": "Áo giáp",
  "Leggings": "Quần giáp",
  "Boots": "Ủng",
  "Shield": "Khiên",
  "Bow": "Cung",
  "Crossbow": "Nỏ",
  "Arrow": "Mũi tên",
  "Trident": "Đinh ba",
  "Mace": "Chùy",
  "Shears": "Kéo tỉa",
  "Fishing Rod": "Cần câu",
  "Flint and Steel": "Dụng cụ đánh lửa",

  // Materials & Ores
  "Netherite": "Netherite",
  "Diamond": "Kim cương",
  "Emerald": "Ngọc lục bảo",
  "Amethyst": "Thạch anh tím",
  "Gold": "Vàng",
  "Golden": "Vàng",
  "Iron": "Sắt",
  "Copper": "Đồng",
  "Coal": "Than",
  "Lapis Lazuli": "Ngọc lưu ly",
  "Redstone": "Đá đỏ",
  "Quartz": "Thạch anh",
  "Obsidian": "Hắc diện thạch",
  "Ingot": "Phôi",
  "Nugget": "Mẩu",
  "Ore": "Quặng",
  "Raw Iron": "Sắt thô",
  "Raw Copper": "Đồng thô",
  "Raw Gold": "Vàng thô",
  "Shard": "Mảnh",
  "Dust": "Bột",

  // Common Mod concepts
  "Spawn": "Tạo ra",
  "Spawn Egg": "Trứng sinh ra",
  "Staff": "Gậy phép",
  "Wand": "Đũa phép",
  "Mana": "Mana",
  "Spell": "Phép thuật",
  "Scroll": "Cuộn giấy",
  "Soul": "Linh hồn",
  "Essence": "Tinh chất",
  "Gem": "Ngọc",
  "Crystal": "Pha lê",
  "Block": "Khối",
  "Item": "Vật phẩm",
  "Entity": "Thực thể",
  "Recipe": "Công thức",
  "Boss": "Trùm",
  "Dungeon": "Hầm ngục",
  "Portal": "Cổng dịch chuyển",
  "Dimension": "Chiều không gian",
  "Relic": "Cổ vật",
  "Tome": "Sách cổ",
  "Artifact": "Bảo vật",
  "Enchantment": "Phù phép",
  "Durability": "Độ bền",
  "Damage": "Sát thương",
  "Attack Damage": "Sát thương cận chiến",
  "Attack Speed": "Tốc độ tấn công",

  // Mobs & Entities
  "Zombie": "Zombie",
  "Skeleton": "Bộ xương",
  "Creeper": "Creeper",
  "Enderman": "Enderman",
  "Ender Dragon": "Rồng Ender",
  "Wither": "Wither",
  "Villager": "Dân làng",
  "Golem": "Người sắt (Golem)",
  "Phantom": "Bóng ma",
  "Warden": "Warden"
};

/**
 * Protect formatting codes (§0-§f, §l, etc.) and placeholders (%s, {0}, etc.)
 * by replacing them with unique placeholders before translation.
 */
function protectMinecraftTokens(text) {
  const tokens = [];

  // Match Minecraft section sign formatting codes (§0 to §r, §g, §t, §u, etc.)
  // Match variable format specifiers: %s, %1$s, %d, {0}, {name}, \n, \t
  const regex = /(§[0-9a-gk-orA-GK-OR]|%[0-9$]*[sdf]|(?:\{[a-zA-Z0-9_]+\})|\\n|\\t)/g;

  const maskedText = text.replace(regex, (match) => {
    const id = tokens.length;
    tokens.push(match);
    return `[#${id}#]`;
  });

  return { maskedText, tokens };
}

/**
 * Restore protected formatting codes and placeholders after translation.
 */
function restoreMinecraftTokens(text, tokens) {
  let restored = text;
  tokens.forEach((token, index) => {
    // Some translation services may insert spaces like [ #0 # ] or [# 0 #]
    const tokenRegex = new RegExp(`\\[\\s*#\\s*${index}\\s*#\\s*\\]`, 'g');
    restored = restored.replace(tokenRegex, token);
  });
  return restored;
}

module.exports = {
  MC_GLOSSARY,
  protectMinecraftTokens,
  restoreMinecraftTokens
};
