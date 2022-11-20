import { CARDS_IN_DECK, Deck } from './deck';
import { Player, PlayerKeys } from './player';
import { Bool, Circuit, Field, PublicKey, Struct } from 'snarkyjs';
import { Card } from './card';

export enum GameState {
  introductions,
  shuffle,
  mask,
  deal,
  playCard,
  win,
}

const NUM_PLAYERS = 2;

/**
 * Card owner constants.
 *
 * Player owners are set to be the player index (0..NUM_PLAYERS)
 */
// shuffled cards laying face-down. Their order is given by the order in the deck
const FRESH_STACK = -1;
// played cards stacked face-up. Their order does not matter for this game, except for the top card.
const DISCARD_STACK = -1;
// top card of the discard stack. There can be only one of these.
const TOP_CARD = -1;

/**
 * Holds the public game data
 */
export class GameData extends Struct({
  // ensures that game states are produced in sequence
  nonce: Field,
  // the index of the current player (the player that made the last move that produced this state)
  currentPlayer: Field,
  // the array of masked cards. Once shuffled, these don't change position, but they can be unmasked in place
  deck: Circuit.array<Card>(Card, CARDS_IN_DECK),
  // the array deciding where masked cards belong (which player or which pile); See `card owner constants` above.
  cardOwner: Circuit.array<Field>(Field, CARDS_IN_DECK),
  // the public keys of each player
  players: Circuit.array<PlayerKeys>(PlayerKeys, NUM_PLAYERS),
  // GameState (shuffling, dealing, playing, etc)
  gameState: Field,
  // value specific to this game
  challenge: Field,
}) {}

function getCurrentPlayerKeys(newData: GameData): PlayerKeys {
  const mask = Array(NUM_PLAYERS)
    .fill(null)
    .map((_, i) => Field(i).equals(newData.currentPlayer));
  return Circuit.switch(mask, PlayerKeys, newData.players);
}

function getCardKey(keys: PublicKey[], index: Field): PublicKey {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, PublicKey, keys);
}

/**
 * Checks if a new player is added correctly, without disturbing the existing players
 *
 * This check matters only when the current and previous state was GameState.introductions
 */
function checkNewPlayerAddedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert new state players array starts with old state players array
  for (let i = 0; i < NUM_PLAYERS; i++) {
    let condition: Bool;
    if (Circuit.inCheckedComputation()) {
      condition = oldData.currentPlayer.gt(i);
    } else {
      condition = Bool(oldData.currentPlayer.toBigInt() > i);
    }
    const compareWith = Circuit.if(condition, oldData.players[i], newData.players[i]);
    result = result.and(Circuit.equal(PlayerKeys, newData.players[i], compareWith));
  }
  // assert players[currentPlayer] is not BLANK
  const currentPlayerKeys = getCurrentPlayerKeys(newData);
  result = result.and(Circuit.equal(PlayerKeys, currentPlayerKeys, PlayerKeys.BLANK).not());
  return result;
}

/**
 * Checks if the introductions state was completed correctly.
 *
 * This only matters if the new state is shuffling and the old state was introductions.
 */
function checkIntroductionsFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert currentPlayer == 0
  result = result.and(newData.currentPlayer.equals(Field(0)));
  result = result.and(oldData.currentPlayer.equals(Field(NUM_PLAYERS - 1)));
  // assert all players were not BLANK
  for (let i = 0; i < NUM_PLAYERS; i++) {
    result = result.and(Bool.not(Circuit.equal(PlayerKeys, oldData.players[i], PlayerKeys.BLANK)));
  }
  // assert all cards were still the defaults
  for (let i = 0; i < CARDS_IN_DECK; i++) {
    result = result.and(oldData.deck[i].msg.equals(Deck.standardDeckWithJokers.cards[i].msg));
    result = result.and(oldData.deck[i].pk.equals(PublicKey.empty()));
    result = result.and(oldData.deck[i].epk.equals(PublicKey.empty()));
  }
  // TODO: assert all player keys remain intact
  return result;
}

/**
 * Checks if the shuffling seems correct.
 *
 * This only matters if the new state is shuffling.
 */
function checkShuffling(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert new cards are all different from the old cards
  // and cards joint public keys are the same and all equal to oldJointKey + players[currentPlayer].shuffleKey
  const currentPlayerKey = getCurrentPlayerKeys(newData).shuffleKey;
  const expectedKey = PublicKey.fromGroup(oldData.deck[0].pk.toGroup().add(currentPlayerKey.toGroup()));
  for (let i = 0; i < CARDS_IN_DECK; i++) {
    result = result.and(Bool.not(newData.deck[i].msg.equals(oldData.deck[i].msg)));
    result = result.and(newData.deck[i].pk.equals(expectedKey));
    result = result.and(Bool.not(newData.deck[i].epk.equals(oldData.deck[i].epk)));
  }
  // TODO: assert all player keys remain intact
  return result;
}

