import { describe, it } from 'node:test';
import assert from 'node:assert';
import { newPlayer, partialUnmask } from 'zhuffle';
import type { PRNG } from 'zhuffle';
import { STANDARD_DECK, generatePermutation, playerJoin, shuffleMask, DeckBuilder } from 'zhuffle';
import crypto from 'node:crypto';
import { Ristretto255Impl } from '../ristretto255-impl';

const curve = new Ristretto255Impl();
const rng: PRNG = {
  randomBytes: (length: number) => new Uint8Array(crypto.randomBytes(length)),
};
const deckBuilder = new DeckBuilder().withCardFaces(STANDARD_DECK).withCurve(curve);

describe('shuffleMask', () => {
  it('one player shuffle and mask the deck', () => {
    const p1 = newPlayer(curve, rng);

    let deck = deckBuilder.buildDeck();
    deck = playerJoin(curve, deck, p1.secret);

    // player 1 shuffles and masks every card
    const p1Permutation = generatePermutation(deck.cards.length, rng);
    const p1Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p1Permutation, p1Nonces);

    // player1 unmasks
    let unmasked = deck.cards.map((card) => partialUnmask(curve, card, p1.secret));
    // verify all cards are opened
    const openedCards = unmasked.map((card) => deckBuilder.card2Face(card));
    assert.deepStrictEqual(new Set(openedCards), new Set(deckBuilder.cardFaces));
    console.log('openedCards', openedCards);
  });

  it('player 1 and player 2 can shuffle and mask the deck', () => {
    const p1 = newPlayer(curve, rng);
    const p2 = newPlayer(curve, rng);

    let deck = deckBuilder.buildDeck();
    deck = playerJoin(curve, deck, p1.secret);
    deck = playerJoin(curve, deck, p2.secret);

    // player 1 shuffles and masks every card
    const p1Permutation = generatePermutation(deck.cards.length, rng);
    const p1Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p1Permutation, p1Nonces);

    // player 2 shuffles and masks every card
    const p2Permutation = generatePermutation(deck.cards.length, rng);
    const p2Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p2Permutation, p2Nonces);

    // player1 unmasks
    let unmasked = deck.cards.map((card) => partialUnmask(curve, card, p1.secret));
    // player2 unmasks
    unmasked = unmasked.map((card) => partialUnmask(curve, card, p2.secret));
    // verify all cards are opened
    const openedCards = unmasked.map((card) => deckBuilder.card2Face(card));
    assert.deepStrictEqual(new Set(openedCards), new Set(deckBuilder.cardFaces));
    console.log('openedCards', openedCards);
  });

  it('player can join later in game', () => {
    const p1 = newPlayer(curve, rng);
    const p2 = newPlayer(curve, rng);

    let deck = deckBuilder.buildDeck();
    deck = playerJoin(curve, deck, p1.secret);
    deck = playerJoin(curve, deck, p2.secret);

    // player 1 shuffles and masks every card
    const p1Permutation = generatePermutation(deck.cards.length, rng);
    const p1Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p1Permutation, p1Nonces);

    // player 2 shuffles and masks every card
    const p2Permutation = generatePermutation(deck.cards.length, rng);
    const p2Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p2Permutation, p2Nonces);

    // // player 3 joins
    const p3 = newPlayer(curve, rng);
    deck = playerJoin(curve, deck, p3.secret);
    // player 3 shuffles and masks every card
    const p3Permutation = generatePermutation(deck.cards.length, rng);
    const p3Nonces = Array.from({ length: deck.cards.length }, () => curve.randomScalar(rng));
    deck = shuffleMask(curve, deck, p3Permutation, p3Nonces);

    // player1 unmasks
    let unmasked = deck.cards.map((card) => partialUnmask(curve, card, p1.secret));
    // player2 unmasks
    unmasked = unmasked.map((card) => partialUnmask(curve, card, p2.secret));
    // player3 unmasks
    unmasked = unmasked.map((card) => partialUnmask(curve, card, p3.secret));

    // verify all cards are opened
    const openedCards = unmasked.map((card) => deckBuilder.card2Face(card));
    assert.deepStrictEqual(new Set(openedCards), new Set(deckBuilder.cardFaces));
    assert.notStrictEqual(openedCards.join(','), deckBuilder.cardFaces.join(','));
    console.log('openedCards', openedCards);
  });
});
