import { isReady, PrivateKey, shutdown } from 'snarkyjs';
import { Deck } from '../deck';
import { addPlayerToCardMask, mask, partialUnmask } from '../utils';

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

  it('masks one card by 2 players and unmask in different orders', async () => {
    const priv1 = PrivateKey.random();
    const priv2 = PrivateKey.random();

    const originalCard = Deck.face2Card('Ace of spades');

    const c1 = addPlayerToCardMask(originalCard, priv1);
    const masked_once = mask(c1);
    const c2 = addPlayerToCardMask(masked_once, priv2);
    const masked_twice = mask(c2);

    expect(originalCard.msg).not.toEqual(masked_once.msg);
    expect(masked_once.msg).not.toEqual(masked_twice.msg);

    // unmasking first by player2, then player1
    const unmasked_once_2 = partialUnmask(masked_twice, priv2);
    expect(unmasked_once_2.msg).not.toEqual(masked_once.msg);
    const unmasked_twice_1 = partialUnmask(unmasked_once_2, priv1);
    expect(unmasked_twice_1.msg).toEqual(originalCard.msg);

    // unmasking first by player1, then player2
    const unmasked_once_1 = partialUnmask(masked_twice, priv1);
    expect(unmasked_once_1.msg).not.toEqual(masked_once.msg);
    const unmasked_twice_2 = partialUnmask(unmasked_once_1, priv2);
    expect(unmasked_twice_2.msg).toEqual(originalCard.msg);
  });

  it('masks one card by 2 players and unmask in different orders', async () => {
    const priv1 = PrivateKey.random();
    const priv2 = PrivateKey.random();

    const originalCard = Deck.face2Card('Ace of spades');

    const m1 = mask(mask(mask(addPlayerToCardMask(originalCard, priv1))));
    const m2 = mask(mask(mask(addPlayerToCardMask(m1, priv2))));

    expect(originalCard.msg).not.toEqual(m1.msg);
    expect(m1.msg).not.toEqual(m2.msg);

    // unmasking first by player2, then player1
    const unmasked_once_2 = partialUnmask(m2, priv2);
    expect(unmasked_once_2.msg).not.toEqual(m1.msg);
    const unmasked_twice_1 = partialUnmask(unmasked_once_2, priv1);
    expect(unmasked_twice_1.msg).toEqual(originalCard.msg);

    // unmasking first by player1, then player2
    const unmasked_once_1 = partialUnmask(m2, priv1);
    expect(unmasked_once_1.msg).not.toEqual(m1.msg);
    const unmasked_twice_2 = partialUnmask(unmasked_once_1, priv2);
    expect(unmasked_twice_2.msg).toEqual(originalCard.msg);
  });
});
