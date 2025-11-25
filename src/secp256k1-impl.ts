import { CurvePoint, EllipticCurve, FSRNG, PRNG, Scalar } from './types';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bigIntToBytes, bytesToBigInt } from './utils';

export class Secp256k1Impl implements EllipticCurve {
  add(p1: CurvePoint, p2: CurvePoint): CurvePoint {
    const result = secp256k1.Point.fromAffine(p1).add(secp256k1.Point.fromAffine(p2)).toAffine();
    return { x: result.x, y: result.y };
  }

  generator(): CurvePoint {
    const result = secp256k1.Point.BASE.toAffine();
    return { x: result.x, y: result.y };
  }

  mul(p: CurvePoint, scalar: Scalar): CurvePoint {
    // don't care about side-channel attacks here
    const result = secp256k1.Point.fromAffine(p).multiplyUnsafe(scalar).toAffine();
    return { x: result.x, y: result.y };
  }

  negate(p: CurvePoint): CurvePoint {
    const result = secp256k1.Point.fromAffine(p).negate().toAffine();
    return { x: result.x, y: result.y };
  }

  order(): bigint {
    return secp256k1.Point.CURVE().n;
  }

  randomScalar(rng: PRNG): Scalar {
    return bytesToBigInt(secp256k1.utils.randomSecretKey(rng.randomBytes(48)));
  }

  zero(): CurvePoint {
    const result = secp256k1.Point.ZERO.toAffine();
    return { x: result.x, y: result.y };
  }
}

export class KeccakFSRNG implements FSRNG {
  state: Uint8Array;

  constructor(seed?: Uint8Array, initialState?: Uint8Array) {
    this.state = new Uint8Array(keccak_256.outputLen);
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
      this.state.set(keccak_256(combined).subarray(0, this.state.length));
    } else if (Array.isArray(message)) {
      for (const point of message) {
        const xBytes = bigIntToBytes(point.x);
        const combined = new Uint8Array(this.state.length + xBytes.length);
        combined.set(this.state);
        combined.set(xBytes, this.state.length);
        this.state.set(keccak_256(combined).subarray(0, this.state.length));
      }
    }
    return this;
  }

  clone(): FSRNG {
    return new KeccakFSRNG(undefined, this.state.slice());
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
