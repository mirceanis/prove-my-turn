import { Libp2p } from 'libp2p';
import { Command } from 'commander';
import { createNode } from './networking.js';
import { bytesToString, stringToBytes } from './utils.js';
import { Player } from './player.js';
import {
  applyMask,
  applyShuffle,
  broadcastDemoState,
  bumpCurrentPlayer,
  createGame,
  dealFirstHand,
  joinGame,
} from './gameActions.js';
import { GameData, GameState, TOP_CARD } from './gameData.js';
import { isValidTransition } from './gameValidation.js';
import { isReady } from 'snarkyjs';
import { CARDS_IN_DECK, Deck } from './deck.js';
import { Card } from './card.js';

const program = new Command();

program.name('zhuffle').description('play a p2p card game');

const topic_new_games = 'macaua_games';
let game_topic: string = 'macaua_undefined';
let announceGame: any;
let network: Libp2p;

interface Game {
  player: Player;
  localIndex: number;
  gameId: string;
  gameData: GameData;
}

let currentGame: Game;

async function initLocalGame() {
  const player = new Player();
  const gameData = createGame();
  currentGame = {
    gameId: (await network.keychain.createKey('gigi', 'Ed25519')).id,
    localIndex: 0,
    player,
    gameData,
  };
}

program
  .command('start')
  .description('start a game and wait for other peers')
  // .argument('<string>', 'string to split')
  // .option('--first', 'display just the first substring')
  // .option('-s, --separator <char>', 'separator character', ',')
  .action(async () => {
    network = await createNode();
    await network.start();
    console.log(`started node with peerID=${network.peerId}`);
    network.pubsub.subscribe(topic_new_games);
    // network.addEventListener('peer:discovery', console.warn);
    // network.connectionManager.addEventListener('peer:connect', (evt) => {
    //   console.log(evt.detail.remotePeer.toString());
    // });
    network.pubsub.addEventListener('message', (evt) => {
      if (evt?.detail?.topic === topic_new_games) {
        roomHandler(evt.detail.data);
        // console.log(`received: ${bytesToString(evt.detail.data)} on topic ${evt.detail.topic}`);
      } else {
        gameHandler(evt);
      }
    });

    await isReady;

    await initLocalGame();

    const advertiseGame = {
      type: 'new_game',
      gameId: currentGame.gameId,
      peerId: network.peerId,
      playerIndex: currentGame.localIndex,
    };
    announceGame = setInterval(() => {
      network.pubsub.publish(topic_new_games, stringToBytes(JSON.stringify(advertiseGame)));
    }, 1000);
  });

program.parse();

export interface RoomMessage {
  type: 'new_game' | 'join_game';

  [x: string]: any;
}

async function roomHandler(rawData: Uint8Array) {
  let msg: RoomMessage;
  try {
    msg = JSON.parse(bytesToString(rawData));
    if (typeof msg === 'object' && typeof msg.type === 'string') {
      await processRoomMessage(msg);
    }
  } catch (e: any) {
    // ignore messages we can't parse
  }
}

async function processRoomMessage(msg: RoomMessage) {
  switch (msg.type) {
    case 'new_game':
      {
        clearInterval(announceGame);
        console.log(`found game, joining: ${JSON.stringify(msg)}`);
        currentGame.localIndex = msg.playerIndex + 1;
        currentGame.gameId = msg.gameId;
        const playerDetails: RoomMessage = {
          type: 'join_game',
          player: network.peerId.toString(),
          gameId: currentGame.gameId,
          playerIndex: currentGame.localIndex,
        };
        const result = await network.pubsub.publish(topic_new_games, stringToBytes(JSON.stringify(playerDetails)));
        console.log(`message broadcast to ${JSON.stringify(result)}`);
        await createGameAndSubscribe(msg.gameId, false);
      }
      break;
    case 'join_game':
      clearInterval(announceGame);
      console.log(`peer joined my game: ${JSON.stringify(msg)}`);
      // await network.connectionManager.openConnection(msg.player)
      await createGameAndSubscribe(msg.gameId, true);
      break;
    default:
      console.log(`got a message I can't process: ${JSON.stringify(msg)}`);
      break;
  }
}

async function publishNewGameState() {
  const newState: GameMessage = {
    gameData: GameData.serialize(currentGame.gameData),
    gameId: currentGame.gameId,
    type: 'new_game_state',
  };
  const payload = stringToBytes(JSON.stringify(newState));
  let publishResult;
  do {
    publishResult = await network.pubsub.publish(game_topic, payload);
    console.log(`published new state to ${publishResult.recipients.length} recipients`);
    await sleep(500);
  } while (publishResult.recipients.length == 0);
}

