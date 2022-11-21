# Notes on Mental Poker

A collection of players wish to play a game of cards without having a centralized server or a trusted peer to hold the
state of the game and to ensure fairness.

The question is how can they play this game while each player only trusts their machine and some math.

## SRA Mental Poker

[The first option](https://people.csail.mit.edu/rivest/pubs/SRA81.pdf), described a while ago by the same folks that
brought us RSA, is for a 2 player game using a simple commutative encryption function:

- Alice encrypts each card in the deck using her key $A$,
- Then she shuffles the encrypted deck and sends it to Bob. $E_A(Deck)$
- Bob randomly picks 5 cards from the encrypted deck and sends them back to Alice. $E_A(Hand_A)$
- Alice can decrypt them to learn her hand. $D_A(E_A(Hand_A)) = Hand_A$
- Bob then picks 5 other cards from the deck, encrypts them with his key $B$ and sends them to Alice. $E_B(E_A(Hand_B))$
- Alice decrypts the now doubly encrypted cards using her key so that the cards remain encrypted only by Bob's key.
  These cards get sent back to Bob. $D_A(E_B(E_A(Hand_B))) = \cancel{D_A}(\cancel{E_A}(E_B(Hand_B))) = E_B(Hand_B)$
- Bob can decrypt these last cards to learn his own hand. $D_B(E_B(Hand_B)) = Hand_B$

The original paper states that the keys should be revealed at the end to prove that the actual cards have been dealt and
that there was no cheating.

### Attacking this protocol?

The requirement to reveal the keys at the end of the game has some downsides.
For a poker game, it's not really ok to reveal your hand if the opponent did not pay to see your hands.
It also hints at one of the possible exploits of this otherwise very elegant protocol: The dealer can create a deck with
a preferred set of cards instead of using the entire original deck. I suppose there are more, let's see what we can
discover down the line.

---

Players agree on a deck of cards, they each take turns shuffling and masking the deck and then cards are dealt.

Dealing a card to a player, means having every other player unmask the card publicly.
Finally, the player getting the card unmasks the card privately and ends up with the card in plain-text.

Showing a card to other players means doing the final unmasking publicly.

---

To be able to make this masking system work, a commutative encryption scheme is required.

In my exploration of this topic I've often come across the ElGamal scheme as well as claims that it is commutative.

## ElGamal encryption

As with many cryptographic schemes, every operation happens within a cyclic group $\mathbb{G}$ of large prime order $q$
with a generator $(g, *)$ where discrete logarithm is hard.

In this encryption scheme, the plaintext messages are group elements. There are encoding/decoding schemes that can be
used to convert arbitrary bit string messages to/from group elements, but I won't cover these since we can pre-define
our cards as a collection of random or predetermined group elements.

Consider a group element $m$.

#### keys

- Generate a random secret integer $x$ in the interval $\{1,\dots,q-1\}$. This is the private key.
- Compute $h:=g^x$ which is the corresponding public key.

#### Encryption

- Generate a random nonce $y$ in the interval $\{1,\dots,q-1\}$
- Compute $s:=h^y$. This is called the shared secret.
- Compute $c_1:=g^y$. The ephemeral public key.
- Compute $c_2:=m * s$
- The ciphertext is the pair $(c_1, c_2)$

#### Decryption

- Compute the shared secret $s:=c_1^x$
- recover the original group element $m:=c_2*s^{-1}$

### How is it commutative?

$E(m_1)*E(m_2) := E(m_1 * m_2)$

$c_1:=c_{11}*c_{12} = g^{y_1}*g^{y_2} = g^{y_1+y_2} = g^y$

$c_2:=c_{21}*c_{22} = m_1*m_1*h^{y_1}*m_2*h^{y_2} = m_1*m_2*h^{y_1+y_2} = m_1*m_2*h^y$

## Card representations

Since we will be working with masked/unmasked cards as a result of ElGamal encryption operations, we can use the same
representation for both masked and unmasked; a pair of group elements.

A masked card is the tuple $(c_1,c_2,h)$ where $c_1$ is the combined ephemeral public key and $c_2$ is the product of
the message with the combined shared secret and $h$ is the combined public key of the players masking.

An unmasked card can also be written as the pair of group elements $(c_1,c_2,h):=(g^0,m,g^0)$ where $m$ is a random
group element pre-chosen to represent that card.

## Masking a card

These next steps are based on the
paper [Mental Poker Revisited](http://archive.cone.informatik.uni-freiburg.de/teaching/teamprojekt/dog-w10/literature/mentalpoker-revisited.pdf)

First, the joint public key of all $n$ participants must be computed as the product of all the player public keys (using
group operations).

$h := \prod_{i} h_i$

A player wishing to mask this card would choose a random nonce $r \in [1,q-1]$ and produce the following [re]masked
card:
$(c_1', c_2', h) := (c_1*g^r, c_2 * h^r, h)$

## Unmasking a card

The player $i$ computes $d_i := c_1^{x_i}$ and produces the unmasked card:

$(c_1', c_2', h') := (c_1, c_2/d_i, h/h_i)$

## Shuffle-masking

The combined operation of shuffling the deck and masking the cards.

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

## Operations on points using snarkyjs@0.7.x:

- Calculate a point (PublicKey) from a Scalar (PrivateKey): $g^s$ => `Group.generator.scale(s)`
- Exponentiation: $A^s$ => `A.scale(s)`
- Add 2 points $A*B$ => `A.add(B)`
- Subtract $A/B$ => `A.sub(B)`
- Compute a shared secret point:
  With $A = g^a$; $B = g^b$; each can compute $A^b = (g^a)^b = (g^ab) = (g^b)^a = B^a$

### Add a player key to a card masking

Player generates a secret Scalar `s` and shares the public key corresponding to it with the other  
players ( $g^s$ (`Group.generator.scale(s)`) )

(`msg`, `pk`, `epk`) => ( $msg * epk^s$, $pk * g^s$, $epk$)

### Masking a card

generate a nonce Scalar `r` as an ephemeral private key  
(`msg`, `pk`, `epk`) => ( $msg * pk^r$, $pk$, $epk * g^r$)

Masking can be done more than once.

### Unmasking a card by one player key

Player uses their secret `s` to partially unmask:  
(`msg`, `pk`, `epk`) => ( $msg / epk^s$, $pk / g^s$, $epk$)

This operation removes the player key from the joint `pk`, so the player can no longer participate in
masking/unmasking.  
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
