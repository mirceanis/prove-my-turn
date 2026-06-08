import { describe, it } from 'node:test';
import {
  DeckBuilder,
  generatePermutation,
  generateShuffleMaskProof,
  newPlayer,
  playerJoin,
  type PRNG,
  shuffleMask,
  STANDARD_DECK,
  verifyShuffleMaskProof,
} from 'zhuffle';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { Ristretto255Impl, Sha512FSRNG } from '../ristretto255-impl';
import { PallasImpl, PoseidonFSPRNG } from '../o1js-impl';

const rng: PRNG = {
  randomBytes: (length: number) => new Uint8Array(crypto.randomBytes(length)),
};

describe('shuffleMaskProofs', () => {
  it('round trip shuffle-mask proof with Ristretto255 & Sha512', () => {
    const curve = new Ristretto255Impl();
    const deckBuilder = new DeckBuilder().withCardFaces(STANDARD_DECK).withCurve(curve);
    let originalDeck = deckBuilder.buildDeck();
    const p1 = newPlayer(curve, rng);
    const p2 = newPlayer(curve, rng);
    originalDeck = playerJoin(curve, originalDeck, p1.secret);
    originalDeck = playerJoin(curve, originalDeck, p2.secret);

    // player 1 shuffles and masks every card
    const permutation = generatePermutation(originalDeck.cards.length, rng);
    const masks = Array.from({ length: originalDeck.cards.length }, () => curve.randomScalar(rng));
    const shuffledDeck = shuffleMask(curve, originalDeck, permutation, masks);

    const fsrng = new Sha512FSRNG(new TextEncoder().encode('shuffle-mask-proof-test-seed'));

    const p1ShuffleProof = generateShuffleMaskProof(
      curve,
      originalDeck,
      shuffledDeck,
      permutation,
      masks,
      fsrng.clone(),
      rng
    );
    const verified = verifyShuffleMaskProof(curve, originalDeck, shuffledDeck, p1ShuffleProof, fsrng.clone());

    assert.ok(verified);
  });

  it('round trip shuffle-mask proof with Pallas & Poseidon', () => {
    const curve = new PallasImpl();
    const deckBuilder = new DeckBuilder().withCardFaces(STANDARD_DECK).withCurve(curve);
    let originalDeck = deckBuilder.buildDeck();
    const p1 = newPlayer(curve, rng);
    const p2 = newPlayer(curve, rng);
    originalDeck = playerJoin(curve, originalDeck, p1.secret);
    originalDeck = playerJoin(curve, originalDeck, p2.secret);

    // player 1 shuffles and masks every card
    const permutation = generatePermutation(originalDeck.cards.length, rng);
    const masks = Array.from({ length: originalDeck.cards.length }, () => curve.randomScalar(rng));
    const shuffledDeck = shuffleMask(curve, originalDeck, permutation, masks);

    const fsrng = new PoseidonFSPRNG(new TextEncoder().encode('shuffle-mask-proof-test-seed'));

    const p1ShuffleProof = generateShuffleMaskProof(
      curve,
      originalDeck,
      shuffledDeck,
      permutation,
      masks,
      fsrng.clone(),
      rng
    );
    const verified = verifyShuffleMaskProof(curve, originalDeck, shuffledDeck, p1ShuffleProof, fsrng.clone());

    assert.ok(verified);
  });
});
