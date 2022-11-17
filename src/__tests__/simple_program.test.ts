import {
  arrayProp,
  CircuitValue,
  Experimental,
  Field,
  isReady,
  PrivateKey,
  prop,
  PublicKey,
  Scalar,
  SelfProof,
  shutdown,
  verify,
} from 'snarkyjs';
import { addPlayerToCardMask, mask, ZERO_KEY } from '../utils';
import { Deck } from '../deck';
import { Card } from '../card';
import { Player } from '../player';

class TestGameState extends CircuitValue {
  static numPlayers = 2;

  @prop playerIndex: Field;
  @prop card: Card;
  @arrayProp(PublicKey, TestGameState.numPlayers) players: PublicKey[];

  constructor(card: Card, players: PublicKey[]) {
    super();
    this.card = card;
    this.players = players;
    this.playerIndex = Field.zero;
  }
}

let cardOperations = Experimental.ZkProgram({
  publicInput: TestGameState,
  methods: {
    init: {
      privateInputs: [],

      method(publicInput: TestGameState) {
        const card = publicInput.card;
        card.msg.equals(ZERO_KEY).assertEquals(false);
        card.epk.assertEquals(ZERO_KEY);
        card.pk.assertEquals(ZERO_KEY);
      },
    },
    join: {
      privateInputs: [PrivateKey, SelfProof<TestGameState>],

      method(publicInput: TestGameState, playerSecret: PrivateKey, earlierProof: SelfProof<TestGameState>) {
        // earlierProof.verify();

        // verify that the player is legit

        // const pubKey = playerSecret.toPublicKey();
        // let count = Field.zero
        // for (let i = 0; i < TestGameState.numPlayers; i++) {
        //   const foundPlayer = earlierProof.publicInput.players[i].equals(pubKey);
        //   count = count.add(Circuit.if(foundPlayer, Field(1), Field(0)));
        // }
        // // assert that player matches their public commitment, appearing once
        // count.assertEquals(Field(1))

        // TODO: assert that player did not replace someone else
        // ??? don't know how yet

        const newCard = addPlayerToCardMask(earlierProof.publicInput.card, playerSecret);
        // card matches the expected pre-masked state
        newCard.assertEquals(publicInput.card);
      },
    },
    mask: {
      privateInputs: [Scalar, SelfProof],
      method(publicInput: TestGameState, nonce: Scalar, earlierProof: SelfProof<TestGameState>) {
        // earlierProof.verify();
        const newCard = mask(earlierProof.publicInput.card, nonce);
        newCard.assertEquals(publicInput.card);
      },
    },
    // unmask: {
    //   privateInputs: [PrivateKey, SelfProof],
    //
    //   method(publicInput: Card, playerSecret: PrivateKey, earlierProof: SelfProof<Card>) {
    //     earlierProof.verify();
    //     const newCard = partialUnmask(earlierProof.publicInput, playerSecret);
    //     newCard.assertEquals(publicInput);
    //   },
    // },
  },
});

describe('zkProgram test', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it.skip('program operations', async () => {
    let MyProof = Experimental.ZkProgram.Proof(cardOperations);
    const originalDeck = new Deck(['hello world']);
    let cards = originalDeck.cards;
    const p1 = new Player(1);
    const p2 = new Player(1);

    console.log('program digest', cardOperations.digest());

    console.log('compiling');
    console.time('compiling');
    let { verificationKey } = await cardOperations.compile();
    console.timeEnd('compiling');
    console.log('verification key', verificationKey.slice(0, 10) + '..');

    const gs = new TestGameState(cards[0], [ZERO_KEY, ZERO_KEY]);
    // gs.players

    console.log('initial state');
    console.time('initial state');
    let proof = await cardOperations.init(gs);
    console.timeEnd('initial state');
    proof = testJsonRoundtrip(proof);

    console.log('verify...');
    console.time('verify...');
    let ok = await verify(proof.toJSON(), verificationKey);
    console.timeEnd('verify...');
    console.log('ok?', ok);

    console.log('player 1 joining...');
    gs.card = addPlayerToCardMask(gs.card, p1.secrets._shuffleKey);
    gs.players[0] = p1.publicKeys.shuffleKey;
    console.time('player 1 joining...');
    proof = await cardOperations.join(gs, p1.secrets._shuffleKey, proof);
    console.timeEnd('player 1 joining...');
    proof = testJsonRoundtrip(proof);

    console.log('verify using program...');
    ok = await cardOperations.verify(proof);
    console.log('ok (alternative)?', ok);

    console.log('verify directly...');
    ok = await verify(proof, verificationKey);
    console.log('ok?', ok);

    console.log('player 1 masking...');
    const maskingNonce = Scalar.random();
    gs.card = mask(gs.card, maskingNonce);
    proof = await cardOperations.mask(gs, maskingNonce, proof);
    proof = testJsonRoundtrip(proof);

    console.log('verify...');
    ok = await verify(proof.toJSON(), verificationKey);

    console.log('ok?', ok);

    function testJsonRoundtrip(proof: any): any {
      let jsonProof = proof.toJSON();
      console.log('json proof', JSON.stringify({ ...jsonProof, proof: jsonProof.proof.slice(0, 10) + '..' }));
      return MyProof.fromJSON(jsonProof);
    }
  });
});
