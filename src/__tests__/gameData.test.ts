import { Circuit, Field, isReady, shutdown } from 'snarkyjs';
import { createGame, GameData, isValidTransition, joinGame } from '../gameData';
import { Player } from '../player';

describe('gameData', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it.skip('can create game', async () => {
    const initialState = createGame();
    expect(initialState.currentPlayer.toJSON()).toEqual(Field(-1).toJSON());
    expect(initialState.deck.length).toBeGreaterThan(0);
  });

  it('can (de)serialize gameData', async () => {
    const initialState = createGame();

    const serializedGameData = JSON.stringify(GameData.toFields(initialState).map((x) => x.toJSON()));
    const deserializedRaw: string[] = JSON.parse(serializedGameData);
    const reconstructed: GameData = GameData.fromFields(
      deserializedRaw.map((f) => Field.fromJSON(f)),
      []
    );
    Circuit.assertEqual<GameData>(GameData, initialState, reconstructed);
  });

  it('players can join the game', async () => {
    const initialState = createGame();
    const p1 = new Player();
    const p1Joined = joinGame(initialState, p1.publicKeys);
    expect(isValidTransition(initialState, p1Joined)).toBeTruthy();
    const p2 = new Player();
    const p2Joined = joinGame(p1Joined, p2.publicKeys);
    expect(isValidTransition(p1Joined, p2Joined)).toBeTruthy();
    p2Joined.currentPlayer.assertEquals(1);
    expect(p2Joined.players).toEqual([p1.publicKeys, p2.publicKeys]);
  });
});
