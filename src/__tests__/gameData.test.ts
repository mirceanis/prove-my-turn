import { Circuit, Field, isReady, shutdown } from 'snarkyjs';
import { applyMask, applyShuffle, createGame, GameData, isValidTransition, joinGame } from '../gameData';
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

  it('players can shuffle cards', async () => {
    const initialState = createGame();
    const p1 = new Player();
    const p2 = new Player();
    const p1Joined = joinGame(initialState, p1.publicKeys);
    const p2Joined = joinGame(p1Joined, p2.publicKeys);
    const p1Shuffled = applyShuffle(p2Joined, p1);
    expect(isValidTransition(p2Joined, p1Shuffled)).toBeTruthy();
    const p2Shuffled = applyShuffle(p1Shuffled, p2);
    expect(isValidTransition(p1Shuffled, p2Shuffled)).toBeTruthy();

    // wrong player shuffling
    const wrongPlayer = applyShuffle(p2Joined, p2);
    expect(() => {
      isValidTransition(p2Joined, wrongPlayer);
    }).toThrow(/failed to check GameState.shuffle was performed correctly/);

    // introductions after shuffling
    const wrongOperation = joinGame(p1Shuffled, new Player().publicKeys);
    expect(() => {
      isValidTransition(p1Shuffled, wrongOperation);
    }).toThrow(/failed to check GameState.introductions/);
  });

  it('players can mask cards', async () => {
    const initialState = createGame();
    const p1 = new Player();
    const p2 = new Player();
    const p1Joined = joinGame(initialState, p1.publicKeys);
    const p2Joined = joinGame(p1Joined, p2.publicKeys);
    const p1Shuffled = applyShuffle(p2Joined, p1);
    const p2Shuffled = applyShuffle(p1Shuffled, p2);
    const p1Mask = applyMask(p2Shuffled, p1);
    expect(isValidTransition(p2Shuffled, p1Mask)).toBeTruthy();
    const p2Mask = applyMask(p1Mask, p2);
    expect(isValidTransition(p1Mask, p2Mask)).toBeTruthy();

    // wrong player masking
    const wrongPlayer = applyMask(p2Shuffled, p2);
    expect(() => {
      isValidTransition(p2Shuffled, wrongPlayer);
    }).toThrow(/failed to check GameState.mask was performed correctly/);

    // shuffling after masking
    const wrongOperation = applyShuffle(p1Mask, p2);
    expect(() => {
      isValidTransition(p1Mask, wrongOperation);
    }).toThrow(/failed to check GameState.shuffle was performed correctly/);
  });

  it.todo('cards can be dealt');
  it.todo('player can place card');
  it.todo('player can win');
});