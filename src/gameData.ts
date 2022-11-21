import { CARDS_IN_DECK, Deck, INITIAL_NUM_CARDS } from './deck';
import { Player, PlayerKeys, PlayerSecrets } from './player';
import { Bool, Circuit, Field, PrivateKey, PublicKey, Struct } from 'snarkyjs';
import { Card } from './card';
import { KeyUtils, partialUnmask } from './utils';

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
const DISCARD_STACK = -2;
// top card of the discard stack. There can be only one of these.
const TOP_CARD = -3;

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

function getCurrentPlayerSecrets(newData: GameData): PlayerSecrets {
  const mask = Array(NUM_PLAYERS)
    .fill(null)
    .map((_, i) => Field(i).equals(newData.currentPlayer));
  return Circuit.switch(mask, PlayerSecrets, newData.playerSecrets);
}

function getCardSecret(secrets: PrivateKey[], index: Field): PrivateKey {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, PrivateKey, secrets);
}

function getCardOwner(cardOwners: Field[], index: Field): Field {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(index));
  return Circuit.switch(mask, Field, cardOwners);
}

function getCard(deck: Card[], cardIndex: Field): Card {
  const mask = Array(CARDS_IN_DECK)
    .fill(null)
    .map((_, i) => Field(i).equals(cardIndex));
  return Circuit.switch(mask, Card, deck);
}

/**
 * Checks if a new player is added correctly, without disturbing the existing players
 *
 * This check matters only when the current and previous state was {@link GameState.introductions}
 */
function checkNewPlayerAddedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert new state players array starts with old state players array
  for (let i = 0; i < NUM_PLAYERS; i++) {
    let compareWithOld: Bool;
    if (Circuit.inCheckedComputation()) {
      compareWithOld = Bool.not(oldData.currentPlayer.equals(-1)).and(oldData.currentPlayer.gt(i));
    } else {
      compareWithOld = Bool(
        Bool.not(oldData.currentPlayer.equals(-1)).toBoolean() && oldData.currentPlayer.toBigInt() > i
      );
    }
    const pubKeys = Circuit.if(compareWithOld, oldData.players[i], newData.players[i]);
    const privKeys = Circuit.if(compareWithOld, oldData.playerSecrets[i], newData.playerSecrets[i]);
    result = result.and(Circuit.equal(PlayerKeys, newData.players[i], pubKeys));
    result = result.and(Circuit.equal(PlayerSecrets, newData.playerSecrets[i], privKeys));
  }
  // assert players[currentPlayer] is not BLANK
  const currentPlayerKeys = getCurrentPlayerKeys(newData);
  result = result.and(Circuit.equal(PlayerKeys, currentPlayerKeys, PlayerKeys.BLANK).not());
  return result;
}

function checkPlayerKeysIntact(oldData: GameData, newData: GameData): Bool {
  // assert new state players array starts with old state players array
  let result = Bool(true);
  for (let i = 0; i < NUM_PLAYERS; i++) {
    result = result.and(Circuit.equal(PlayerKeys, newData.players[i], oldData.players[i]));
    result = result.and(Circuit.equal(PlayerSecrets, newData.playerSecrets[i], oldData.playerSecrets[i]));
  }
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
  result = result.and(checkPlayerKeysIntact(oldData, newData));
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
  result = result.and(checkPlayerKeysIntact(oldData, newData));
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
  result = result.and(checkPlayerKeysIntact(oldData, newData));
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
  result = result.and(checkPlayerKeysIntact(oldData, newData));
  return result;
}

function checkMaskingFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert currentPlayer == 0
  result = result.and(newData.currentPlayer.equals(Field(0)));
  result = result.and(oldData.currentPlayer.equals(Field(NUM_PLAYERS - 1)));

  for (let i = 0; i < CARDS_IN_DECK; i++) {
    result = result.and(oldData.cardOwner[i].equals(Field(FRESH_STACK)));
  }
  return result;
}

function checkCardWasUnmaskedBySecret(newCard: Card, oldCard: Card, secret: PrivateKey): Bool {
  const isBlank = secret.equals(KeyUtils.emptyPrivateKey);
  const safeSecret = Circuit.if(isBlank, PrivateKey.fromBits(Field(1).toBits()), secret);
  return Circuit.if(isBlank, Bool(false), Circuit.equal(Card, partialUnmask(oldCard, safeSecret), newCard));
}

