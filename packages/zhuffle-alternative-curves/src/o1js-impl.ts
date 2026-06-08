import type { CurvePoint, EllipticCurve, FSRNG, PRNG, Scalar } from 'zhuffle';
import { bigIntToBytes, bytesToBigInt } from 'zhuffle';
import { Crypto, Field, Poseidon } from 'o1js';

// the modulus. called `p` in most of our code.
const p = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const q = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
const pallasGeneratorProjective = {
  x: 1n,
  y: 12418654782883325593414442427049395787963493412651469444558597405572177144507n,
};
const pallasEndoBase = 20444556541222657078399132219657928148671392403212669005631716460534733845831n;
const pallasEndoScalar = 26005156700822196841419187675678338661165322343552424574062261873906994770353n;

// the b and a in y^2 = x^3 + ax + b
const b = 5n;
const a = 0n;

const pallas = Crypto.createCurve({
  name: 'Pallas',
  modulus: p,
  order: q,
  generator: pallasGeneratorProjective,
  b,
  a,
  endoBase: pallasEndoBase,
  endoScalar: pallasEndoScalar,
});

export class PallasImpl implements EllipticCurve {
  add(p1: CurvePoint, p2: CurvePoint): CurvePoint {
    const result = pallas.add(pallas.from(p1), pallas.from(p2));
    return { x: result.x, y: result.y };
  }

  generator(): CurvePoint {
    return pallasGeneratorProjective;
  }

  mul(p: CurvePoint, scalar: Scalar): CurvePoint {
    const result = pallas.scale(pallas.from(p), scalar);
    return { x: result.x, y: result.y };
  }

  negate(p: CurvePoint): CurvePoint {
    const result = pallas.negate(pallas.from(p));
    return { x: result.x, y: result.y };
  }

  order(): bigint {
    return pallas.order;
  }

  randomScalar(rng: PRNG): Scalar {
    return pallas.Scalar.fromBigint(bytesToBigInt(rng.randomBytes(32)));
  }

  zero(): CurvePoint {
    const result = pallas.zero;
    return { x: result.x, y: result.y };
  }

  hashToScalar(data: Uint8Array): Scalar {
    return pallas.Scalar.fromBigint(bytesToBigInt(data) % pallas.order);
  }
}

export class PoseidonFSPRNG implements FSRNG {
  #state: [Field, Field, Field];

  constructor(seed?: Uint8Array, initialState?: [Field, Field, Field]) {
    this.#state = initialState ?? Poseidon.initialState();
    if (seed) {
      this.absorb(seed);
    }
  }

  randomBytes(length: number): Uint8Array {
    const result = new Uint8Array(length);
    let offset = 0;
    let counter = 0;

    do {
      this.absorb([{ x: BigInt(counter), y: 0n }]); // Absorb counter as a Group point
      let bytes = bigIntToBytes(this.#state[0].toBigInt()).slice(1); // Use lower 31 bytes
      const bytesToCopy = Math.min(bytes.length, length - offset);
      result.set(bytes.slice(0, bytesToCopy), offset);
      offset += bytesToCopy;
      counter++;
    } while (offset < length);

    return result;
  }

  clone(): FSRNG {
    return new PoseidonFSPRNG(undefined, this.#state.slice() as [Field, Field, Field]);
  }

  absorb(message: Uint8Array | CurvePoint[]): FSRNG {
    if (message instanceof Uint8Array) {
      let offset = 0;
      while (offset < message.length) {
        const chunk = message.slice(offset, offset + 31);
        this.#state = Poseidon.update(this.#state, [Field.from(bytesToBigInt(chunk))]);
        offset += 31;
      }
    } else if (Array.isArray(message)) {
      this.#state = Poseidon.update(
        this.#state,
        message.map((g) => Field.from(g.x))
      );
    }
    return this;
  }
}
