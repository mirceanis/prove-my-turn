import { CARDS_IN_DECK } from './deck.js';
import { PlayerKeys, PlayerSecrets } from './player.js';
import { Circuit, Field, PrivateKey, PublicKey, Struct } from 'snarkyjs';
import { Card } from './card.js';

/* eslint-disable */
export enum GameState {
  introductions,
  shuffle,
  mask,
  deal,
  playCard,
  requestCard,
  playChallenge,
  failChallenge,
  win,
  demo,
}

export const NUM_PLAYERS = 2;

/**
 * Card owner constants.
 *
 * Player owners are set to be the player index (0..NUM_PLAYERS)
 */
// shuffled cards laying face-down. Their order is given by the order in the deck
export const FRESH_STACK = -1;
// played cards stacked face-up. Their order does not matter for this game, except for the top card.
export const DISCARD_STACK = -2;
// top card of the discard stack. There can be only one of these.
export const TOP_CARD = -3;

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
  // the private keys of each player that they share for opening cards. This structure only gets filled partially as
  // players reveal their secrets.
  playerSecrets: Circuit.array<PlayerSecrets>(PlayerSecrets, NUM_PLAYERS),
  // GameState (shuffling, dealing, playing, etc)
  gameState: Field,
  // value specific to this game
  challenge: Field,
}) {
  static serialize(gameData: GameData): string {
    return JSON.stringify(GameData.toFields(gameData).map((field) => field.toJSON()));
  }

  static parse(input: string): GameData {
    const array: string[] = JSON.parse(input);
    return GameData.fromFields(array.map(Field.fromJSON), []);
  }
}

/**
 * Extract the current player public keys from a GameData struct
 */
export function getCurrentPlayerKeys(newData: GameData, index: Field = newData.currentPlayer): PlayerKeys {
  const mask = Array(NUM_PLAYERS)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, PlayerKeys, newData.players);
}

export function getCardKey(keys: PublicKey[], index: Field): PublicKey {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, PublicKey, keys);
}

export function getCurrentPlayerSecrets(newData: GameData): PlayerSecrets {
  const mask = Array(NUM_PLAYERS)
    .fill(null)
    .map((_, i) => Field(i).equals(newData.currentPlayer));
  return Circuit.switch(mask, PlayerSecrets, newData.playerSecrets);
}

export function getCardSecret(secrets: PrivateKey[], index: Field): PrivateKey {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, PrivateKey, secrets);
}

export function getCardOwner(cardOwners: Field[], index: Field): Field {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, Field, cardOwners);
}

export function getCard(deck: Card[], cardIndex: Field): Card {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(cardIndex));
  return Circuit.switch(mask, Card, deck);
}
