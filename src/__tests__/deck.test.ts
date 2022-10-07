import { isReady, shutdown } from 'snarkyjs';
import { Deck } from '../deck';
import { Player } from '../player';

describe('basic deck operations', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('all cards are different points', () => {
    expect(new Set(new Deck([]).cards).size).toBe(13 * 4 + 2);
  });

  it.skip('shuffles and masks', async () => {
    // const p1 = new Player(13 * 4 + 2)
    // const p2 = new Player(13 * 4 + 2)
    // const deck = new Deck([p1, p2])
    // player 1 shuffles and masks every card
    // player 2 shuffles and masks every card
    // player 1 unmasks each card with their shuffle key and re-masks using a card index key
    // player 2 unmasks each card with their shuffle key and re-masks using a card index key
    // player 1 unmasks top card
    // player 2 unmasks top card
    // expect(topCard).to be one of the original pack
  });
});
