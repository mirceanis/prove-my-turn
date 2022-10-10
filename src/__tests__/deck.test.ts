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

  it('maps cards to different points', async () => {
    const c1 = Deck.face2Card('hello');
    const c2 = Deck.face2Card('world');
    expect(c1).not.toEqual(c2);
  });

  it('all cards are different points', () => {
    expect(new Set(new Deck().cards.map((card) => card.msg)).size).toBe(13 * 4 + 2);
  });

  it('shuffles and masks', async () => {
    const deck = new Deck(['hello', 'world']);
    const p1 = new Player(deck.cards.length);
    const p2 = new Player(deck.cards.length);

    // player 1 shuffles and masks every card
    p1.shuffleAndMaskDeck(deck);
    // player 2 shuffles and masks every card
    p2.shuffleAndMaskDeck(deck);
    // player 1 unmasks each card with their shuffle key and re-masks using a card index key
    p1.reMaskEachCard(deck);
    // player 2 unmasks each card with their shuffle key and re-masks using a card index key
    p2.reMaskEachCard(deck);
    // player 1 unmasks top card
    p1.openCard(deck, 0);
    // player 2 unmasks top card
    const topCard = p2.openCard(deck, 0);
    // expect(topCard).to be one of the original pack
    expect(deck.card2Face(topCard)).not.toEqual(Deck.UNKNOWN_CARD);

    p1.openCard(deck, 1);
    const secondCard = p2.openCard(deck, 1);

    expect(deck.card2Face(secondCard)).not.toEqual(Deck.UNKNOWN_CARD);
    expect(deck.card2Face(secondCard)).not.toEqual(deck.card2Face(topCard));
  });
});
