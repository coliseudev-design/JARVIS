import { argon2, randomBytes, createHash, timingSafeEqual, createHmac, createCipheriv, createDecipheriv } from 'node:crypto';

const params = { memory: 65536, passes: 3, parallelism: 1, tagLength: 32 };
function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => argon2('argon2id', { ...params, message: password, nonce: salt }, (err, hash) => err ? reject(err) : resolve(hash)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16), hash = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64').replace(/=+$/,'')}$${hash.toString('base64').replace(/=+$/,'')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const pieces = stored.split('$');
  if (pieces.length !== 6 || pieces[1] !== 'argon2id' || pieces[2] !== 'v=19' || pieces[3] !== 'm=65536,t=3,p=1') return false;
  const salt=Buffer.from(pieces[4]!,'base64'),expected=Buffer.from(pieces[5]!,'base64');
  if(salt.length!==16||expected.length!==32)return false;
  const hash = await derive(password, salt);
  return timingSafeEqual(hash, expected);
}
export const randomToken = () => randomBytes(32).toString('hex');
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export function constantEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function csrfFor(tokenHash: string, masterKey: string) {
  return createHmac('sha256', Buffer.from(masterKey, 'hex')).update('jarvis-csrf-v1:' + tokenHash).digest('base64url');
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
export function totp(secret: Buffer, counter: number, digits = 6) {
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(message).digest();
  const offset = hmac[19]! & 15;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, '0');
}
export function validTotp(secret: Buffer, code: string, now: number, lastCounter = -1) {
  const counter = Math.floor(now / 30000);
  for (const offset of [-1, 0, 1]) {
    const step = counter + offset;
    if (step > lastCounter && constantEqual(totp(secret, step), code)) return step;
  }
  return null;
}
export function encryptSeed(seed: Buffer, masterKey: string, userId: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);
  cipher.setAAD(Buffer.from('jarvis-mfa-v1:' + userId));
  const encrypted = Buffer.concat([cipher.update(seed), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function decryptSeed(value: string, masterKey: string, userId: string) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('INVALID_FACTOR');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from('jarvis-mfa-v1:' + userId)); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]);
}
