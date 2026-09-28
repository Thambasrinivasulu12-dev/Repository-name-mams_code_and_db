const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const file = process.env.DB_FILE || path.join(__dirname, '..', 'mams.db');
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// scrypt password hashing (built-in, no dependencies) -> "salt:hash" (hex)
const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
const verifyPassword = (pw, stored) => {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
module.exports = { db, hashPassword, verifyPassword };
