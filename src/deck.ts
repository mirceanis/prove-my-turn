import { CircuitString, Poseidon, PrivateKey, PublicKey } from 'snarkyjs';
import { Card } from './card';
import { ZERO_KEY } from './utils';

/**
 * A deck of playing cards including 2 jokers
 */
export const CARDS_IN_DECK = 13 * 4 + 2;

export class Deck {
  private readonly _cardFaces: string[];
  public cards: Array<Card>;
  static UNKNOWN_CARD: '__unknown_card__';

  constructor(cardFaces: string[] = []) {
    this._cardFaces = cardFaces;
    this.cards = this._cardFaces.map(Deck.face2Card);
  }

  static buildCardFaces(): string[] {
    const cardFaces: string[] = [];
    const values = 'Ace,2,3,4,5,6,7,8,9,10,Jack,Queen,King'.split(',');
    const suites = 'Spades,Hearts,Diamonds,Clubs'.split(',');
    const jokers = 'Black Joker,Red Joker'.split(',');
    for (let value of values) {
      for (let suite of suites) {
        const cardFace = `${value} of ${suite}`;
        cardFaces.push(cardFace);
      }
    }
    cardFaces.push(...jokers);
    return cardFaces;
  }

  static face2Card(cardFace: string): Card {
    const cardPoint = PrivateKey.fromBits(
      Poseidon.hash(CircuitString.fromString(cardFace).toFields()).toBits()
    ).toPublicKey();
    return new Card(ZERO_KEY, cardPoint, ZERO_KEY);
  }

  card2Face(card: Card): string {
    return this._cardFaces.find((k) => Deck.face2Card(k).msg.equals(card.msg).toBoolean()) ?? Deck.UNKNOWN_CARD;
  }

  private static _standardDeckWithJokers: Deck;
  static get standardDeckWithJokers(): Deck {
    return this._standardDeckWithJokers || (this._standardDeckWithJokers = new Deck(this.buildCardFaces()));
  }
}
