import { Card, Deck, EllipticCurve, PRNG, Scalar } from './types';
import { bytesToBigInt, mask } from './utils';

export const RANKS = 'A,2,3,4,5,6,7,8,9,10,J,Q,K'.split(',');
export const SUITES = '♠️,♥️,♦️,♣️'.split(',');
export const JOKERS = '🦹,🦸'.split(',');
export const UNKNOWN_CARD = '🫟';

export class DeckBuilder {
  public cardFaces: string[] = [];
  private cards: Card[] = [];
  private card2FaceMap: Map<string, string> = new Map();
  private curve: EllipticCurve;

  withCardFaces(cardFaces: string[]): DeckBuilder {
    this.cardFaces = cardFaces;
    return this;
  }

  withCurve(curve: EllipticCurve): DeckBuilder {
    this.curve = curve;
    return this;
  }

  card2Face(card: Card): string {
    return this.card2FaceMap.get(`${card.msg.x.toString(16)}${card.msg.y.toString(16)}`) ?? UNKNOWN_CARD;
  }
  buildDeck(): Deck {
    this.cards = [];
    this.card2FaceMap.clear();
    for (let face of this.cardFaces) {
      const card = face2Card(this.curve, face);
      this.cards.push(card);
      this.card2FaceMap.set(`${card.msg.x.toString(16)}${card.msg.y.toString(16)}`, face);
    }
    return { cards: this.cards, jointPublicKey: this.curve.zero() } as Deck;
  }
}

export const STANDARD_DECK = [...RANKS.flatMap((rank) => SUITES.map((suite) => `${rank}${suite}`)), ...JOKERS];

export function face2Card(curve: EllipticCurve, cardFace: string): Card {
  const cardBytes = new TextEncoder().encode(cardFace); // ensure utf-8 encoding
  const msg = curve.mul(curve.generator(), bytesToBigInt(cardBytes));
  const epk = curve.mul(curve.generator(), 1n); // the initial ephemeral private key doesn't matter??
  return { epk, msg } as Card;
}

/**
 * Generates a permutation for a given number of cards.
 * @param numCards - The number of cards to be shuffled.
 * @param rng - a pseudo-random number generator
 * @returns an array of indices that map the old deck to the new deck
 */
export function generatePermutation(numCards: number, rng: PRNG): Array<number> {
  const result: Array<number> = Array.from({ length: numCards }, (_, i) => i);
  for (let i = numCards - 1; i > 0; i--) {
    // Generate an unbiased random index in range [0, i] using rejection sampling
    const j = randomIndex(i + 1, rng);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate an unbiased random index in range [0, max) using rejection sampling
 * This ensures uniform distribution without modulo bias.
 * This method is not designed for large `max` values that don't fit in a JS number.
 */
export function randomIndex(max: number, rng: PRNG): number {
  // Calculate how many bytes we need to represent max
  const bytesNeeded = Math.ceil(Math.log2(max) / 8) || 1;

  // Calculate the largest multiple of max that fits in our byte range
  const range = 256 ** bytesNeeded;
  const limit = range - (range % max);

  let value: number;
  do {
    // Generate random bytes and convert to number
    const bytes = rng.randomBytes(bytesNeeded);
    value = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      value = (value << 8) | bytes[i];
    }
  } while (value >= limit); // Reject values that would cause bias

  return value % max;
}

/**
 * Applies a given `permutation` to a given deck of `cards` and returns a new array containing the shuffled cards.
 * @param cards - the deck to be shuffled
 * @param permutation - the array of new indices.
 *
 * NOTE: this method does not validate the permutation, not even the lengths of the arrays!
 *
 * @returns a new array with the contents shuffled
 */
export function shuffleArray<T>(cards: Array<T>, permutation: Array<number>): Array<T> {
  const result = new Array<T>(cards.length);
  for (let i = 0; i < cards.length; i++) {
    result[i] = cards[permutation[i]];
  }
  return result;
}

export function playerJoin(curve: EllipticCurve, deck: Deck, playerSecret: Scalar): Deck {
  const playerPub = curve.mul(curve.generator(), playerSecret);
  const jointPublicKey = curve.add(deck.jointPublicKey, playerPub);
  const cards = deck.cards.map((card) => {
    const mask = curve.mul(card.epk, playerSecret);
    const newMsg = curve.add(card.msg, mask);
    return { epk: card.epk, msg: newMsg } as Card;
  });
  return <Deck>{ cards, jointPublicKey };
}

export function shuffleMask(curve: EllipticCurve, deck: Deck, permutation: Array<number>, masks: Array<Scalar>): Deck {
  if (permutation.length !== deck.cards.length || masks.length !== deck.cards.length) {
    throw new Error('illegal_argument: permutation and masks sizes must match the number of cards in the deck');
  }
  const cards = shuffleArray(deck.cards, permutation).map((card, index) => {
    return mask(curve, card, deck.jointPublicKey, masks[index]);
  });
  return <Deck>{ cards, jointPublicKey: deck.jointPublicKey };
}
