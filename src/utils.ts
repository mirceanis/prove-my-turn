import { Group, PrivateKey, PublicKey, Scalar } from 'snarkyjs';
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

export function computeJointKey(playerKeys: Array<PublicKey>): PublicKey {
  return playerKeys.reduce((jointKey: PublicKey, key: PublicKey) =>
    PublicKey.fromGroup(jointKey.toGroup().add(key.toGroup()))
  );
}

// it doesn't really matter if a card gets masked multiple times.
export function mask(card: Card, jointKey: PublicKey, nonce: Scalar): Card {
  const ePriv = PrivateKey.ofFields(nonce.toFields());
  const ePub = PublicKey.fromPrivateKey(ePriv);
  const c1 = card.jointEphemeral.toGroup().add(ePub.toGroup()); // add an ephemeral public key to the joint ephemeral key
  const c2 = card.maskedPoint.toGroup().add(computeSharedSecret(ePriv, jointKey).toGroup()); // apply ephemeral mask
  return new Card(PublicKey.fromGroup(c1), PublicKey.fromGroup(c2));
}

export function partialUnmask(card: Card, playerSecret: PrivateKey): Card {
  const d1 = computeSharedSecret(playerSecret, card.jointEphemeral);
  const c2 = card.maskedPoint.toGroup().sub(d1.toGroup());
  return new Card(card.jointEphemeral, PublicKey.fromGroup(c2)); // partially unmasked card, the ephemeral key remains intact,
  // meaning no further masking can be done.
}
