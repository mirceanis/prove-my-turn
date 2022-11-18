## The shuffle-mask protocol

- Each player generates one shuffle keypair and a number of re-masking key-pairs (one for each card in the deck).
- Each player shuffles the deck and masks every card using their shuffling key, then passes the shuffled deck to the
  next player.
- After the deck is shuffled by every player, the order of the cards remains fixed, but each player re-masks each card
  in the shuffled deck with a unique key, corresponding to the index of the card in the shuffled deck.

## Encodings

Each card is encoded as 3 points on an elliptic curve (public keys).

- 1 point for the (masked) card value (`msg`)
- 1 point for a joint public key of all the players (`pk`)
- 1 point for a joint ephemeral public key (`epk`)

## Operations on points:

- Calculate a point (PublicKey) from a Scalar (PrivateKey): `g^s` => `Group.generator.scale(s)`
- Add 2 points `A * B` => `A.add(B)`
- Subtract `A / B` => `A.sub(B)`
- Compute a shared secret point: With `A = g^a`; `B = g^b`; each can compute `A^b = (g^a)^b = (g^ab) = (g^b)^a = B^a`

### Add a player key to a card masking

Player generates a secret Scalar `s` and shares the public key corresponding to it with the other
players (`g^s` (`Group.generator.scale(s)`))

(`msg`, `pk`, `epk`) => (`msg * epk^s`, `pk * g^s`, `epk`)

### Masking a card

generate a nonce Scalar `r` as an ephemeral private key
(`msg`, `pk`, `epk`) => (`msg * pk^r`, `pk`, `epk * g^r`)

Masking can be done more than once.

### Unmasking a card by one player key

Player uses their secret `s` to partially unmask:
(`msg`, `pk`, `epk`) => (`msg / epk^s`, `pk / g^s`, `epk`)

This operation removes the player key from the joint `pk`, so the player can no longer participate in masking/unmasking.
The card is completely unmasked (`msg` represents the encoded card value) when `pk == Group(0,0)`.

### Re-masking a card

Player partially unmasks a card and re-masks it using a new key

- partially unmask
- generate new secret and compute public key from it
- add player public key to card
- apply one or more masking operations

### 2 players mask and unmask

```
// init
msg => (msg, pk: 0, epk: 0)

// add player 1 (s1, g^s1)
(msg, 0, 0 ) => (msg, g^s1, 0)

// mask with r1 nonce
(msg, g^s1, 0) => (msg * (g^s1)^r1, g^s1, g^r1)

// add player 2 (s2, g^s2)
(msg * g^s1^r1, g^s1, g^r1) => (msg * g^s1^r1 * g^r1^s2, g^s1 * g^s2, g^r1)

// mask with r2 nonce
(msg * g^s1^r1 * g^r1^s2, g^s1 * g^s2, g^r1) => (msg * g^s1^r1 * g^r1^s2 * (g^s1 * g^s2)^r2, g^s1 * g^s2, g^r1 * g^r2)
=== (msg * g^((s1+s2)(r1+r2)), g^(s1+s2), g^(r1+r2))

// unmasking by player 1 (and removing player 1 from the mask)
(msg * g^((s1+s2)(r1+r2)), g^(s1+s2), g^(r1+r2)) => (msg * g^((s1+s2)(r1+r2)) / g^(r1+r2)^s1, g^(s1+s2) / g^s1, g^(r1+r2))
=== (msg * g^(s2(r1+r2)), g^s2, g^(r1+r2))

// unmasking by player 2 (and removing player 2 from the mask)
(msg * g^(s2(r1+r2)), g^s2, g^(r1+r2)) => (msg * g^(s2(r1+r2)) / g^(r1+r2)^s2, g^s2 / g^s2, g^(r1+r2))
=== (msg, 0, g^(r1+r2))

// when pk reaches 0, no more players are masking the value; epk is also cleared for consistency
(msg, 0, g^(r1+r2)) => (msg, 0, 0) => msg
```
