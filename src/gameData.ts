import { Deck } from './deck';
import { Player } from './player';

export enum GameState {
  introductions,
  shuffle,
  mask,
  deal,
  playCard,
  win,
}

/**
 * Holds the public game data
 */
export class GameData {
  public deck: Deck;
  public players: Array<Player>;
  public currentPlayer: number;
  public nonce: number;
  public deckState: GameState;
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
  // assert currentPlayer == oldPlayer + 1
  // assert game nonce is incremented by one
  // assert nonce was not already used (check against local state)
  switch (oldData.deckState) {
    case GameState.introductions:
      if (newData.deckState === GameState.introductions) {
        // assert new state players array starts with old state players array
        // assert player[currentPlayer] is not null
      } else if (newData.deckState === GameState.shuffle) {
        // assert all players not null
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.shuffle:
      if (newData.deckState === GameState.shuffle) {
        // assert new cards are all different
        // assert cards joint public keys are the same
        // and all equal to oldJointKey + players[currentPlayer].shuffleKey
      } else if (newData.deckState === GameState.mask) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.mask:
      if (newData.deckState === GameState.mask) {
        // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].shuffleKey +
        // players[currentPlayer].keys[cardIndex]
      } else if (newData.deckState === GameState.deal) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.deal:
      if (newData.deckState === GameState.deal) {
        // for each card index that the currentPlayer should reveal
        // assert each new cards jointPublicKey is oldJointKey - players[currentPlayer].keys[cardIndex]
      } else if (newData.deckState === GameState.playCard) {
        // assert currentPlayer == 0
      } else {
        return false;
      }
      break;
    case GameState.playCard:
      // assert card was assigned to current player
      // assert card is now assigned to discard pile
      // assert card is unmasked using the proper mask key
      // assert card meets discard rules (depending on game)
      // assert other cards remain intact
      // assert all players remain intact
      if (newData.deckState === GameState.playCard) {
        // assert currentPlayer still has assigned cards
      } else if (newData.deckState === GameState.win) {
        // assert current player has no cards left
      } else {
        return false;
      }
      break;
  }
  return false;
}
