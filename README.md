# prove-my-turn (zhuffle)

Experiments in zk gaming.

This is an implementation of a p2p card game. There is no central server that generates randomness or that holds all the
information. Each player holds some secret keys and uses their own randomness to participate in a distributed shuffle
and masking of the cards.

Then, players participate in partially decrypting cards dealt to other players and fully decrypting cards dealt only to
them.

## The shuffle-mask protocol

- Each player generates one shuffle keypair and a number of re-masking key-pairs (one for each card in the deck).
- Each player shuffles the deck and masks every card using their shuffling key, then passes the shuffled deck to the
  next player.
- After the deck is shuffled by every player, the order of the cards remains fixed, but each player re-masks each card
  in the shuffled deck with a unique key, corresponding to the index of the card in the shuffled deck.

Read more details about this [here](./docs/shuffle-mask.md).

## How it works (or at least how it will work)

Players share a communication channel where they publish game-state-transitions.
Transitions represent various operations or moves that are considered valid in the game.
It is the responsibility of other players to verify that the transitions are correct. There is no trust assumed between
players. These transitions may be accompanied by proofs that these transitions were performed correctly.

See a more detailed description [here](./docs/state-transitions.md)

## Game rules

Game rules are described [here](./docs/rules.md)

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## License

[Apache-2.0](LICENSE)
