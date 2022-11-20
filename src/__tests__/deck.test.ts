import { isReady, PublicKey, shutdown } from 'snarkyjs';
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

  it('maps cards to distinct points', () => {
    expect(new Set(new Deck(['hello', 'hello', 'world']).cards.map((card) => card.msg.toBase58())).size).toBe(2);
  });

  it('all cards in a standard deck are distinct points', () => {
    expect(new Set(Deck.standardDeckWithJokers.cards.map((card) => card.msg.toBase58())).size).toBe(13 * 4 + 2);
  });

  it('shuffles and masks', async () => {
    const dd = Deck.standardDeckWithJokers;
    let deck = dd.cards;
    const p1 = new Player();
    const p2 = new Player();

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

  it.skip('generates cards', async () => {
    const builtCards = Deck.buildCardFaces();
    const mapped = builtCards.cardFaces.map((face) => {
      return { face, card: Deck.face2Card(face).msg.toBase58() };
    });
    const byFace: Record<string, string> = {};
    for (const cc of mapped) {
      byFace[cc.face] = cc.card;
    }
    const bySuite: Record<string, string[]> = {};
    for (const suite of Object.keys(builtCards.bySuite)) {
      bySuite[suite] = builtCards.bySuite[suite].map((face) => byFace[face]);
    }
    const byRank: Record<string, string[]> = {};
    for (const rank of Object.keys(builtCards.byRank)) {
      byRank[rank] = builtCards.byRank[rank].map((face) => byFace[face]);
    }

    console.dir({ byFace, bySuite, byRank }, { depth: 10 });
  });
});
