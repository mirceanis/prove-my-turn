import { isReady, PrivateKey, Scalar, shutdown } from 'snarkyjs';
import { Deck } from '../deck';
import { computeJointKey, mask, partialUnmask } from '../utils';

describe('Mask', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('masks one card twice and unmask in different orders', async () => {
    const priv1 = PrivateKey.random();
    const priv2 = PrivateKey.random();
    const pub1 = priv1.toPublicKey();
    const pub2 = priv2.toPublicKey();

    const originalCard = Deck.face2Card('Ace of spades');

    const jointKey = computeJointKey([pub1, pub2]);
    const masked_once = mask(originalCard, jointKey, Scalar.random());
    const masked_twice = mask(masked_once, jointKey, Scalar.random());

    // unmasking first by player2, then player1
    const unmasked_once_2 = partialUnmask(masked_twice, priv2);
    const unmasked_twice_1 = partialUnmask(unmasked_once_2, priv1);
    expect(unmasked_twice_1.maskedPoint).toEqual(originalCard.maskedPoint);

    // unmasking first by player1, then player2
    const unmasked_once_1 = partialUnmask(masked_twice, priv1);
    const unmasked_twice_2 = partialUnmask(unmasked_once_1, priv2);
    expect(unmasked_twice_2.maskedPoint).toEqual(originalCard.maskedPoint);
  });
});
