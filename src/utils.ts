import { Circuit, Group, PrivateKey, PublicKey, Scalar } from 'snarkyjs';
import { Card } from './card';

export const ZERO_KEY = PublicKey.fromGroup(Group.generator.sub(Group.generator));

/**
 * Computes a shared secret between a "local" key pair and a "remote" key pair, given the local private part and the
 * remote public part of the key pairs.
 *
 * @param local - the secret local key
 * @param remote - the remote public key
 *
 * @returns a `PublicKey` element representing the shared secret.
 */
export function computeSharedSecret(local: PrivateKey, remote: PublicKey): PublicKey {
  return PublicKey.fromGroup(remote.toGroup().scale(Scalar.ofFields(local.toFields())));
}

/**
 * jointEphemeral = jointEphemeral * (g ^ nonce)
 * maskedPoint = maskedPoint * (jointKey ^ nonce)
 *
 * it doesn't really matter if a card gets masked multiple times.
 *
 * @param card the card to be masked
 * @param nonce a random scalar. Must be different every time
 *
 * @returns a new `Card`
 */
export function mask(card: Card, nonce: Scalar = Scalar.random()): Card {
  const hasPlayers = card.pk.equals(ZERO_KEY);
  if (!hasPlayers) {
    throw new Error('illegal_operation: unable to mask as there are no players available to unmask');
  }
  const ePriv = PrivateKey.ofFields(nonce.toFields());
  const ePub = PublicKey.fromPrivateKey(ePriv);

  const epk = card.epk.toGroup().add(ePub.toGroup()); // add an ephemeral public key to the joint ephemeral
  // key
  const msg = card.msg.toGroup().add(computeSharedSecret(ePriv, card.pk).toGroup()); // apply ephemeral mask
  return new Card(PublicKey.fromGroup(epk), PublicKey.fromGroup(msg), card.pk);
}

/**
 * d1 = jointEphemeral ^ playerSecret
 * maskedPoint = maskedPoint / d1
 *
 * Partially unmasks a card.
 *
 * WARNING! This method does not check if the `playerSecret` corresponds to a known player.
 * If an invalid `playerSecret` is used here, it will return a corrupted `Card` that can never be unmasked.
 *
 * @param card - the card to be unmasked
 * @param playerSecret - the secret key corresponding to the PublicKey the player used to join the masking
 *
 * @returns a new `Card`
 */
export function partialUnmask(card: Card, playerSecret: PrivateKey): Card {
  const d1 = computeSharedSecret(playerSecret, card.epk);
  const msg = PublicKey.fromGroup(card.msg.toGroup().sub(d1.toGroup()));
  const pk = PublicKey.fromGroup(card.pk.toGroup().sub(playerSecret.toPublicKey().toGroup()));
  const isUnmasked = pk.equals(ZERO_KEY);
  const epk = Circuit.if(isUnmasked, ZERO_KEY, card.epk);
  return new Card(epk, msg, pk);
}

/**
 * Add a player to the masking of a card
 * @param card the card to be masked
 * @param playerSecret the secret key of the player
 */
export function addPlayerToCardMask(card: Card, playerSecret: PrivateKey): Card {
  const isUnmasked = card.pk.equals(ZERO_KEY);
  const pk = card.pk.toGroup().add(playerSecret.toPublicKey().toGroup());
  const epk = Circuit.if(isUnmasked, Group.generator, card.epk.toGroup()); // when unmasked, the epk is ZERO_KEY
  const newMsg = card.msg.toGroup().add(epk.scale(Scalar.ofFields(playerSecret.toFields())));
  const msg = Circuit.if(isUnmasked, card.msg.toGroup(), newMsg);
  return new Card(card.epk, PublicKey.fromGroup(msg), PublicKey.fromGroup(pk));
}

/**
 * Generates a shuffle for a given number of cards.
 * @param numCards - The number of cards to be shuffled.
 * @returns an array of indices that map the old deck to the new deck
 */
export function generateShuffle(numCards: number): Array<number> {
  const result: Array<number> = [];
  for (let i = numCards - 1; i >= 0; i--) {
    result[i] = Math.floor(Math.random() * i + 1);
  }
  return result;
}

/**
 * Applies a `shuffle` to a given deck of cards.
 * @param cards - the deck to be shuffled
 * @param shuffle - the array of new indices.
 *
 * @returns a new array with the contents shuffled
 */
export function shuffleArray<T>(cards: Array<T>, shuffle: Array<number>): Array<T> {
  const c = [...cards];
  for (let i = c.length - 1; i >= 0; i--) {
    const k = shuffle[i];
    [c[k], c[i]] = [c[i], c[k]];
  }
  return c;
}