async function createGameAndSubscribe(gameId: any, host: boolean) {
  network.pubsub.unsubscribe(topic_new_games);
  game_topic = `macaua_${gameId}`;
  console.log('subscribing to game: ', game_topic);
  network.pubsub.subscribe(game_topic);

  if (host) {
    const gameData = createGame();
    currentGame.gameData = joinGame(gameData, currentGame.player.publicKeys);
    await publishNewGameState();
  }
}

export interface GameMessage {
  type: string;
  gameId: string;
  gameData: string;

  [x: string]: any;
}

async function processGameMessage(newData: GameData) {
  console.log('processing transition');
  const oldData = currentGame.gameData;
  try {
    if (isValidTransition(oldData, newData).toBoolean()) {
      console.log('transition is valid');
      currentGame.gameData = newData;
      const prevMove = GameData.toJSON(currentGame.gameData);
      const nextPlayerIndex: number = Number.parseInt(bumpCurrentPlayer(currentGame.gameData).toJSON());
      if (nextPlayerIndex === currentGame.localIndex) {
        // FIXME: the state change logic is wrong
        if (parseInt(prevMove.gameState) == GameState.introductions.valueOf()) {
          if (currentGame.localIndex != 0) {
            console.log('last move was introductions; continuing');
            currentGame.gameData = joinGame(currentGame.gameData, currentGame.player.publicKeys);
          } else {
            console.log('introductions finished, continuing to shuffle');
            currentGame.gameData = applyShuffle(currentGame.gameData, currentGame.player);
          }
        } else if (parseInt(prevMove.gameState) == GameState.shuffle.valueOf()) {
          if (currentGame.localIndex != 0) {
            console.log('last move was shuffling; continuing');
            currentGame.gameData = applyShuffle(currentGame.gameData, currentGame.player);
          } else {
            console.log('shuffle finished, continuing to mask');
            currentGame.gameData = applyMask(currentGame.gameData, currentGame.player);
          }
        } else if (parseInt(prevMove.gameState) == GameState.mask.valueOf()) {
          if (currentGame.localIndex != 0) {
            console.log('last move was masking; continuing');
            currentGame.gameData = applyMask(currentGame.gameData, currentGame.player);
          } else {
            console.log('masking finished, continuing to deal');
            currentGame.gameData = dealFirstHand(currentGame.gameData, currentGame.player);
          }
        } else if (parseInt(prevMove.gameState) == GameState.deal.valueOf()) {
          if (currentGame.localIndex != 0) {
            console.log('last move was dealing; continuing');
            currentGame.gameData = dealFirstHand(currentGame.gameData, currentGame.player);
          } else {
            currentGame.gameData = broadcastDemoState(currentGame.gameData);
            printKnownCards();
          }
        } else if (parseInt(prevMove.gameState) == GameState.demo.valueOf()) {
          printKnownCards();
        } else {
          console.log("I don't know what to do now");
        }
        await publishNewGameState();
      }
    }
  } catch (e: any) {
    console.error(e);
  }
}

function printKnownCards() {
  console.log('dealing complete, printing cards');
  let deck = currentGame.gameData.deck;
  const openCards: Card[] = [];
  let topCard: Card;
  for (let i = 0; i < CARDS_IN_DECK; i++) {
    if (currentGame.gameData.cardOwner[i].equals(currentGame.localIndex).toBoolean()) {
      deck = currentGame.player.openCard(deck, i);
      openCards.push(deck[i]);
      console.log('opening my card');
    }
    if (currentGame.gameData.cardOwner[i].equals(TOP_CARD).toBoolean()) {
      topCard = deck[i];
    }
  }
  const cardFaces = openCards.map((card) => {
    return Deck.standardDeckWithJokers.card2Face(card);
  });
  console.log('my cards are:', cardFaces);
  console.log('the topCard is:', Deck.standardDeckWithJokers.card2Face(topCard!!));
}

async function gameHandler(evt: any) {
  if (evt?.detail?.topic !== game_topic) {
    return;
  }
  const rawData: Uint8Array = evt.detail.data;
  let msg: GameMessage;
  try {
    console.log('got game message');
    msg = JSON.parse(bytesToString(rawData));
    if (typeof msg === 'object' && typeof msg.type === 'string') {
      if (msg.type == 'new_game_state') {
        await processGameMessage(GameData.parse(msg.gameData));
      } else {
        console.log(`unknown type: '${msg.type}'`);
      }
    }
  } catch (e: any) {
    // ignore messages we can't parse
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
