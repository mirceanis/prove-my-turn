import {
  arrayProp,
  CircuitValue,
  Experimental,
  Field,
  isReady,
  PrivateKey,
  prop,
  Scalar,
  SelfProof,
  shutdown,
  verify,
} from 'snarkyjs';
import { addPlayerToCardMask, mask, partialUnmask, ZERO_KEY } from '../utils';
import { Deck } from '../deck';
import { Card } from '../card';
import { BasePlayerKeys, Player } from '../player';

export class BaseGameState extends CircuitValue {
  static numCards: number;
  static numPlayers: number;
  cards: Card[];
  players: BasePlayerKeys[];

  constructor(deck: Card[], players: BasePlayerKeys[]) {
    super();
    if (deck.length !== BaseGameState.numCards) {
      throw new Error(`can't initialize game state for ${BaseGameState.numCards} cards using ${deck.length} cards`);
    }
    if (players.length !== BaseGameState.numPlayers) {
      throw new Error(
        `can't initialize game state for ${BaseGameState.numPlayers} players using ${players.length} players`
      );
    }
    this.cards = deck;
    this.players = players;
  }
}

export function GameStateFactory(numCards: number, numPlayers: number): typeof BaseGameState {
  class GameState_ extends BaseGameState {
    static numCards = numCards;
    static numPlayers = numPlayers;
  }

  arrayProp(Card, numCards)(GameState_.prototype, 'numCards');
  arrayProp(BasePlayerKeys, numPlayers)(GameState_.prototype, 'numPlayers');
  return GameState_;
}

const deck: Card[] = Deck.buildCardFaces().map(Deck.face2Card);

class GameState extends GameStateFactory(deck.length, 2) {}

//
// let cardOperations = Experimental.ZkProgram({
//   publicInput: BaseGameState,
//   methods: {
//     init: {
//       privateInputs: [],
//
//       method(publicInput: BaseGameState) {
//         for (let i = 0; i < GameState.numCards; i++) {
//           const card = publicInput.cards[i]
//           card.msg.equals(ZERO_KEY).assertEquals(false);
//           card.epk.assertEquals(ZERO_KEY);
//           card.pk.assertEquals(ZERO_KEY);
//         }
//       },
//     },
//     join: {
//       privateInputs: [PlayerSecrets, SelfProof],
//
//       method(publicInput: Card, playerSecret: PrivateKey, earlierProof: SelfProof<Card>) {
//         earlierProof.verify();
//         const newCard = addPlayerToCardMask(earlierProof.publicInput, playerSecret);
//         newCard.assertEquals(publicInput);
//       },
//     },
//     mask: {
//       privateInputs: [Scalar, SelfProof],
//       method(publicInput: Card, nonce: Scalar, earlierProof: SelfProof<Card>) {
//         earlierProof.verify();
//         const newCard = mask(earlierProof.publicInput, nonce);
//         newCard.assertEquals(publicInput);
//       },
//     },
//     unmask: {
//       privateInputs: [PrivateKey, SelfProof],
//
//       method(publicInput: Card, playerSecret: PrivateKey, earlierProof: SelfProof<Card>) {
//         earlierProof.verify();
//         const newCard = partialUnmask(earlierProof.publicInput, playerSecret);
//         newCard.assertEquals(publicInput);
//       },
//     },
//   },
// });

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

  it('program operations', async () => {
    // let gs = new GameState()
    // let MyProof = Experimental.ZkProgram.Proof(cardOperations);
    // const originalDeck = new Deck(['hello world']);
    // let cards = originalDeck.cards;
    //
    // console.log('program digest', cardOperations.digest());
    //
    // console.log('compiling MyProgram...');
    // let { verificationKey } = await cardOperations.compile();
    // console.log('verification key', verificationKey.slice(0, 10) + '..');
    //
    // console.log('proving base case...');
    // let proof = await cardOperations.init(cards[0]);
    // proof = testJsonRoundtrip(proof);
    //
    // console.log('verify...');
    // let ok = await verify(proof.toJSON(), verificationKey);
    // console.log('ok?', ok);
    //
    // console.log('proving step 1...');
    // const p1 = new Player(1);
    // cards = p1.shuffleAndMaskDeck(cards);
    // proof = await cardOperations.join(cards[0], p1.secrets._shuffleKey, proof);
    // proof = await cardOperations.mask(cards[0], proof);
    // proof = testJsonRoundtrip(proof);
    //
    // console.log('verify alternative...');
    // ok = await MyProgram.verify(proof);
    // console.log('ok (alternative)?', ok);
    //
    // console.log('verify...');
    // ok = await verify(proof, verificationKey);
    // console.log('ok?', ok);
    //
    // console.log('proving step 2...');
    // proof = await MyProgram.inductiveCase(Field(2), proof);
    // proof = testJsonRoundtrip(proof);
    //
    // console.log('verify...');
    // ok = await verify(proof.toJSON(), verificationKey);
    //
    // console.log('ok?', ok && proof.publicInput.toString() === '2');
    //
    // function testJsonRoundtrip(proof: any): any {
    //   let jsonProof = proof.toJSON();
    //   console.log('json proof', JSON.stringify({ ...jsonProof, proof: jsonProof.proof.slice(0, 10) + '..' }));
    //   return MyProof.fromJSON(jsonProof);
    // }
  });
});
