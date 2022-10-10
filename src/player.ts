import { PrivateKey, PublicKey } from 'snarkyjs';
import { Deck } from './deck';
import { addPlayerToCardMask, generateShuffle, mask, partialUnmask, shuffleArray } from './utils';
import { Card } from './card';

export class Player {
  private readonly _shuffleKey: PrivateKey;
  private readonly _cardKeys: Array<PrivateKey>;

  public readonly shuffleKey: PublicKey;

  public readonly cardKeys: Array<PublicKey>;

  constructor(numCards: number) {
    this._shuffleKey = PrivateKey.random();
    this.shuffleKey = this._shuffleKey.toPublicKey();

    this._cardKeys = [];
    for (let i = 0; i < numCards; i++) {
      this._cardKeys.push(PrivateKey.random());
    }
    this.cardKeys = this._cardKeys.map((k) => k.toPublicKey());
  }

  /**
   * Shuffles and masks the cards in the given deck with a single "shuffle key".
   * This modifies the deck cards.
   *
   * @param deck - the deck to be shuffled
   * @returns the same `Deck` with the cards shuffled and masked.
   */
  shuffleAndMaskDeck(deck: Deck): Deck {
    const shuffle = generateShuffle(deck.cards.length);
    deck.cards = shuffleArray(deck.cards, shuffle)
      .map((card) => addPlayerToCardMask(card, this._shuffleKey))
      .map((card) => mask(card));
    return deck;
  }

  /**
   * Re-masks each card in a shuffled deck with a key specific for that card index.
   *
   * @param deck - the deck of cards to be re-masked
   * @returns the same `Deck` with the cards re-masked
   */
  reMaskEachCard(deck: Deck): Deck {
    deck.cards = deck.cards.map((card, index) => {
      const unmasked = partialUnmask(card, this._shuffleKey);
      const remaskableCard = addPlayerToCardMask(unmasked, this._cardKeys[index]);
      return mask(remaskableCard);
    });
    return deck;
  }

  /**
   * Unmask a particular card in the deck using the masking key for that card.
   * This modifies the deck in place and returns that unmasked card.
   *
   * @param deck - the deck with the masked card
   * @param index - the index of the card in the deck
   */
  openCard(deck: Deck, index: number): Card {
    const newCard = partialUnmask(deck.cards[index], this._cardKeys[index]);
    deck.cards[index] = newCard;
    return newCard;
  }
}
