import { CircuitValue, prop, PublicKey } from 'snarkyjs';

/**
 * Represents a playing card, masked or not.
 */
export class Card extends CircuitValue {
  /**
   * The joint ephemeral key for this card, resulting from all the masking operations.
   * New cards should have this set to the zero point (For example `Group.generator.sub(Group.generator)`)
   */
  @prop epk: PublicKey;

  /**
   * The card value( or masked value) represented as a Group element.
   *
   * Mapping to and from actual game cards and group elements must be done at the application level.
   */
  @prop msg: PublicKey;

  /**
   * The elliptic curve point representing the sum of the public keys of all players masking this card.
   */
  @prop pk: PublicKey;

  constructor(c1: PublicKey, c2: PublicKey, h: PublicKey) {
    super();
    this.epk = c1;
    this.msg = c2;
    this.pk = h;
  }
}
