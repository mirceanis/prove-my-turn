// import { bytesToHex, hexToBytes } from '@noble/curves/utils.js';
import { Card, EllipticCurve, CurvePoint, LocalPlayer, PRNG, Scalar } from './types';
import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import { hexToNumber } from '@noble/curves/utils.js';

/**
 * jointEphemeral = jointEphemeral + nonce * G
 * maskedPoint = maskedPoint + nonce * jointKey
 *
 * it doesn't really matter if a card gets masked multiple times.
 *
 * @param curve - the elliptic curve implementation
 * @param card the card to be masked
 * @param jointPublicKey - the joint public key of all the players that will participate in unmasking
 * @param nonce a random scalar. Must be different every time
 *
 * @returns a new `Card`
 */
export function mask(curve: EllipticCurve, card: Card, jointPublicKey: CurvePoint, nonce: Scalar): Card {
  const epk = curve.add(card.epk, curve.mul(curve.generator(), nonce)); // add an ephemeral public key to the joint ephemeral key
  const msg = curve.add(card.msg, curve.mul(jointPublicKey, nonce)); // apply ephemeral mask
  return { epk, msg } as Card;
}

/**
 * D1 = playerSecret * jointEphemeral
 * unmaskedPoint = maskedPoint - D1
 *
 * Partially unmasks a card.
 *
 * WARNING! This method does not check if the `playerSecret` corresponds to a known player.
 * If an invalid `playerSecret` is used here, it will return a corrupted `Card` that can never be unmasked.
 * This validation must be done at a higher level.
 *
 * @param curve - the elliptic curve implementation
 * @param card - the card to be unmasked
 * *
 * @param playerSecret - the secret key corresponding to the PublicKey the player used to join the masking
 *
 * @returns a new `Card`
 */
export function partialUnmask(curve: EllipticCurve, card: Card, playerSecret: Scalar): Card {
  const d1 = curve.mul(card.epk, playerSecret);
  const partial = curve.add(card.msg, curve.negate(d1));
  return { epk: card.epk, msg: partial } as Card;
}

export function newPlayer(curve: EllipticCurve, rnd: PRNG): LocalPlayer {
  const secret = curve.randomScalar(rnd);
  const publicKey = curve.mul(curve.generator(), secret);
  return { secret, publicKey } as LocalPlayer;
}

/**
 * Convert a Uint8Array to a bigint
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt('0x' + bytesToHex(bytes))
  // return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
}

/**
 * Convert a bigint to a Uint8Array of specified length (big-endian).
 * Pads with leading zeros if smaller, throws if larger.
 */
export function bigIntToBytes(value: bigint, length: number = 32): Uint8Array {

  const hex = value.toString(16).padStart(length * 2, '0');
  return hexToBytes(hex);
  //
  // if (value === 0n) {
  //   return new Uint8Array(length);
  // }
  //
  // const bytes: number[] = [];
  // while (value > 0n) {
  //   bytes.push(Number(value & 0xffn));
  //   value >>= 8n;
  // }
  //
  // const result = Uint8Array.from(bytes.reverse());
  //
  // if (result.length > length) {
  //   throw new Error(
  //     `bigintToBytes: value requires ${result.length} bytes, but length ${length} was specified`,
  //   );
  // }
  //
  // if (result.length < length) {
  //   const padded = new Uint8Array(length);
  //   padded.set(result, length - result.length);
  //   return padded;
  // }
  //
  // return result;
}
