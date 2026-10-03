import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, base32, totp, validTotp, encryptSeed, decryptSeed } from './crypto.js';
describe('credential primitives', () => {
  it('hashes passwords with unique salts and rejects an incorrect password', async () => {
    const a = await hashPassword('synthetic password 1234'); const b = await hashPassword('synthetic password 1234');
    expect(a).not.toBe(b); expect(a).toContain('$argon2id$');
    expect(await verifyPassword('synthetic password 1234', a)).toBe(true);
    expect(await verifyPassword('wrong password', a)).toBe(false);
  });
  it('matches RFC6238 SHA1 vectors and rejects replay', () => {
    const secret = Buffer.from('12345678901234567890');
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    for (const [seconds, expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037']] as const) {
      expect(totp(secret, Math.floor(seconds/30), 8)).toBe(expected);
    }
    const step = 100;
    expect(validTotp(secret, totp(secret, step), step*30000, step)).toBeNull();
  });
  it('binds encrypted MFA seeds to the owner and rejects tampering', () => {
    const key = 'ab'.repeat(32), seed = Buffer.from('12345678901234567890');
    const sealed = encryptSeed(seed, key, 'owner-r');
    expect(decryptSeed(sealed, key, 'owner-r')).toEqual(seed);
    expect(() => decryptSeed(sealed, key, 'owner-m')).toThrow();
    expect(() => decryptSeed(sealed.slice(0,-3)+'AAA',key,'owner-r')).toThrow();
  });
});
