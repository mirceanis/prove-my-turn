import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateCPProof, verifyCPProof } from 'zhuffle';
import type { CPProof, PRNG } from 'zhuffle';
import { Sha512FSRNG, Ristretto255Impl } from '../ristretto255-impl';
import * as crypto from 'node:crypto';

const curve = new Ristretto255Impl();
const rng: PRNG = {
  randomBytes: (length: number) => new Uint8Array(crypto.randomBytes(length)),
};

describe('Chaum-Pedersen proofs rr', () => {
  describe('generateCPProof', () => {
    it('should generate a valid proof with correct structure', () => {
      const g = curve.mul(curve.generator(), 2n);
      const h = curve.mul(curve.generator(), 3n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      assert.ok(proof);
      assert.ok(proof.a);
      assert.ok(proof.a.x);
      assert.ok(proof.a.y);
      assert.ok(proof.b);
      assert.ok(proof.b.x);
      assert.ok(proof.b.y);
      assert.ok(proof.r);
    });

    it('should generate different proofs for the same inputs (due to randomness)', () => {
      const g = curve.mul(curve.generator(), 3n);
      const h = curve.mul(curve.generator(), 4n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng1 = new Sha512FSRNG();
      const fsprng2 = new Sha512FSRNG();

      const proof1 = generateCPProof(curve, x, y, g, h, alfa, fsprng1, rng);
      const proof2 = generateCPProof(curve, x, y, g, h, alfa, fsprng2, rng);

      // Proofs should be different due to random omega
      assert.notDeepStrictEqual(proof1.a, proof2.a);
      assert.notDeepStrictEqual(proof1.b, proof2.b);
      assert.notStrictEqual(proof1.r, proof2.r);
    });
  });

  describe('verifyCPProof', () => {
    it('should verify a valid proof', () => {
      const g = curve.mul(curve.generator(), 4n);
      const h = curve.mul(curve.generator(), 5n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, proof, x, y, g, h, verifierFsprng);

      assert.strictEqual(isValid, true);
    });

    it('should reject proof with wrong x value', () => {
      const g = curve.mul(curve.generator(), 5n);
      const h = curve.mul(curve.generator(), 6n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      const wrongX = curve.add(x, curve.generator());
      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, proof, wrongX, y, g, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject proof with wrong x value', () => {
      const g = curve.mul(curve.generator(), 6n);
      const h = curve.mul(curve.generator(), 7n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      const wrongY = curve.add(y, curve.generator());
      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, proof, x, wrongY, g, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject proof with wrong g base point', () => {
      const g = curve.mul(curve.generator(), 7n);
      const h = curve.mul(curve.generator(), 8n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      const wrongG = curve.mul(g, 2n);
      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, proof, x, y, wrongG, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject proof with wrong h base point', () => {
      const g = curve.mul(curve.generator(), 8n);
      const h = curve.mul(curve.generator(), 9n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      const wrongH = curve.mul(h, 2n);
      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, proof, x, y, g, wrongH, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject tampered commitment1', () => {
      const g = curve.mul(curve.generator(), 9n);
      const h = curve.mul(curve.generator(), 10n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      // Tamper with commitment1
      const tamperedProof: CPProof = {
        ...proof,
        a: curve.add(proof.a, curve.generator()),
      };

      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, tamperedProof, x, y, g, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject tampered commitment2', () => {
      const g = curve.mul(curve.generator(), 10n);
      const h = curve.mul(curve.generator(), 11n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      // Tamper with commitment2
      const tamperedProof: CPProof = {
        ...proof,
        b: curve.add(proof.b, curve.generator()),
      };

      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, tamperedProof, x, y, g, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should reject tampered response', () => {
      const g = curve.mul(curve.generator(), 11n);
      const h = curve.mul(curve.generator(), 12n);
      const alfa = curve.randomScalar(rng);
      const x = curve.mul(g, alfa);
      const y = curve.mul(h, alfa);
      const fsprng = new Sha512FSRNG();

      const proof = generateCPProof(curve, x, y, g, h, alfa, fsprng, rng);

      // Tamper with commitment1
      const tamperedProof: CPProof = {
        ...proof,
        r: curve.randomScalar(rng),
      };

      const verifierFsprng = new Sha512FSRNG();
      const isValid = verifyCPProof(curve, tamperedProof, x, y, g, h, verifierFsprng);

      assert.strictEqual(isValid, false);
    });

    it('should work with multiple valid proofs in sequence', () => {
      const g = curve.mul(curve.generator(), 12n);
      const h = curve.mul(curve.generator(), 13n);

      for (let i = 0; i < 5; i++) {
        const alfa = curve.randomScalar(rng);
        const x = curve.mul(g, alfa);
        const y = curve.mul(h, alfa);

        const proof = generateCPProof(curve, x, y, g, h, alfa, new Sha512FSRNG(), rng);

        const isValid = verifyCPProof(curve, proof, x, y, g, h, new Sha512FSRNG());

        assert.strictEqual(isValid, true);
      }
    });
  });
});
