/**
 * db.js - MongoDB Atlas connection & user collection helpers
 *
 * Nếu biến môi trường MONGODB_URI được đặt, hệ thống dùng MongoDB để lưu dữ liệu
 * người dùng vĩnh viễn (phù hợp Render / Railway cloud).
 *
 * Nếu KHÔNG có MONGODB_URI (chạy local), tự động fallback về file data/users.json.
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let usersCol = null;
let modsCol = null;
let linkGateChallengesCol = null;

const MONGO_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'mcpe_translator';

/**
 * Kết nối tới MongoDB Atlas (chỉ gọi một lần khi server khởi động)
 */
async function connectMongo() {
  if (!MONGO_URI) return false;
  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    await client.connect();
    db = client.db(DB_NAME);
    usersCol = db.collection('users');
    modsCol = db.collection('mods');
    linkGateChallengesCol = db.collection('link_gate_challenges');

    // Index để tìm kiếm email nhanh
    await usersCol.createIndex({ email: 1 }, { unique: true });
    await linkGateChallengesCol.createIndex({ challengeHash: 1 }, { unique: true });
    await linkGateChallengesCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('✅ MongoDB Atlas connected successfully!');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.warn('⚠️  Falling back to local file storage (data/users.json)');
    client = null;
    db = null;
    usersCol = null;
    modsCol = null;
    linkGateChallengesCol = null;
    return false;
  }
}

/** Kiểm tra có đang dùng MongoDB không */
function isMongoConnected() {
  return !!usersCol;
}

/** Lấy toàn bộ danh sách người dùng từ MongoDB */
async function findAllUsers() {
  if (!usersCol) return null; // null = dùng fallback file
  return usersCol.find({}).toArray();
}

/** Tìm user theo ID */
async function findUserById(id) {
  if (!usersCol) return null;
  return usersCol.findOne({ id });
}

/** Tìm user theo email (đã normalize) */
async function findUserByEmail(email) {
  if (!usersCol) return null;
  return usersCol.findOne({ email: email.toLowerCase() });
}

/** Thêm user mới vào DB */
async function insertUser(user) {
  if (!usersCol) return null;
  const result = await usersCol.insertOne(user);
  return result;
}

/** Cập nhật thông tin user theo id */
async function updateUser(id, updates) {
  if (!usersCol) return null;
  return usersCol.updateOne({ id }, { $set: updates });
}

/** Lấy số lượng user */
async function countUsers() {
  if (!usersCol) return null;
  return usersCol.countDocuments();
}

/** ---- Kho mod ---- */
async function findAllMods() {
  if (!modsCol) return null;
  return modsCol.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}
async function insertMod(mod) {
  if (!modsCol) return null;
  return modsCol.insertOne({ ...mod });
}
async function deleteMod(id) {
  if (!modsCol) return null;
  const r = await modsCol.deleteOne({ id });
  return r.deletedCount;
}

/** Link4M return challenges: hashes only, consumed atomically. */
async function insertLinkGateChallenge(challengeHash, userId, expiresAt) {
  if (!linkGateChallengesCol) return false;
  await linkGateChallengesCol.insertOne({ challengeHash, userId, expiresAt });
  return true;
}
async function consumeLinkGateChallenge(challengeHash, userId) {
  if (!linkGateChallengesCol) return false;
  const result = await linkGateChallengesCol.deleteOne({ challengeHash, userId, expiresAt: { $gt: new Date() } });
  return result.deletedCount === 1;
}

module.exports = {
  findAllMods,
  insertMod,
  deleteMod,
  insertLinkGateChallenge,
  consumeLinkGateChallenge,
  connectMongo,
  isMongoConnected,
  findAllUsers,
  findUserById,
  findUserByEmail,
  insertUser,
  updateUser,
  countUsers,
};
