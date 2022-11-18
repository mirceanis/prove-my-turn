import { arrayProp, CircuitValue, PrivateKey, prop, PublicKey } from 'snarkyjs';
import { addPlayerToCardMask, generateShuffle, mask, partialUnmask, shuffleArray } from './utils';
import { Card } from './card';

/**
 * Base class used in the factory that generates {@link PlayerSecrets_} class built for a specific number of cards.
 * It represents the secret keys used during the (de)encryption process.
 */
export class BasePlayerSecrets extends CircuitValue {
  /**
   * The number of cards in the deck.
   * This static number gets set by the factory.
   */
  static numCards: number;

  /**
   * private key used during the first stage of the shuffle and mask operation
   */
  @prop _shuffleKey: PrivateKey;

  /**
   * List of private keys used for masking each card in the deck in the second stage of the shuffle and mask operation
   */
  _cardKeys: PrivateKey[];
}

/**
 * Creates a {@link PlayerSecrets_} class for a deck with a specific number of cards
 * @param numCards - the number of cards in the deck
 */
export function PlayerSecretsFactory(numCards: number): typeof BasePlayerSecrets {
  class PlayerSecrets_ extends BasePlayerSecrets {
    static numCards = numCards;

    constructor() {
      super();
      this._shuffleKey = PrivateKey.random();
      this._cardKeys = [];
      for (let i = 0; i < PlayerSecrets_.numCards; i++) {
        this._cardKeys.push(PrivateKey.random());
      }
    }
  }

  arrayProp(PrivateKey, numCards)(PlayerSecrets_.prototype, 'numCards');
  return PlayerSecrets_;
}

/**
 * Base class used in the factory that generates {@link PlayerKeys_} class built for a specific number of cards.
 * It represents the collection of public keys corresponding to the decryption keys in a {@link PlayerSecrets_}.
 */
export class BasePlayerKeys extends CircuitValue {
  static numCards: number;
  @prop shuffleKey: PublicKey;
  cardKeys: PublicKey[];
}

/**
 * Creates a {@link PlayerKeys_} class for a deck with a specific number of cards
 * @param numCards - the number of cards in the deck
 */
export function PlayerKeysFactory(numCards: number): typeof BasePlayerKeys {
  class PlayerKeys_ extends BasePlayerKeys {
    static numCards = numCards;

    constructor(secrets: BasePlayerSecrets) {
      super();
      if (secrets._cardKeys.length !== PlayerKeys_.numCards) {
        throw new Error(
          `can't initialize different number of public keys(${PlayerKeys_.numCards}) versus secret keys(${secrets._cardKeys.length})`
        );
      }
      this.cardKeys = secrets._cardKeys.map((key) => key.toPublicKey());
      this.shuffleKey = secrets._shuffleKey.toPublicKey();
    }
  }

  arrayProp(PublicKey, numCards)(PlayerKeys_.prototype, 'numCards');
  return PlayerKeys_;
}

export class Player {
  secrets: BasePlayerSecrets;
  publicKeys: BasePlayerKeys;

  constructor(numCards: number) {
    class PlayerSecrets extends PlayerSecretsFactory(numCards) {}
    class PlayerKeys extends PlayerKeysFactory(numCards) {}

    this.secrets = new PlayerSecrets();
    this.publicKeys = new PlayerKeys(this.secrets);
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
