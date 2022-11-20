import { Circuit, CircuitValue, Field, isReady, PrivateKey, shutdown } from 'snarkyjs';
import { Deck } from '../deck';
import { addPlayerToCardMask, mask, partialUnmask } from '../utils';
import { createGame, GameData } from '../gameData';
import { Card } from '../card';

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
    const gameDataString = JSON.stringify(GameData.toJSON(initialState));

    console.log((<any>GameData).type);

    const serializedGameData = JSON.stringify(GameData.toFields(initialState).map((x) => x.toJSON()));
    const deserializedRaw: string[] = JSON.parse(serializedGameData);
    const reconstructed: GameData = GameData.fromFields(
      deserializedRaw.map((f) => Field.fromJSON(f)),
      []
    );
    Circuit.assertEqual<GameData>(GameData, initialState, reconstructed);
  });
});