/**
 * Checks if the introductions state was completed correctly.
 *
 * This only matters if the new state is shuffling and the old state was introductions.
 */
function checkShufflingFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert currentPlayer == 0
  result = result.and(newData.currentPlayer.equals(Field(0)));
  result = result.and(oldData.currentPlayer.equals(Field(NUM_PLAYERS - 1)));
  // TODO: assert all player keys remain intact
  return result;
}

/**
 * Checks if the shuffling seems correct.
 *
 * This only matters if the new state is shuffling.
 */
function checkMasking(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert new cards are all different from the old cards
  // and cards joint public keys are the same and all equal to oldJointKey + players[currentPlayer].shuffleKey
  const currentPlayerKeys = getCurrentPlayerKeys(newData);
  const playerShuffleKey = currentPlayerKeys.shuffleKey.toGroup();
  for (let i = 0; i < CARDS_IN_DECK; i++) {
    const playerCardKey = getCardKey(currentPlayerKeys.cardKeys, Field(i)).toGroup();
    const expectedKey = PublicKey.fromGroup(oldData.deck[i].pk.toGroup().sub(playerShuffleKey).add(playerCardKey));
    result = result.and(Bool.not(newData.deck[i].msg.equals(oldData.deck[i].msg)));
    result = result.and(newData.deck[i].pk.equals(expectedKey));
    result = result.and(Bool.not(newData.deck[i].epk.equals(oldData.deck[i].epk)));
  }
  // TODO: assert all player keys remain intact
  return result;
}

/**
 * Checks if a transition from one game-state to the next looks valid, looking just at the public data.
 *
 * Each player takes their current game state and proposes a move to a new game state, which they broadcast to the
 * other players.
 * Other players are supposed to run this method to check if the transition seems valid.
 *
 * Since the public state holds hidden information, this method cannot check that the transitions involving hidden
 * information have been done correctly (if the cards of the deck were not manipulated somehow; if the correct secret
 * keys were used, etc). Some cheating that involves hidden information may be revealed only after sharing all the
 * secret keys and looking at the history of transactions; but that might not be desirable since it potentially leaks
 * strategy.
 *
 * TODO: decide if a "transaction" concept is needed; besides the old and the new state, to also add an "action"
 * parameter that is supposed to produce the new state from the old.
 *
 * TODO: states for the actual game are not defined yet.
 *
 * @param oldData
 * @param newData
 */
