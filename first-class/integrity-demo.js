const crypto = require('crypto');

const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const plainText = 'My bank password is'; // 19 bytes -> 2 AES blocks (32 bytes padded)

// =========================================================
// CBC: tamper with the FIRST block -> NO error thrown
// =========================================================
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
console.log('ciphertext length:', enc.length, 'bytes (2 blocks)');

const tampered = Buffer.from(enc);
tampered[2] ^= 0x01; // flip one bit inside block 1 (bytes 0-15)

try {
  const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const out = Buffer.concat([d.update(tampered), d.final()]);
  console.log('CBC tampered ->', JSON.stringify(out.toString('utf8')));
  console.log('>>> NO ERROR. padding sits in block 2, so block-1 tampering slips through.\n');
} catch (e) {
  console.log('CBC tampered -> error:', e.message, '\n');
}

// =========================================================
// GCM: tamper anywhere -> decipher.final() THROWS
// =========================================================
const ivG = crypto.randomBytes(12);
const cG = crypto.createCipheriv('aes-256-gcm', key, ivG);
const encG = Buffer.concat([cG.update(plainText, 'utf8'), cG.final()]);
const tag = cG.getAuthTag(); // <-- this must be sent alongside, like a JWT signature

const tamperedG = Buffer.from(encG);
tamperedG[2] ^= 0x01;

try {
  const dG = crypto.createDecipheriv('aes-256-gcm', key, ivG);
  dG.setAuthTag(tag);
  const outG = Buffer.concat([dG.update(tamperedG), dG.final()]);
  console.log('GCM tampered ->', JSON.stringify(outG.toString('utf8')));
} catch (e) {
  console.log('GCM tampered -> error:', e.message);
  console.log('>>> DETECTED. the auth tag check failed — real integrity.');
}
