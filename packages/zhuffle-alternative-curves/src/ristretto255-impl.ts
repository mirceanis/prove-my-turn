import type { CurvePoint, EllipticCurve, FSRNG, PRNG, Scalar } from 'zhuffle';
import { bigIntToBytes } from 'zhuffle';
import { ed25519, ed25519_hasher, ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';

export class Ristretto255Impl implements EllipticCurve {
  hashToScalar(data: Uint8Array): Scalar {
      return ristretto255_hasher.hashToScalar(data);
  }

  add(p1: CurvePoint, p2: CurvePoint): CurvePoint {
    const result = ristretto255.Point.fromAffine(p1).add(ristretto255.Point.fromAffine(p2)).toAffine();
    return { x: result.x, y: result.y };
  }

  generator(): CurvePoint {
    const result = ristretto255.Point.BASE.toAffine();
    return { x: result.x, y: result.y };
  }

  mul(p: CurvePoint, scalar: Scalar): CurvePoint {
    // don't care about side-channel attacks here
    const result = ristretto255.Point.fromAffine(p).multiplyUnsafe(scalar).toAffine();
    return { x: result.x, y: result.y };
  }

  negate(p: CurvePoint): CurvePoint {
    const result = ristretto255.Point.fromAffine(p).negate().toAffine();
    return { x: result.x, y: result.y };
  }

  order(): bigint {
    return ristretto255.Point.Fn.ORDER;
  }

  randomScalar(rng: PRNG): Scalar {
    return ristretto255_hasher.hashToScalar(rng.randomBytes(32));
  }

  zero(): CurvePoint {
    const result = ristretto255.Point.ZERO.toAffine();
    return { x: result.x, y: result.y };
  }
}

export class Ed25519Impl implements EllipticCurve {
  add(p1: CurvePoint, p2: CurvePoint): CurvePoint {
    const result = ed25519.Point.fromAffine(p1).add(ed25519.Point.fromAffine(p2)).toAffine();
    return { x: result.x, y: result.y };
  }

  generator(): CurvePoint {
    const result = ed25519.Point.BASE.toAffine();
    return { x: result.x, y: result.y };
  }

  mul(p: CurvePoint, scalar: Scalar): CurvePoint {
    // don't care about side-channel attacks here
    const result = ed25519.Point.fromAffine(p).multiplyUnsafe(scalar).toAffine();
    return { x: result.x, y: result.y };
  }

  negate(p: CurvePoint): CurvePoint {
    const result = ed25519.Point.fromAffine(p).negate().toAffine();
    return { x: result.x, y: result.y };
  }

  order(): bigint {
    return ed25519.Point.Fn.ORDER;
  }

  randomScalar(rng: PRNG): Scalar {
    return ed25519_hasher.hashToScalar(rng.randomBytes(32));
  }

  zero(): CurvePoint {
    const result = ed25519.Point.ZERO.toAffine();
    return { x: result.x, y: result.y };
  }

  hashToScalar(data: Uint8Array): Scalar {
    return ed25519_hasher.hashToScalar(data);
  }
}

export class Sha512FSRNG implements FSRNG {
  state: Uint8Array;

  constructor(seed?: Uint8Array, initialState?: Uint8Array) {
    this.state = new Uint8Array(sha512.outputLen);
    if (initialState) {
      this.state.set(initialState.subarray(0, this.state.length));
    }
    if (seed) {
      this.absorb(seed);
    }
  }

  absorb(message: Uint8Array | CurvePoint[]): FSRNG {
    if (message instanceof Uint8Array) {
      const combined = new Uint8Array(this.state.length + message.length);
      combined.set(this.state);
      combined.set(message, this.state.length);
      this.state.set(sha512(combined).subarray(0, this.state.length));
    } else if (Array.isArray(message)) {
      for (const point of message) {
        const xBytes = bigIntToBytes(point.x);
        const combined = new Uint8Array(this.state.length + xBytes.length);
        combined.set(this.state);
        combined.set(xBytes, this.state.length);
        this.state.set(sha512(combined).subarray(0, this.state.length));
      }
    }
    return this;
  }

  clone(): FSRNG {
    return new Sha512FSRNG(undefined, this.state.slice());
  }

  randomBytes(length: number): Uint8Array {
    const result = new Uint8Array(length);
    let offset = 0;

    while (offset < length) {
      this.absorb(this.state);
      const bytesToCopy = Math.min(this.state.length, length - offset);
      result.set(this.state.slice(0, bytesToCopy), offset);
      offset += bytesToCopy;
    }
    return result;
  }
}
