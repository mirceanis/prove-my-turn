import { Card } from './card';
import { CircuitString, Poseidon, PrivateKey, PublicKey } from 'snarkyjs';
import { Player } from './player';
import { computeJointKey, ZERO_KEY } from './utils';

export class Deck {
  cards: Array<Card> = Deck.cardFaces.map(Deck.face2Card);
  jointShuffleKey: PublicKey;
  jointCardKeys: Array<PublicKey> = [];

  constructor(players: Array<Player>) {
    this.jointShuffleKey = computeJointKey(players.map((p) => p.shuffleKey));
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

  static cardFaces = Deck.buildCardFaces();

  static face2Card(cardFace: string): Card {
    const cardPoint = PrivateKey.ofFields([Poseidon.hash(CircuitString.fromString(cardFace).toFields())]).toPublicKey();
    return new Card(ZERO_KEY, cardPoint);
  }

  static card2Face(card: Card): string {
    return Deck.cardFaces.find((k) => Deck.face2Card(k).maskedPoint.equals(card.maskedPoint).toBoolean()) ?? 'unknown';
  }
}
