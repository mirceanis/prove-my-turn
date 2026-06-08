/**
 * Random Number Generator interface.
 */
export interface PRNG {
  randomBytes(length: number): Uint8Array;
}

/**
 * Fiat-Shamir Random Number Generator interface.
 */
export interface FSRNG extends PRNG {
  absorb(message: Uint8Array | CurvePoint[]): FSRNG;
  clone(): FSRNG;
}

/**
 *  Chaum-Pedersen proof. Designed for serialization.
 */
export type CPProof = {
  a: CurvePoint; // First commitment (A)
  b: CurvePoint; // Second commitment (B)
  r: Scalar; // Response (s)
};
/**
 * Represents a playing card, masked or not.
 */
export type Card = {
  /**
   * The joint ephemeral key for this card accumulated during all the masking operations.
   */
  epk: CurvePoint;

  /**
   * The card value (or masked value) represented as a Group element (PublicKey).
   *
   * Mapping to and from actual game cards and group elements must be done at the application level.
   */
  msg: CurvePoint;
};

export interface Deck {
  cards: Card[];
  jointPublicKey: CurvePoint;
}

export interface Player {
  publicKey: CurvePoint;
}

export interface LocalPlayer extends Player {
  secret: Scalar;
}

export type Scalar = bigint;

export type CurvePoint = {
  x: bigint;
  y: bigint;
};

export interface EllipticCurve {
  generator(): CurvePoint;
  add(p1: CurvePoint, p2: CurvePoint): CurvePoint;
  mul(p: CurvePoint, scalar: Scalar): CurvePoint;
  zero(): CurvePoint;
  negate(p: CurvePoint): CurvePoint;
  order(): bigint;
  randomScalar(rng: PRNG): Scalar;
  hashToScalar(data: Uint8Array): Scalar;
}
