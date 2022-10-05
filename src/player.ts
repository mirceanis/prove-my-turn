import { PrivateKey, PublicKey } from 'snarkyjs';

export class Player {
  private readonly _shuffleKey: PrivateKey;
  private readonly _cardKeys: Array<PrivateKey>;

  public readonly shuffleKey: PublicKey;

  public readonly cardKeys: Array<PublicKey>;

  constructor(numCards: number) {
    this._shuffleKey = PrivateKey.random();
    this.shuffleKey = this._shuffleKey.toPublicKey();

    this._cardKeys = Array<PrivateKey>(numCards).map(() => PrivateKey.random());
    this.cardKeys = this._cardKeys.map((k) => k.toPublicKey());
  }
}