export function isValidTransition(oldData: GameData, newData: GameData): boolean {
  // assert game nonce is incremented by one
  newData.nonce.assertEquals(oldData.nonce.add(1));
  // TODO: assert nonce was not already used (check against local state)
  // assert currentPlayer == oldPlayer + 1
  const expectedCurrentPlayer = Circuit.if(
    oldData.currentPlayer.equals(NUM_PLAYERS - 1),
    Field(0),
    oldData.currentPlayer.add(1)
  );
  newData.currentPlayer.assertEquals(expectedCurrentPlayer);

  // check if new players are added correctly in case the game state is introductions
  const isIntroductions = newData.gameState.equals(GameState.introductions);
  const wasIntroductions = oldData.gameState.equals(GameState.introductions);
  const checkIntroductions = Circuit.if(
    isIntroductions,
    wasIntroductions.and(checkNewPlayerAddedCorrectly(oldData, newData)),
    Bool(true)
  );
  checkIntroductions.assertTrue('failed to check GameState.introductions');

  const isShuffle = newData.gameState.equals(GameState.shuffle);
  const checkIntroductionsCompleted = Circuit.if(
    isShuffle.and(wasIntroductions),
    checkIntroductionsFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  checkIntroductionsCompleted.assertTrue('failed to check GameState.introductions was completed correctly');

  const checkShufflingCorrect = Circuit.if(isShuffle, checkShuffling(oldData, newData), Bool(true));
  checkShufflingCorrect.assertTrue('failed to check GameState.shuffle was performed correctly');

  const isMasking = newData.gameState.equals(GameState.mask);
  const wasShuffle = oldData.gameState.equals(GameState.shuffle);
  const checkShufflingCompleted = Circuit.if(
    isMasking.and(wasShuffle),
    checkShufflingFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  checkShufflingCompleted.assertTrue('failed to check GameState.shuffle was completed correctly');

  const checkMaskingCorrect = Circuit.if(isMasking, checkMasking(oldData, newData), Bool(true));
  checkMaskingCorrect.assertTrue('failed to check GameState.mask was performed correctly');

  //
  // // FIXME: this is not provable in circuit
  // const oldState = Number.parseInt(oldData.gameState.toJSON());
  // const newState = Number.parseInt(newData.gameState.toJSON());
  // switch (oldState) {
  //   case GameState.introductions:
  //     if (newState === GameState.introductions) {
  //       checkNewPlayerAddedCorrectly(oldData, newData);
  //     } else if (newState === GameState.shuffle) {
  //       // assert currentPlayer == 0
  //       // assert all players not BLANK
  //     } else {
  //       return false;
  //     }
  //     break;
  //   case GameState.shuffle:
  //     if (newState === GameState.shuffle) {
  //       // assert new cards are all different from the old cards
  //       // assert cards joint public keys are the same
  //       // and all equal to oldJointKey + players[currentPlayer].shuffleKey
  //     } else if (newState === GameState.mask) {
  //       // assert currentPlayer == 0
  //     } else {
  //       return false;
  //     }
  //     break;
  //   case GameState.mask:
  //     if (newState === GameState.mask) {
  //       // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].shuffleKey +
  //       // players[currentPlayer].keys[cardIndex]
  //     } else if (newState === GameState.deal) {
  //       // assert currentPlayer == 0
  //     } else {
  //       return false;
  //     }
  //     break;
  //   case GameState.deal:
  //     if (newState === GameState.deal) {
  //       // for each card index that the currentPlayer should reveal
  //       // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].keys[cardIndex]
  //     } else if (newState === GameState.playCard) {
  //       // assert currentPlayer == 0
  //     } else {
  //       return false;
  //     }
  //     break;
  //   case GameState.playCard:
  //     // assert top discard card was assigned to current player
  //     // assert card is now assigned to discard pile
  //     // assert card is unmasked using the proper mask key
  //     // assert card meets discard rules (depending on game)
  //     // assert other cards remain intact
  //     // assert all players remain intact
  //     if (newState === GameState.playCard) {
  //       // assert currentPlayer still has assigned cards
  //     } else if (newState === GameState.win) {
  //       // assert current player has no cards left
  //     } else {
  //       return false;
  //     }
  //     break;
  // }
  return true;
}

export function createGame(): GameData {
  return new GameData({
    nonce: Field(0),
    currentPlayer: Field(-1),
    // the array of masked cards. Once shuffled, these don't change position, but they can be unmasked in place
    deck: Deck.standardDeckWithJokers.cards,

    // the array deciding where masked cards belong (which player or which pile)
    cardOwner: Array(CARDS_IN_DECK).fill(Field(FRESH_STACK)),

    // the public keys of each player
    players: Array(NUM_PLAYERS).fill(PlayerKeys.BLANK),

    gameState: Field(0), // GameState (shuffling, dealing, playing, etc)
    challenge: Field(0), // value specific to this game
  });
}

export function joinGame(oldGameData: GameData, player: PlayerKeys): GameData {
  const newGameData = Object.assign({}, oldGameData);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.introductions);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  // FIXME: this is not provable in a circuit
  const playerIndex: number = JSON.parse(newGameData.currentPlayer.toJSON());
  newGameData.players[playerIndex] = player;
  return newGameData;
}

function bumpCurrentPlayer(oldGameData: GameData): Field {
  let currentPlayer = oldGameData.currentPlayer.add(1);
  currentPlayer = Circuit.if(currentPlayer.equals(Field(NUM_PLAYERS)), Field(0), currentPlayer);
  return currentPlayer;
}

export function applyShuffle(oldGameData: GameData, player: Player): GameData {
  const newGameData = Object.assign({}, oldGameData);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.shuffle);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  newGameData.deck = player.shuffleAndMaskDeck(oldGameData.deck);
  return newGameData;
}

export function applyMask(oldGameData: GameData, player: Player): GameData {
  const newGameData = Object.assign({}, oldGameData);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.mask);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  newGameData.deck = player.reMaskEachCard(oldGameData.deck);
  return newGameData;
}

export function openCard(oldGameData: GameData, player: Player, cardIndex: number): GameData {
  const newGameData = Object.assign({}, oldGameData);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.deal);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  newGameData.deck = player.openCard(oldGameData.deck, cardIndex);
  return newGameData;
}
