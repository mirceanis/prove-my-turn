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

  it('maps same card to same point', async () => {
    const c1 = Deck.face2Card('hello');
    const c2 = Deck.face2Card('hello');
    expect(c1).toEqual(c2);
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
    const dd = new Deck(['hello', 'world']);
    let deck = dd.cards;
    const p1 = new Player(deck.length);
    const p2 = new Player(deck.length);

    // player 1 shuffles and masks every card
    deck = p1.shuffleAndMaskDeck(deck);
    // player 2 shuffles and masks every card
    deck = p2.shuffleAndMaskDeck(deck);
    // player 1 unmasks each card with their shuffle key and re-masks using a card index key
    deck = p1.reMaskEachCard(deck);
    // player 2 unmasks each card with their shuffle key and re-masks using a card index key
    deck = p2.reMaskEachCard(deck);
    // unmask all cards
    for (let i = 0; i < deck.length; i++) {
      // player 1 unmasks card
      deck = p1.openCard(deck, i);
      // player 2 unmasks card
      deck = p2.openCard(deck, i);
    }
    // expect(topCard).to be one of the original pack
    expect(dd.card2Face(deck[0])).not.toEqual(Deck.UNKNOWN_CARD);
    expect(dd.card2Face(deck[1])).not.toEqual(Deck.UNKNOWN_CARD);
    expect(dd.card2Face(deck[1])).not.toEqual(dd.card2Face(deck[0]));
  });
});
