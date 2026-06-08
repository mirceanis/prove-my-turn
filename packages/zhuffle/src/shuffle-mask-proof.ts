import { Deck, EllipticCurve, FSRNG, PRNG, Scalar } from './types';
import { generatePermutation, shuffleMask } from './deck-utils';

export const SECURITY_PARAM = 16;

export type TestShuffleData = {
  reshuffledDeck: Deck;
  permutation: number[];
  masks: Scalar[];
};

/**
 * Reveal data for one test shuffle
 */
interface RevealData {
  permutation: number[]; // σ'_j or σ ∘ σ'_j
  masks: Scalar[]; // R_j or R'_j
}

/**
 * Complete shuffle proof
 */
interface ShuffleProof {
  reshuffles: Deck[];
  reveals: RevealData[];
}

export function generateShuffleMaskProof(
  curve: EllipticCurve,
  originalDeck: Deck,
  shuffledDeck: Deck, // the deck after shuffling using `permutation` and masking using `masks`
  permutation: number[],
  masks: Scalar[],
  fsrng: FSRNG,
  rng: PRNG
): ShuffleProof {
  // Step 1: shuffled deck was already provided as input
  // Step 2: Create SECURITY_PARAM number of test shuffles
  const testData: TestShuffleData[] = [];
  for (let j = 0; j < SECURITY_PARAM; j++) {
    const sigmaPrime = generatePermutation(originalDeck.cards.length, rng);
    const Rj = Array.from({ length: originalDeck.cards.length }, () => curve.randomScalar(rng));
    const reshuffledDeck = shuffleMask(curve, shuffledDeck, sigmaPrime, Rj);

    testData.push({
      reshuffledDeck: reshuffledDeck,
      permutation: sigmaPrime,
      masks: Rj,
    });
  }

  // Step 3: Generate the challenge
  const challengeSet = generateChallenge(
    fsrng,
    originalDeck,
    shuffledDeck,
    testData.map((td) => td.reshuffledDeck)
  );

  // Step 4: Generate reveals and proofs
  const reveals: RevealData[] = [];
  for (let j = 0; j < SECURITY_PARAM; j++) {
    if (challengeSet.has(j)) {
      // Prove this revealed deck came from the shuffled deck
      reveals.push({
        permutation: testData[j].permutation,
        masks: testData[j].masks,
      });
    } else {
      // Prove this revealed deck came from the original deck
      const permutationComposed = testData[j].permutation.map((v) => permutation[v]);
      const masksComposed = computeCombinedMasks(curve, masks, testData[j].permutation, testData[j].masks);
      reveals.push({
        permutation: permutationComposed,
        masks: masksComposed,
      });
    }
  }

  return {
    reshuffles: testData.map((td) => td.reshuffledDeck),
    reveals,
  };
}

/**
 * Compute R'_j which represents combined masking from D to D''_j.
 *
 * For elliptic curve ElGamal, re-masking adds randomness:
 * E'_h((c1, c2); r) = (c1 + r*G, c2 + r*h)
 *
 * So the combined mask is: r'_j,i = R[sigmaPrime[i]] + R_j[i] (mod q)
 */
function computeCombinedMasks(curve: EllipticCurve, R: Scalar[], sigmaPrime: number[], Rj: Scalar[]): Scalar[] {
  const RPrime: Scalar[] = [];

  for (let i = 0; i < R.length; i++) {
    // Combined mask is sum of individual masks (mod curve order)
    const rPrime = (R[sigmaPrime[i]] + Rj[i]) % curve.order();
    RPrime.push(rPrime);
  }

  return RPrime;
}

function generateChallenge(
  fsrng: FSRNG,
  originalDeck: Deck,
  shuffledDeck: Deck,
  challengeShuffles: Deck[]
): Set<number> {
  const allInputs = [
    originalDeck.jointPublicKey,
    ...originalDeck.cards.map((card) => [card.epk, card.msg]).flat(),
    ...shuffledDeck.cards.map((card) => [card.epk, card.msg]).flat(),
    ...challengeShuffles.map((deck) => deck.cards.map((card) => [card.epk, card.msg]).flat()).flat(),
  ];
  fsrng.absorb(allInputs);
  const bytesNeeded = Math.ceil(SECURITY_PARAM / 8);
  const challengeHash = fsrng.randomBytes(bytesNeeded);

  const challengeSet = new Set<number>();
  for (let j = 0; j < SECURITY_PARAM; j++) {
    const byteIndex = Math.floor(j / 8);
    const bitIndex = j % 8;
    const bit = (challengeHash[byteIndex] >> bitIndex) & 1;
    if (bit === 1) {
      challengeSet.add(j);
    }
  }

  return challengeSet;
}

/**
 * Verify a non-interactive shuffle proof.
 *
 * @returns True if proof is valid, false otherwise
 */
export function verifyShuffleMaskProof(
  curve: EllipticCurve,
  originalDeck: Deck,
  shuffledDeck: Deck,
  proof: ShuffleProof,
  fsrng: FSRNG
): boolean {
  // step 0: basic checks
  if (proof.reshuffles.length !== SECURITY_PARAM || proof.reveals.length !== SECURITY_PARAM) {
    return false;
  }

  // Step 1: Recompute challenge
  const challengeSet = generateChallenge(fsrng, originalDeck, shuffledDeck, proof.reshuffles);

  // Step 2: Verify each reshuffle
  for (let j = 0; j < SECURITY_PARAM; j++) {
    const reveal = proof.reveals[j];
    if (reveal.masks.length !== originalDeck.cards.length || reveal.permutation.length !== originalDeck.cards.length) {
      return false;
    }
    const reshuffledDeck = proof.reshuffles[j];
    if (reshuffledDeck.cards.length !== originalDeck.cards.length) {
      return false;
    }

    const originDeck = challengeSet.has(j) ? shuffledDeck : originalDeck;
    const valid = verifyRemasking(curve, originDeck, reshuffledDeck, reveal.permutation, reveal.masks);
    if (!valid) {
      return false;
    }
  }

  return true;
}

/**
 * Verify that the targetDeck can be obtained from the sourceDeck by applying the given permutation and masks.
 */
function verifyRemasking(
  curve: EllipticCurve,
  sourceDeck: Deck,
  targetDeck: Deck,
  permutation: number[],
  masks: Scalar[]
): boolean {
  const expectedShuffledDeck = shuffleMask(curve, sourceDeck, permutation, masks);

  // Compare expected shuffled deck with target deck
  for (let i = 0; i < sourceDeck.cards.length; i++) {
    const expectedCard = expectedShuffledDeck.cards[i];
    const targetCard = targetDeck.cards[i];
    if (
      expectedCard.epk.x !== targetCard.epk.x ||
      expectedCard.epk.y !== targetCard.epk.y ||
      expectedCard.msg.x !== targetCard.msg.x ||
      expectedCard.msg.y !== targetCard.msg.y
    ) {
      return false;
    }
  }

  return true;
}
