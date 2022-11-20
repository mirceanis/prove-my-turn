import { CARDS_IN_DECK, Deck } from './deck';
import { Player, PlayerKeys } from './player';
import { Circuit, CircuitValue, Field, PublicKey, Struct } from 'snarkyjs';
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
 * Holds the public game data
 */
export class GameData extends Struct({
  // ensures that game states are produced in sequence
  nonce: Field,
  // the index of the current player (the player that made the last move that produced this state)
  currentPlayer: Field,
  // the array of masked cards. Once shuffled, these don't change position, but they can be unmasked in place
  deck: Circuit.array<Card>(Card, CARDS_IN_DECK),
  // the array deciding where masked cards belong (which player or which pile)
  cardOwner: Circuit.array<Field>(Field, CARDS_IN_DECK),
  // the public keys of each player
  players: Circuit.array<PlayerKeys>(PlayerKeys, NUM_PLAYERS),

  gameState: Field, // GameState (shuffling, dealing, playing, etc)
  challenge: Field, // value specific to this game
}) {}

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
  // assert currentPlayer == oldPlayer + 1
  // assert game nonce is incremented by one
  // assert nonce was not already used (check against local state)
  const oldState = Number.parseInt(oldData.gameState.toJSON());
  const newState = Number.parseInt(newData.gameState.toJSON());
  switch (oldState) {
    case GameState.introductions:
      if (newState === GameState.introductions) {
        // assert new state players array starts with old state players array
        // assert player[currentPlayer] is not null
      } else if (newState === GameState.shuffle) {
        // assert all players not null
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.shuffle:
      if (newState === GameState.shuffle) {
        // assert new cards are all different
        // assert cards joint public keys are the same
        // and all equal to oldJointKey + players[currentPlayer].shuffleKey
      } else if (newState === GameState.mask) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.mask:
      if (newState === GameState.mask) {
        // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].shuffleKey +
        // players[currentPlayer].keys[cardIndex]
      } else if (newState === GameState.deal) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.deal:
      if (newState === GameState.deal) {
        // for each card index that the currentPlayer should reveal
        // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].keys[cardIndex]
      } else if (newState === GameState.playCard) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.playCard:
      // assert top discard card was assigned to current player
      // assert card is now assigned to discard pile
      // assert card is unmasked using the proper mask key
      // assert card meets discard rules (depending on game)
      // assert other cards remain intact
      // assert all players remain intact
      if (newState === GameState.playCard) {
        // assert currentPlayer still has assigned cards
      } else if (newState === GameState.win) {
        // assert current player has no cards left
      } else {
        return false;
      }
      break;
  }
  return false;
}

export function createGame(): GameData {
  return new GameData({
    nonce: Field(0),
    currentPlayer: Field(-1),
    // the array of masked cards. Once shuffled, these don't change position, but they can be unmasked in place
    deck: Deck.buildCardFaces().map(Deck.face2Card),

    // the array deciding where masked cards belong (which player or which pile)
    cardOwner: Array(CARDS_IN_DECK).fill(Field(0)),

    // the public keys of each player
    players: Array(NUM_PLAYERS).fill(PlayerKeys.BLANK),

    gameState: Field(0), // GameState (shuffling, dealing, playing, etc)
    challenge: Field(0), // value specific to this game
  });
}

export function joinGame(oldGameData: GameData, player: PlayerKeys): GameData {
  const newGameData = Object.assign({}, oldGameData);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.currentPlayer = newGameData.currentPlayer.add(1);
  const playerIndex: number = JSON.parse(newGameData.nonce.toJSON());
  newGameData.players[playerIndex] = player;
  return newGameData;
}
