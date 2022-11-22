import { Circuit, PrivateKey, PublicKey, Struct } from 'snarkyjs';
import { addPlayerToCardMask, generateShuffle, KeyUtils, mask, partialUnmask, shuffleArray } from './utils.js';
import { Card } from './card.js';
import { CARDS_IN_DECK } from './deck.js';

/**
 * Holds the Public Keys a player uses to mask cards
 */
export class PlayerKeys extends Struct({
  shuffleKey: PublicKey,
  cardKeys: Circuit.array<PublicKey>(PublicKey, CARDS_IN_DECK),
}) {
  private static _BLANK: PlayerKeys;

  static get BLANK() {
    return (
      this._BLANK ||
      (this._BLANK = new PlayerKeys({
        shuffleKey: PublicKey.empty(),
        cardKeys: Array(CARDS_IN_DECK).fill(PublicKey.empty()),
      }))
    );
  }

  static fromSecrets(secrets: PlayerSecrets): PlayerKeys {
    if (secrets._cardKeys.length !== CARDS_IN_DECK) {
      throw new Error(
        `can't initialize different number of public keys(${CARDS_IN_DECK}) versus secret keys(${secrets._cardKeys.length})`
      );
    }
    const cardKeys = secrets._cardKeys.map((key) => key.toPublicKey());
    const shuffleKey = secrets._shuffleKey.toPublicKey();
    return { shuffleKey, cardKeys } as PlayerKeys;
  }
}

/**
 * Holds the private keys a player uses to open cards
 */
export class PlayerSecrets extends Struct({
  _shuffleKey: PrivateKey,
  _cardKeys: Circuit.array<PrivateKey>(PrivateKey, CARDS_IN_DECK),
}) {
  private static _BLANK: PlayerSecrets;

  static get BLANK() {
    return (
      this._BLANK ||
      (this._BLANK = new PlayerSecrets({
        _shuffleKey: KeyUtils.emptyPrivateKey,
        _cardKeys: Array(CARDS_IN_DECK).fill(KeyUtils.emptyPrivateKey),
      }))
    );
  }

  static generate(): PlayerSecrets {
    const _shuffleKey = PrivateKey.random();
    const _cardKeys = [];
    for (let i = 0; i < CARDS_IN_DECK; i++) {
      _cardKeys.push(PrivateKey.random());
    }
    return { _shuffleKey, _cardKeys };
  }
}

export class Player {
  secrets: PlayerSecrets;
  publicKeys: PlayerKeys;

  constructor() {
    this.secrets = PlayerSecrets.generate();
    this.publicKeys = PlayerKeys.fromSecrets(this.secrets);
  }

  /**
   * Shuffles and masks the cards in the given deck with a single "shuffle key".
   *
   * @param cards - the deck to be shuffled
   * @returns a new array of Cards where the cards have been shuffled and masked
   *
   * TBD:
   *   * assert that the same cards are present after the shuffle
   *   * assert that player was added with expected shuffle key
   *   * scalar assertions during masking
   */
  shuffleAndMaskDeck(cards: Card[]): Card[] {
    if (cards.length !== this.secrets._cardKeys.length) {
      throw new Error('illegal_argument: number of cards and number of keys must match to shuffle the deck');
    }
    const shuffle = generateShuffle(cards.length);
    return shuffleArray(cards, shuffle)
      .map((card) => addPlayerToCardMask(card, this.secrets._shuffleKey))
      .map((card) => mask(card));
  }

  /**
   * Re-masks each card in a shuffled deck with a key specific for that card index.
   *
   * @param cards - the deck of cards to be re-masked
   * @returns the a new deck with the cards re-masked
   *
   * TBD:
   *   * assert cards are unmasked with expected shuffle key
   *   * assert player is added with expected card keys
   *   * scalar assertions during masking
   */
  reMaskEachCard(cards: Card[]): Card[] {
    if (cards.length !== this.secrets._cardKeys.length) {
      throw new Error('illegal_argument: number of cards and number of keys must match to re-mask the deck');
    }
    return cards.map((card, index) => {
      const unmasked = partialUnmask(card, this.secrets._shuffleKey);
      const remaskableCard = addPlayerToCardMask(unmasked, this.secrets._cardKeys[index]);
      return mask(remaskableCard);
    });
  }

  /**
   * Unmask a particular card in the deck using the masking key for that card.
   *
   * @param cards - the deck with the masked card
   * @param index - the index of the card in the deck
   *
   * @returns a new deck where that card is opened
   *
   * TBD:
   *   * assert that all cards are left intact except that one card
   *   * assert player opened that card with expected key
   */
  openCard(cards: Card[], index: number): Card[] {
    if (cards.length !== this.secrets._cardKeys.length) {
      throw new Error('illegal_argument: number of cards and number of keys must match to open a particular card');
    }
    const newCard = partialUnmask(cards[index], this.secrets._cardKeys[index]);
    const newCards = [...cards];
    newCards[index] = newCard;
    return newCards;
  }
}