function checkDealing(oldData: GameData, newData: GameData) {
  let result = Bool(true);

  const currentPlayerKeys = getCurrentPlayerKeys(newData);
  const currentPlayerSecrets = getCurrentPlayerSecrets(newData);

  let cardIndex = Field(CARDS_IN_DECK);
  const totalCardsToDeal = NUM_PLAYERS * INITIAL_NUM_CARDS;
  // check opening of cards dealt to players
  for (let i = 0; i < totalCardsToDeal; i++) {
    cardIndex = cardIndex.sub(1);
    const expectedOwner = Field(Math.floor(i / NUM_PLAYERS));
    const owner = getCardOwner(newData.cardOwner, cardIndex);
    result = result.and(owner.equals(expectedOwner));
    const ownerIsCurrentPlayer = owner.equals(newData.currentPlayer);
    // check card key was published and that it matches public key
    const cardSecret = getCardSecret(currentPlayerSecrets._cardKeys, cardIndex);
    const cardKey = getCardKey(currentPlayerKeys.cardKeys, cardIndex);
    const keyMatchesCommitment = cardSecret.toPublicKey().equals(cardKey);
    // check card opened with key matches expected value
    const newCard = getCard(newData.deck, cardIndex);
    const oldCard = getCard(oldData.deck, cardIndex);
    const wasOpenedCorrectly = checkCardWasUnmaskedBySecret(newCard, oldCard, cardSecret);
    // only cards opened to other players matter
    result = result.and(Circuit.if(Bool.not(ownerIsCurrentPlayer), wasOpenedCorrectly, Bool(true)));
    result = result.and(Circuit.if(Bool.not(ownerIsCurrentPlayer), keyMatchesCommitment, Bool(true)));
  }
  // check opening of top card
  cardIndex = cardIndex.sub(1);
  const owner = getCardOwner(newData.cardOwner, cardIndex);
  result = result.and(owner.equals(Field(TOP_CARD)));
  const cardSecret = getCardSecret(currentPlayerSecrets._cardKeys, cardIndex);
  const cardKey = getCardKey(currentPlayerKeys.cardKeys, cardIndex);
  const keyMatchesCommitment = cardSecret.toPublicKey().equals(cardKey);
  const newCard = getCard(newData.deck, cardIndex);
  const oldCard = getCard(oldData.deck, cardIndex);
  const wasOpenedCorrectly = checkCardWasUnmaskedBySecret(newCard, oldCard, cardSecret);
  result = result.and(keyMatchesCommitment);
  result = result.and(wasOpenedCorrectly);

  // walk through rest of cards and check that they are intact
  do {
    cardIndex = cardIndex.sub(1);
    const newCard = getCard(newData.deck, cardIndex);
    const oldCard = getCard(oldData.deck, cardIndex);
    // XXX: could I simply use newData.deck[cardIndex] ?
    result = result.and(Circuit.equal(Card, newCard, oldCard));
    const newOwner = getCardOwner(newData.cardOwner, cardIndex);
    const oldOwner = getCardOwner(oldData.cardOwner, cardIndex);
    result = result.and(Circuit.equal(Field, oldOwner, newOwner));
  } while (cardIndex.equals(Field(0)).not().toBoolean());

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
  oldData = GameData.fromFields(GameData.toFields(oldData), []);
  newData = GameData.fromFields(GameData.toFields(newData), []);
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
  Circuit.if(isShuffle, wasShuffle.or(wasIntroductions), Bool(true)).assertTrue(
    'shuffling can only be done after introductions'
  );
  const checkShufflingCompleted = Circuit.if(
    isMasking.and(wasShuffle),
    checkShufflingFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  checkShufflingCompleted.assertTrue('failed to check GameState.shuffle was completed correctly');

  const checkMaskingCorrect = Circuit.if(isMasking, checkMasking(oldData, newData), Bool(true));
  checkMaskingCorrect.assertTrue('failed to check GameState.mask was performed correctly');

  const isDealing = newData.gameState.equals(GameState.deal);
  const wasMasking = oldData.gameState.equals(GameState.mask);
  Circuit.if(isMasking, wasMasking.or(wasShuffle), Bool(true)).assertTrue('masking can only be done after shuffling');
  const checkMaskingCompleted = Circuit.if(
    isDealing.and(wasMasking),
    checkMaskingFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  checkMaskingCompleted.assertTrue('failed to check GameState.mask was completed correctly');

  const checkDealingCorrect = Circuit.if(isDealing, checkDealing(oldData, newData), Bool(true));
  checkDealingCorrect.assertTrue('failed to check GameState.deal was performed correctly');

  const wasDealing = oldData.gameState.equals(GameState.deal);
  Circuit.if(isDealing, wasMasking.or(wasDealing), Bool(true)).assertTrue('dealing can only be done after masking');

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

function bumpCurrentPlayer(oldGameData: GameData): Field {
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
    const cardOwner = Math.floor(i / NUM_PLAYERS);
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
