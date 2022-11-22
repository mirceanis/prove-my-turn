import { Circuit, Field } from 'snarkyjs';
import { CARDS_IN_DECK, Deck, INITIAL_NUM_CARDS } from './deck.js';
import { Player, PlayerKeys, PlayerSecrets } from './player.js';
import { FRESH_STACK, GameData, GameState, NUM_PLAYERS, TOP_CARD } from './gameData.js';

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
    playerSecrets: Array(NUM_PLAYERS).fill(PlayerSecrets.BLANK),

    gameState: Field(0), // GameState (shuffling, dealing, playing, etc)
    challenge: Field(0), // value specific to this game
  });
}

export function joinGame(oldGameData: GameData, player: PlayerKeys): GameData {
  const newGameData = GameData.fromFields(GameData.toFields(oldGameData), []);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.introductions);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  // FIXME: this is not provable in a circuit
  const playerIndex: number = JSON.parse(newGameData.currentPlayer.toJSON());
  newGameData.players[playerIndex] = player;
  return newGameData;
}

export function bumpCurrentPlayer(oldGameData: GameData): Field {
  let currentPlayer = oldGameData.currentPlayer.add(1);
  currentPlayer = Circuit.if(currentPlayer.equals(Field(NUM_PLAYERS)), Field(0), currentPlayer);
  return currentPlayer;
}

export function applyShuffle(oldGameData: GameData, player: Player): GameData {
  const newGameData = GameData.fromFields(GameData.toFields(oldGameData), []);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.shuffle);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  newGameData.deck = player.shuffleAndMaskDeck(oldGameData.deck);
  return newGameData;
}

export function applyMask(oldGameData: GameData, player: Player): GameData {
  const newGameData = GameData.fromFields(GameData.toFields(oldGameData), []);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.mask);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  newGameData.deck = player.reMaskEachCard(oldGameData.deck);
  return newGameData;
}

export function dealFirstHand(oldGameData: GameData, player: Player): GameData {
  const newGameData = GameData.fromFields(GameData.toFields(oldGameData), []);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.deal);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  const currentPlayerIndex = Number.parseInt(newGameData.currentPlayer.toJSON());
  let cardIndex = CARDS_IN_DECK;
  const totalCardsToDeal = NUM_PLAYERS * INITIAL_NUM_CARDS;
  // open cards dealt to players
  for (let i = 0; i < totalCardsToDeal; i++) {
    cardIndex--;
    const cardOwner = Math.floor(i / INITIAL_NUM_CARDS);
    newGameData.cardOwner[cardIndex] = Field(cardOwner);
    if (cardOwner !== currentPlayerIndex) {
      newGameData.deck = player.openCard(newGameData.deck, cardIndex);
      newGameData.playerSecrets[currentPlayerIndex]._cardKeys[cardIndex] = player.secrets._cardKeys[cardIndex];
    }
  }
  // place top card in discard pile
  cardIndex--;
  newGameData.cardOwner[cardIndex] = Field(TOP_CARD);
  newGameData.deck = player.openCard(newGameData.deck, cardIndex);
  newGameData.playerSecrets[currentPlayerIndex]._cardKeys[cardIndex] = player.secrets._cardKeys[cardIndex];
  return newGameData;
}

export function broadcastDemoState(oldGameData: GameData): GameData {
  const newGameData = GameData.fromFields(GameData.toFields(oldGameData), []);
  newGameData.nonce = newGameData.nonce.add(1);
  newGameData.gameState = Field(GameState.demo);
  newGameData.currentPlayer = bumpCurrentPlayer(oldGameData);
  return newGameData;
}
