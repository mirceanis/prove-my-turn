import { describe, it } from 'node:test';
import assert from 'node:assert';
import { bytesToBigInt, bigIntToBytes } from '../utils';

describe('bytesToBigInt', () => {
  it('should convert an empty array to 0n', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([])), 0n);
  });

  it('should convert a single byte', () => {
    assert.strictEqual(bytesToBigInt(new Uint8Array([0x42])), 0x42n);
    assert.strictEqual(bytesToBigInt(new Uint8Array([0xff])), 0xffn);
    assert.strictEqual(bytesToBigInt(new Uint8Array([0x00])), 0n);
  });

  it('should convert multiple bytes (big-endian)', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    assert.strictEqual(bytesToBigInt(bytes), 0x01020304n);
  });

  it('should handle leading zero bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02]);
    assert.strictEqual(bytesToBigInt(bytes), 0x0102n);
  });

  it('should round-trip with bigIntToBytes', () => {
    const values = [0n, 1n, 255n, 256n, 0x01020304n, 0xffffffffn, 0n];
    for (const v of values) {
      const bytes = bigIntToBytes(v);
      assert.strictEqual(bytesToBigInt(bytes), v);
    }
  });
});

describe('bigIntToBytes', () => {
  it('should convert 0n to a zero-filled array of given length', () => {
    assert.deepStrictEqual(bigIntToBytes(0n, 32), new Uint8Array(32));
    assert.deepStrictEqual(bigIntToBytes(0n, 1), new Uint8Array([0]));
  });

  it('should default to 32 bytes', () => {
    assert.strictEqual(bigIntToBytes(1n).length, 32);
  });

  it('should convert small values padded to length', () => {
    const bytes = bigIntToBytes(0x42n, 4);
    assert.deepStrictEqual(bytes, new Uint8Array([0x00, 0x00, 0x00, 0x42]));
  });

  it('should convert larger values with correct byte order', () => {
    const bytes = bigIntToBytes(0x01020304n, 4);
    assert.deepStrictEqual(bytes, new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  it('should throw when value exceeds specified length', () => {
    assert.throws(() => bigIntToBytes(0x0102030405n, 4), /requires 5 bytes/);
  });

  it('should round-trip with bytesToBigInt', () => {
    const values = [0n, 1n, 255n, 256n, 0x01020304n, 0xffffffffn, 0xdeadbeefcafebaben];
    for (const v of values) {
      const bytes = bigIntToBytes(v, 32);
      assert.strictEqual(bytesToBigInt(bytes), v);
    }
  });
});
