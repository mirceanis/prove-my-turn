# prove-my-turn (zhuffle)

Experiments in zk gaming.

This is (supposed to be) an implementation of a p2p card game. There is no central server that generates randomness or
that holds all the information. Each player holds some secret keys and uses their own randomness to participate in a
distributed shuffle and masking of the cards.

Then, players participate in partially decrypting cards dealt to other players and fully decrypting cards dealt only to
them.

## How it works (or at least how it will work)

Players share a communication channel where they publish game-state-transitions.
Transitions represent various operations or moves that are considered valid in the game.
It is the responsibility of other players to verify that the transitions are correct. There is no trust assumed between
players. These transitions may be accompanied by proofs that these transitions were performed correctly.

## Game rules

Game rules are described [here](docs/game-rules.md)

## How to build

```sh
pnpm run build
```

## How to run tests

```sh
pnpm run test
```

## License

[Apache-2.0](LICENSE)

## Disclaimer

I'm building this to learn about zk gaming and distributed protocols.
This is NOT a production-ready implementation, and should not be used as such.
There are likely many security issues and bugs in this code.
Use at your own risk.
