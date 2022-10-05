import { CircuitValue, prop, PublicKey } from 'snarkyjs';

/**
 * Represents a playing card, masked or not.
 */
export class Card extends CircuitValue {
  /**
   * The joint ephemeral key for this card, resulting from all the masking operations.
   * New cards should have this set to `Group.generator`
   */
  @prop jointEphemeral: PublicKey;

  /**
   * The card value( or masked value) represented as a Group element.
   *
   * Mapping to and from actual game cards and group elements must be done at the application level.
   */
  @prop maskedPoint: PublicKey;

  constructor(c1: PublicKey, c2: PublicKey) {
    super();
    this.jointEphemeral = c1;
    this.maskedPoint = c2;
  }
}
