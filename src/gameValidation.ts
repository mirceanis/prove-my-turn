import { Bool, Circuit, Field, PrivateKey, PublicKey } from 'snarkyjs';
import { CARDS_IN_DECK, Deck, INITIAL_NUM_CARDS } from './deck.js';
import { Card } from './card.js';
import { KeyUtils, partialUnmask } from './utils.js';
import { PlayerKeys, PlayerSecrets } from './player.js';
import {
  FRESH_STACK,
  GameData,
  GameState,
  getCard,
  getCardKey,
  getCardOwner,
  getCardSecret,
  getCurrentPlayerKeys,
  getCurrentPlayerSecrets,
  NUM_PLAYERS,
  TOP_CARD,
} from './gameData.js';

/**
 * Checks if a new player is added correctly, without disturbing other GameData params.
 *
 * This check matters only when the current and previous state was {@link GameState.introductions}
 */
export function checkNewPlayerAddedCorrectly(oldData: GameData, newData: GameData): Bool {
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

/**
 * Check that no player keys were modified between 2 states
 * @param oldData
 * @param newData
 */
export function checkPlayerKeysIntact(oldData: GameData, newData: GameData): Bool {
  // assert new state players array starts with old state players array
  let result = Bool(true);
  for (let i = 0; i < NUM_PLAYERS; i++) {
    result = result.and(Circuit.equal(PlayerKeys, newData.players[i], oldData.players[i]));
  }
  return result;
}

/**
 * Checks if the introductions state was completed correctly.
 *
 * This only matters if the new state is {@link GameState.shuffle} and the old state was {@link GameState.introductions}
 */
export function checkIntroductionsFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
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
 * This only matters if the new state is {@link GameState.shuffle}.
 */
export function checkShuffling(oldData: GameData, newData: GameData): Bool {
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
 * Checks if the {@link GameState.shuffle} state was completed correctly.
 *
 * This only matters if the new state is {@link GameState.mask} and the old state was {@link GameState.shuffle}.
 */
export function checkShufflingFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert currentPlayer == 0
  result = result.and(newData.currentPlayer.equals(Field(0)));
  result = result.and(oldData.currentPlayer.equals(Field(NUM_PLAYERS - 1)));
  result = result.and(checkPlayerKeysIntact(oldData, newData));
  return result;
}

/**
 * Checks if the masking seems correct.
 *
 * This only matters if the new state is {@link GameState.mask}.
 */
export function checkMasking(oldData: GameData, newData: GameData): Bool {
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

/**
 * Checks if the {@link GameState.mask} state was completed correctly.
 *
 * This only matters if the new state is {@link GameState.deal} and the old state was {@link GameState.mask}.
 */
export function checkMaskingFinishedCorrectly(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // assert currentPlayer == 0
  result = result.and(newData.currentPlayer.equals(Field(0)));
  result = result.and(oldData.currentPlayer.equals(Field(NUM_PLAYERS - 1)));

  for (let i = 0; i < CARDS_IN_DECK; i++) {
    result = result.and(oldData.cardOwner[i].equals(Field(FRESH_STACK)));
  }
  return result;
}

/**
 * Validate the opening of a {@link Card} using a particular secret.
 *
 * @param newCard
 * @param oldCard
 * @param secret
 */
export function checkCardWasUnmaskedBySecret(newCard: Card, oldCard: Card, secret: PrivateKey): Bool {
  const isBlank = secret.equals(KeyUtils.emptyPrivateKey);
  const safeSecret = Circuit.if(isBlank, PrivateKey.fromBits(Field(1).toBits()), secret);
  return Circuit.if(isBlank, Bool(false), Circuit.equal(Card, partialUnmask(oldCard, safeSecret), newCard));
}

/**
 * Checks if the opening of a card was done correctly.
 */
export function checkCardWasOpenedCorrectly(
  currentPlayerSecrets: PlayerSecrets,
  cardIndex: Field,
  currentPlayerKeys: PlayerKeys,
  newData: GameData,
  oldData: GameData
): Bool {
  // check card key was published and that it matches public key
  const cardSecret = getCardSecret(currentPlayerSecrets._cardKeys, cardIndex);
  const cardKey = getCardKey(currentPlayerKeys.cardKeys, cardIndex);
  const keyMatchesCommitment = cardSecret.toPublicKey().equals(cardKey);
  // check card opened with key matches expected value
  const newCard = getCard(newData.deck, cardIndex);
  const oldCard = getCard(oldData.deck, cardIndex);
  const wasOpenedCorrectly = checkCardWasUnmaskedBySecret(newCard, oldCard, cardSecret);
  return keyMatchesCommitment.and(wasOpenedCorrectly);
}

/**
 * Validate that dealing was done correctly
 * The current player must open 5 cards for each other player + one TOP card.
 * Card owners are assigned, public key commitments must be checked.
 *
 * @param oldData
 * @param newData
 */
export function checkDealing(oldData: GameData, newData: GameData): Bool {
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
    const correctOpening = checkCardWasOpenedCorrectly(
      currentPlayerSecrets,
      cardIndex,
      currentPlayerKeys,
      newData,
      oldData
    );
    // only cards opened to other players matter
    result = result.and(Circuit.if(Bool.not(ownerIsCurrentPlayer), correctOpening, Bool(true)));
  }
  // check opening of top card
  cardIndex = cardIndex.sub(1);
  const owner = getCardOwner(newData.cardOwner, cardIndex);
  result = result.and(owner.equals(Field(TOP_CARD)));
  const correctOpening = checkCardWasOpenedCorrectly(
    currentPlayerSecrets,
    cardIndex,
    currentPlayerKeys,
    newData,
    oldData
  );
  result = result.and(correctOpening);

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

  result = result.and(checkPlayerKeysIntact(oldData, newData));

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
export function isValidTransition(oldData: GameData, newData: GameData): Bool {
  let result = Bool(true);
  // FIXME: snarkyjs bug? I need to copy data because otherwise Circuit.if will complain that the types are different
  oldData = GameData.fromFields(GameData.toFields(oldData), []);
  newData = GameData.fromFields(GameData.toFields(newData), []);
  // assert game nonce is incremented by one
  result = result.and(newData.nonce.equals(oldData.nonce.add(1)));
  result.assertTrue('wrong nonce. must increase by 1');
  // TODO: assert nonce was not already used (check against local state)
  // assert currentPlayer == oldPlayer + 1
  const expectedCurrentPlayer = Circuit.if(
    oldData.currentPlayer.equals(NUM_PLAYERS - 1),
    Field(0),
    oldData.currentPlayer.add(1)
  );
  result = result.and(newData.currentPlayer.equals(expectedCurrentPlayer));
  result.assertTrue('wrong player is trying to make a move');

  // check if new players are added correctly in case the game state is introductions
  const isIntroductions = newData.gameState.equals(GameState.introductions);
  const wasIntroductions = oldData.gameState.equals(GameState.introductions);
  const checkIntroductions = Circuit.if(
    isIntroductions,
    wasIntroductions.and(checkNewPlayerAddedCorrectly(oldData, newData)),
    Bool(true)
  );
  result = result.and(checkIntroductions);
  result.assertTrue('failed to check GameState.introductions');

  // check shuffling
  const isShuffle = newData.gameState.equals(GameState.shuffle);
  const checkIntroductionsCompleted = Circuit.if(
    isShuffle.and(wasIntroductions),
    checkIntroductionsFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  result = result.and(checkIntroductionsCompleted);
  result.assertTrue('failed to check GameState.introductions was completed correctly');

  const checkShufflingCorrect = Circuit.if(isShuffle, checkShuffling(oldData, newData), Bool(true));
  result = result.and(checkShufflingCorrect);
  result.assertTrue('failed to check GameState.shuffle was performed correctly');

  // check masking
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
  result = result.and(checkShufflingCompleted);
  result.assertTrue('failed to check GameState.shuffle was completed correctly');

  const checkMaskingCorrect = Circuit.if(isMasking, checkMasking(oldData, newData), Bool(true));
  result = result.and(checkMaskingCorrect);
  result.assertTrue('failed to check GameState.mask was performed correctly');

  // check dealing
  const isDealing = newData.gameState.equals(GameState.deal);
  const wasMasking = oldData.gameState.equals(GameState.mask);
  Circuit.if(isMasking, wasMasking.or(wasShuffle), Bool(true)).assertTrue('masking can only be done after shuffling');
  const checkMaskingCompleted = Circuit.if(
    isDealing.and(wasMasking),
    checkMaskingFinishedCorrectly(oldData, newData),
    Bool(true)
  );
  result = result.and(checkMaskingCompleted);
  result.assertTrue('failed to check GameState.mask was completed correctly');

  const checkDealingCorrect = Circuit.if(isDealing, checkDealing(oldData, newData), Bool(true));
  result = result.and(checkDealingCorrect);
  result.assertTrue('failed to check GameState.deal was performed correctly');

  const wasDealing = oldData.gameState.equals(GameState.deal);
  result = result.and(Circuit.if(isDealing, wasMasking.or(wasDealing), Bool(true)));
  result.assertTrue('dealing can only be done after masking');

  // TODO:
  //   case GameState.playCard:
  //     // assert top discard card was assigned to current player
  //     // assert card is now assigned to discard pile
  //     // assert card is unmasked using the proper mask key
  //     // assert card meets discard rules (rank, suite, challenge, etc)
  //     // assert other cards remain intact
  //     // assert all players remain intact
  //   case GameState.requestCard:
  //   case GameState.challenge:
  //   case GameState.challengeComplete:
  //   case GameState.reshuffleDiscard:

  return result;
}
