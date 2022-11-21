import { CircuitString, Poseidon, PrivateKey } from 'snarkyjs';
import { Card } from './card';
import { KeyUtils } from './utils';

export const CARDS_IN_DECK = 13 * 4 + 2; // includes 2 jokers
export const INITIAL_NUM_CARDS = 5; // includes 2 jokers

/**
 * utility class to handle some operations of a deck of cards
 */
export class Deck {
  private readonly _cardFaces: string[];
  public cards: Array<Card>;
  static UNKNOWN_CARD = '__unknown_card__';

  constructor(cardFaces: string[] = []) {
    this._cardFaces = cardFaces;
    this.cards = this._cardFaces.map(Deck.face2Card);
  }

  static buildCardFaces() {
    const cardFaces: string[] = [];
    const ranks = 'Ace,2,3,4,5,6,7,8,9,10,Jack,Queen,King'.split(',');
    const suites = 'Spades,Hearts,Diamonds,Clubs'.split(',');
    const jokers = 'Black Joker,Red Joker'.split(',');
    const bySuite: Record<string, string[]> = {};
    const byRank: Record<string, string[]> = {};
    for (let rank of ranks) {
      for (let suite of suites) {
        const cardFace = `${rank} of ${suite}`;
        cardFaces.push(cardFace);
        bySuite[suite] = (bySuite[suite] || []).concat(cardFace);
        byRank[rank] = (byRank[rank] || []).concat(cardFace);
      }
    }
    cardFaces.push(...jokers);
    return { cardFaces, bySuite, byRank };
  }

  static face2Card(cardFace: string): Card {
    const cardPoint = PrivateKey.fromBits(
      Poseidon.hash(CircuitString.fromString(cardFace).toFields()).toBits()
    ).toPublicKey();
    return new Card(KeyUtils.emptyPublicKey, cardPoint, KeyUtils.emptyPublicKey);
  }

  card2Face(card: Card): string {
    return this._cardFaces.find((k) => Deck.face2Card(k).msg.equals(card.msg).toBoolean()) ?? Deck.UNKNOWN_CARD;
  }

  private static _standardDeckWithJokers: Deck;
  static get standardDeckWithJokers(): Deck {
    return this._standardDeckWithJokers || (this._standardDeckWithJokers = new Deck(this.buildCardFaces().cardFaces));
  }
}

const CARDS_AS_POINTS = {
  byFace: {
    'Ace of Spades': 'B62qqUATRGziyHWbWB1Rntd31M9mSEZeLJQ3wfDL2VozcvLycUrRJQi',
    'Ace of Hearts': 'B62qkAeyYpzEX7YNanaCJuvcMr9GxGe5N7yZ8G9GxyPKyWNx2cSRy3G',
    'Ace of Diamonds': 'B62qpzGgedEbpFu9NZ2zDA2kZZnifS7VpGSDyaSiHZqHzdKLj5EPvca',
    'Ace of Clubs': 'B62qqk57r3F5t4WfLj9CsnKyvmuGic1EjZ8fSczdfjMcWXjQ8QgG2Yk',
    '2 of Spades': 'B62qia3KB3KPVfAQhMRQvEbHi8hCxxDQ1rNStNTtS1fz6jGbLDkKKmX',
    '2 of Hearts': 'B62qn2BX3nNzQti7RmZZbTa7piQwgZERBgQfAyNYVfBbuZvGZmMCrMD',
    '2 of Diamonds': 'B62qnRxoG35qj5mbxLwYZJsJzRpZtH2hSCgzfDU6FBt5vKp7DpyNJW4',
    '2 of Clubs': 'B62qnS11HTLEuBt5fqbKd8pFa7Uib27HTZVnnyUrYnbtrcUg85F4zgv',
    '3 of Spades': 'B62qioLhZ7T6R1VLdFCka62E198zUA8XuPgaeKTX8yiSfiGyfRKPyLT',
    '3 of Hearts': 'B62qkD7yMsX59JJYrL3iPpvJtiM3YSbBz4XNkH9SqRsUevow4BRbM1Y',
    '3 of Diamonds': 'B62qmyRhLnuky4pZdVrQrkd3Qk1EPXKP3jWfoAQzKPvSmboVU6g1UwD',
    '3 of Clubs': 'B62qieeD7gwyM6DoRq7RbJPs9WxZXJ7qbzKoQW22keiRcs1g1abaKwB',
    '4 of Spades': 'B62qnuYXk6C7bSsjDZPZJAQ8Jb1zF6omwXaJSzVJQGxAndgBkmRm93s',
    '4 of Hearts': 'B62qpirVhtiprqCkQxDaesJd54qECZ9VLc5rNZXTFPwGhaWBcSxMtYn',
    '4 of Diamonds': 'B62qpa35Em1oWr1h46ZD71rsvScstF2zuRf7tUfcow8nffwqM1x2tH5',
    '4 of Clubs': 'B62qr3Z8T4kJJ97Qpt3HZPYjcEvaFUQf5djE6aMLZQjqjPtQwEHL188',
    '5 of Spades': 'B62qkdQKtNMPaCZsbmZsbSWNa1q9QBhqidEp7qBN3X9WMe8ounnxoDK',
    '5 of Hearts': 'B62qqBcUYxtPdXapPdH6zUg1NEnYfUa9QzL7igYVBePvsp2tf7tMwtA',
    '5 of Diamonds': 'B62qkH6ZNkqwWEXMk7USUGzLqDnZJLbURXiVRcYGBw4Q8MxhiYStmQT',
    '5 of Clubs': 'B62qq77BpFxfwxv1qUquxNSwbRc2DCzUF4XLHC9dyH2SHfR4fMaHUaR',
    '6 of Spades': 'B62qquL8C7vsgRFXF6d8x2v65jW8HqWJdCUXcP7tud5ZMLmhQzyx1r6',
    '6 of Hearts': 'B62qnvXPaXGe9JA9UpiV1uQm6Wmns1yLpMdir75dxPq54NQ1QoGMeyp',
    '6 of Diamonds': 'B62qjVpg3LAQn4QZLoNU3n8JpC5CTM8GqofgMXL8PWkXGUUN2MvZ5ZC',
    '6 of Clubs': 'B62qj7wLzaLVfYQFuVz4ffsQL32cegyX1boDEj9XxdAX8uwnAZ7pbkH',
    '7 of Spades': 'B62qmfqzdMt9aDgzi9ZZEhFWJFEL8D8LmpHzHgU5S8yt2nQyx5EmNqP',
    '7 of Hearts': 'B62qnfnBsiyfNUhhSMWmiwaR7my3J9XKBSG3mq2M76cLey7WxN8DSDK',
    '7 of Diamonds': 'B62qkKXP9disWDW5ZHRzu9xc4KgPC5M2JSugQ6uTHPuZYZkpKNiweSp',
    '7 of Clubs': 'B62qjvJ4GLs1d62WhuT26wpj6oKQkeZXtQSQjQKPyMV2xNRisggau4w',
    '8 of Spades': 'B62qqbb1o8tYi285YR9XABYuhvSmHJgA7BVEMX7awrFZrceyAEfRNgy',
    '8 of Hearts': 'B62qo7WFF9abYBPPgrjcyyDFjxG7HSz2JVog18fbH36GoVSWQzFNNzE',
    '8 of Diamonds': 'B62qjuJ3fULwz2JtVENvuGsDCxosH8pfuFxxJ9ekTZydb1Eu9qdE6QD',
    '8 of Clubs': 'B62qoseHK9eziutoJGSR6q3ArUt94m3QXSgFAyA3U2ZogfRpjh8bnMt',
    '9 of Spades': 'B62qirytc2BLJ86mZYZXaayqYakF3FsUkwQqAvDxEdRvCBG9zyZ5xUK',
    '9 of Hearts': 'B62qo3CSCBA2VS7sozAqPeXZ36NAQhdTnTa12HpGSGTJVfLdXtzhXDc',
    '9 of Diamonds': 'B62qpXWQJZ7pNGm8PKLrz8nMJL1vvbVVnVoTgD4dLt8JT9yt3YbaZx5',
    '9 of Clubs': 'B62qqb4kMiRtESDr4XN6Kyf64ia8dsKcwhYHo2RZrQJKBjNj22HYdj5',
    '10 of Spades': 'B62qqhDCfY4CVSDqb2z1SUX2Y5sGAKDjABtSQR6VbA9ytx3VvDqVG4F',
    '10 of Hearts': 'B62qqERR3fgVAMfnYr2gb28Jd91thR6npBE8o1YeQnVQpHGgTRq1jaf',
    '10 of Diamonds': 'B62qokUJybh1qYGoUmcvVbWweGE11NEKqq2rtJ3j2WMzvKsep2k7yS4',
    '10 of Clubs': 'B62qqivAM78XwQF1ZcUG8RgJZiBwRcU6tvXMPxEtvBSEqDvpjebJnxx',
    'Jack of Spades': 'B62qrjkymjUVysjxTPVZXawetRRiWwGAKVaUCkf3b6B21og2XegqAp2',
    'Jack of Hearts': 'B62qnYrycuXXTkqByr6tfSAKv1Rfe9EbskyNrHkqS44shZzKpU8N8SF',
    'Jack of Diamonds': 'B62qneQtZ9P6fHueAgi5CsDEmxGzfGFsgEEQcXGqubom4kQZP9CjYKF',
    'Jack of Clubs': 'B62qpodhAjNBKReLZzVFyik1pdycQczXfck9vj3xkhQ3qUqcCF2Qjic',
    'Queen of Spades': 'B62qmZDEgheUvATNA3q7P2jHFBV2JpuGCauroj7BJSDkPaLc2jZ2HRM',
    'Queen of Hearts': 'B62qk2yd8JFuJ5PGhrDc1cZMVg3SX3wFF7ByKdH4cGwEVfYgdj36kmy',
    'Queen of Diamonds': 'B62qm1ir9SgQHcKnPF9y3HtVzwo8jr3e7x78Z9nB9HHXXSQWmPHnLW5',
    'Queen of Clubs': 'B62qkDWwYAK1a2LmbJtmoExCJfzyVpuwagAgseZextA962oVxTCPppr',
    'King of Spades': 'B62qr1XVw8ukkcG57C2UtMnCcaEaYqzUhkEwUqNdmDRT66akZgkfLj6',
    'King of Hearts': 'B62qno6ixA8FNw9gbtkicN9HKEpTSRkYqfhtBkXkyAvKbBLqq1tEwVk',
    'King of Diamonds': 'B62qrAfoAbNFxQXBteCHxrFNk1D4UHp3LMNXnzJ47cMkpquLKwgVNZe',
    'King of Clubs': 'B62qoCBVwhGksAcnBchxZB8XZSYZe1HtwZWJr28maqxuze9L182TLzG',
    'Black Joker': 'B62qj3wJjg3H7xanQAodKcNrVHJDYN5Vk5hTQp7UpJBp8dodaSh5Zfu',
    'Red Joker': 'B62qjDMNTDENZogKgXHw8sTrKmU4WF6rsnnHc1NpzTKcZ2UbLJWA8DX',
  },
  bySuite: {
    Spades: [
      'B62qqUATRGziyHWbWB1Rntd31M9mSEZeLJQ3wfDL2VozcvLycUrRJQi',
      'B62qia3KB3KPVfAQhMRQvEbHi8hCxxDQ1rNStNTtS1fz6jGbLDkKKmX',
      'B62qioLhZ7T6R1VLdFCka62E198zUA8XuPgaeKTX8yiSfiGyfRKPyLT',
      'B62qnuYXk6C7bSsjDZPZJAQ8Jb1zF6omwXaJSzVJQGxAndgBkmRm93s',
      'B62qkdQKtNMPaCZsbmZsbSWNa1q9QBhqidEp7qBN3X9WMe8ounnxoDK',
      'B62qquL8C7vsgRFXF6d8x2v65jW8HqWJdCUXcP7tud5ZMLmhQzyx1r6',
      'B62qmfqzdMt9aDgzi9ZZEhFWJFEL8D8LmpHzHgU5S8yt2nQyx5EmNqP',
      'B62qqbb1o8tYi285YR9XABYuhvSmHJgA7BVEMX7awrFZrceyAEfRNgy',
      'B62qirytc2BLJ86mZYZXaayqYakF3FsUkwQqAvDxEdRvCBG9zyZ5xUK',
      'B62qqhDCfY4CVSDqb2z1SUX2Y5sGAKDjABtSQR6VbA9ytx3VvDqVG4F',
      'B62qrjkymjUVysjxTPVZXawetRRiWwGAKVaUCkf3b6B21og2XegqAp2',
      'B62qmZDEgheUvATNA3q7P2jHFBV2JpuGCauroj7BJSDkPaLc2jZ2HRM',
      'B62qr1XVw8ukkcG57C2UtMnCcaEaYqzUhkEwUqNdmDRT66akZgkfLj6',
    ],
    Hearts: [
      'B62qkAeyYpzEX7YNanaCJuvcMr9GxGe5N7yZ8G9GxyPKyWNx2cSRy3G',
      'B62qn2BX3nNzQti7RmZZbTa7piQwgZERBgQfAyNYVfBbuZvGZmMCrMD',
      'B62qkD7yMsX59JJYrL3iPpvJtiM3YSbBz4XNkH9SqRsUevow4BRbM1Y',
      'B62qpirVhtiprqCkQxDaesJd54qECZ9VLc5rNZXTFPwGhaWBcSxMtYn',
      'B62qqBcUYxtPdXapPdH6zUg1NEnYfUa9QzL7igYVBePvsp2tf7tMwtA',
      'B62qnvXPaXGe9JA9UpiV1uQm6Wmns1yLpMdir75dxPq54NQ1QoGMeyp',
      'B62qnfnBsiyfNUhhSMWmiwaR7my3J9XKBSG3mq2M76cLey7WxN8DSDK',
      'B62qo7WFF9abYBPPgrjcyyDFjxG7HSz2JVog18fbH36GoVSWQzFNNzE',
      'B62qo3CSCBA2VS7sozAqPeXZ36NAQhdTnTa12HpGSGTJVfLdXtzhXDc',
      'B62qqERR3fgVAMfnYr2gb28Jd91thR6npBE8o1YeQnVQpHGgTRq1jaf',
      'B62qnYrycuXXTkqByr6tfSAKv1Rfe9EbskyNrHkqS44shZzKpU8N8SF',
      'B62qk2yd8JFuJ5PGhrDc1cZMVg3SX3wFF7ByKdH4cGwEVfYgdj36kmy',
      'B62qno6ixA8FNw9gbtkicN9HKEpTSRkYqfhtBkXkyAvKbBLqq1tEwVk',
    ],
    Diamonds: [
      'B62qpzGgedEbpFu9NZ2zDA2kZZnifS7VpGSDyaSiHZqHzdKLj5EPvca',
      'B62qnRxoG35qj5mbxLwYZJsJzRpZtH2hSCgzfDU6FBt5vKp7DpyNJW4',
      'B62qmyRhLnuky4pZdVrQrkd3Qk1EPXKP3jWfoAQzKPvSmboVU6g1UwD',
      'B62qpa35Em1oWr1h46ZD71rsvScstF2zuRf7tUfcow8nffwqM1x2tH5',
      'B62qkH6ZNkqwWEXMk7USUGzLqDnZJLbURXiVRcYGBw4Q8MxhiYStmQT',
      'B62qjVpg3LAQn4QZLoNU3n8JpC5CTM8GqofgMXL8PWkXGUUN2MvZ5ZC',
      'B62qkKXP9disWDW5ZHRzu9xc4KgPC5M2JSugQ6uTHPuZYZkpKNiweSp',
      'B62qjuJ3fULwz2JtVENvuGsDCxosH8pfuFxxJ9ekTZydb1Eu9qdE6QD',
      'B62qpXWQJZ7pNGm8PKLrz8nMJL1vvbVVnVoTgD4dLt8JT9yt3YbaZx5',
      'B62qokUJybh1qYGoUmcvVbWweGE11NEKqq2rtJ3j2WMzvKsep2k7yS4',
      'B62qneQtZ9P6fHueAgi5CsDEmxGzfGFsgEEQcXGqubom4kQZP9CjYKF',
      'B62qm1ir9SgQHcKnPF9y3HtVzwo8jr3e7x78Z9nB9HHXXSQWmPHnLW5',
      'B62qrAfoAbNFxQXBteCHxrFNk1D4UHp3LMNXnzJ47cMkpquLKwgVNZe',
    ],
    Clubs: [
      'B62qqk57r3F5t4WfLj9CsnKyvmuGic1EjZ8fSczdfjMcWXjQ8QgG2Yk',
      'B62qnS11HTLEuBt5fqbKd8pFa7Uib27HTZVnnyUrYnbtrcUg85F4zgv',
      'B62qieeD7gwyM6DoRq7RbJPs9WxZXJ7qbzKoQW22keiRcs1g1abaKwB',
      'B62qr3Z8T4kJJ97Qpt3HZPYjcEvaFUQf5djE6aMLZQjqjPtQwEHL188',
      'B62qq77BpFxfwxv1qUquxNSwbRc2DCzUF4XLHC9dyH2SHfR4fMaHUaR',
      'B62qj7wLzaLVfYQFuVz4ffsQL32cegyX1boDEj9XxdAX8uwnAZ7pbkH',
      'B62qjvJ4GLs1d62WhuT26wpj6oKQkeZXtQSQjQKPyMV2xNRisggau4w',
      'B62qoseHK9eziutoJGSR6q3ArUt94m3QXSgFAyA3U2ZogfRpjh8bnMt',
      'B62qqb4kMiRtESDr4XN6Kyf64ia8dsKcwhYHo2RZrQJKBjNj22HYdj5',
      'B62qqivAM78XwQF1ZcUG8RgJZiBwRcU6tvXMPxEtvBSEqDvpjebJnxx',
      'B62qpodhAjNBKReLZzVFyik1pdycQczXfck9vj3xkhQ3qUqcCF2Qjic',
      'B62qkDWwYAK1a2LmbJtmoExCJfzyVpuwagAgseZextA962oVxTCPppr',
      'B62qoCBVwhGksAcnBchxZB8XZSYZe1HtwZWJr28maqxuze9L182TLzG',
    ],
  },
  byRank: {
    '2': [
      'B62qia3KB3KPVfAQhMRQvEbHi8hCxxDQ1rNStNTtS1fz6jGbLDkKKmX',
      'B62qn2BX3nNzQti7RmZZbTa7piQwgZERBgQfAyNYVfBbuZvGZmMCrMD',
      'B62qnRxoG35qj5mbxLwYZJsJzRpZtH2hSCgzfDU6FBt5vKp7DpyNJW4',
      'B62qnS11HTLEuBt5fqbKd8pFa7Uib27HTZVnnyUrYnbtrcUg85F4zgv',
    ],
    '3': [
      'B62qioLhZ7T6R1VLdFCka62E198zUA8XuPgaeKTX8yiSfiGyfRKPyLT',
      'B62qkD7yMsX59JJYrL3iPpvJtiM3YSbBz4XNkH9SqRsUevow4BRbM1Y',
      'B62qmyRhLnuky4pZdVrQrkd3Qk1EPXKP3jWfoAQzKPvSmboVU6g1UwD',
      'B62qieeD7gwyM6DoRq7RbJPs9WxZXJ7qbzKoQW22keiRcs1g1abaKwB',
    ],
    '4': [
      'B62qnuYXk6C7bSsjDZPZJAQ8Jb1zF6omwXaJSzVJQGxAndgBkmRm93s',
      'B62qpirVhtiprqCkQxDaesJd54qECZ9VLc5rNZXTFPwGhaWBcSxMtYn',
      'B62qpa35Em1oWr1h46ZD71rsvScstF2zuRf7tUfcow8nffwqM1x2tH5',
      'B62qr3Z8T4kJJ97Qpt3HZPYjcEvaFUQf5djE6aMLZQjqjPtQwEHL188',
    ],
    '5': [
      'B62qkdQKtNMPaCZsbmZsbSWNa1q9QBhqidEp7qBN3X9WMe8ounnxoDK',
      'B62qqBcUYxtPdXapPdH6zUg1NEnYfUa9QzL7igYVBePvsp2tf7tMwtA',
      'B62qkH6ZNkqwWEXMk7USUGzLqDnZJLbURXiVRcYGBw4Q8MxhiYStmQT',
      'B62qq77BpFxfwxv1qUquxNSwbRc2DCzUF4XLHC9dyH2SHfR4fMaHUaR',
    ],
    '6': [
      'B62qquL8C7vsgRFXF6d8x2v65jW8HqWJdCUXcP7tud5ZMLmhQzyx1r6',
      'B62qnvXPaXGe9JA9UpiV1uQm6Wmns1yLpMdir75dxPq54NQ1QoGMeyp',
      'B62qjVpg3LAQn4QZLoNU3n8JpC5CTM8GqofgMXL8PWkXGUUN2MvZ5ZC',
      'B62qj7wLzaLVfYQFuVz4ffsQL32cegyX1boDEj9XxdAX8uwnAZ7pbkH',
    ],
    '7': [
      'B62qmfqzdMt9aDgzi9ZZEhFWJFEL8D8LmpHzHgU5S8yt2nQyx5EmNqP',
      'B62qnfnBsiyfNUhhSMWmiwaR7my3J9XKBSG3mq2M76cLey7WxN8DSDK',
      'B62qkKXP9disWDW5ZHRzu9xc4KgPC5M2JSugQ6uTHPuZYZkpKNiweSp',
      'B62qjvJ4GLs1d62WhuT26wpj6oKQkeZXtQSQjQKPyMV2xNRisggau4w',
    ],
    '8': [
      'B62qqbb1o8tYi285YR9XABYuhvSmHJgA7BVEMX7awrFZrceyAEfRNgy',
      'B62qo7WFF9abYBPPgrjcyyDFjxG7HSz2JVog18fbH36GoVSWQzFNNzE',
      'B62qjuJ3fULwz2JtVENvuGsDCxosH8pfuFxxJ9ekTZydb1Eu9qdE6QD',
      'B62qoseHK9eziutoJGSR6q3ArUt94m3QXSgFAyA3U2ZogfRpjh8bnMt',
    ],
    '9': [
      'B62qirytc2BLJ86mZYZXaayqYakF3FsUkwQqAvDxEdRvCBG9zyZ5xUK',
      'B62qo3CSCBA2VS7sozAqPeXZ36NAQhdTnTa12HpGSGTJVfLdXtzhXDc',
      'B62qpXWQJZ7pNGm8PKLrz8nMJL1vvbVVnVoTgD4dLt8JT9yt3YbaZx5',
      'B62qqb4kMiRtESDr4XN6Kyf64ia8dsKcwhYHo2RZrQJKBjNj22HYdj5',
    ],
    '10': [
      'B62qqhDCfY4CVSDqb2z1SUX2Y5sGAKDjABtSQR6VbA9ytx3VvDqVG4F',
      'B62qqERR3fgVAMfnYr2gb28Jd91thR6npBE8o1YeQnVQpHGgTRq1jaf',
      'B62qokUJybh1qYGoUmcvVbWweGE11NEKqq2rtJ3j2WMzvKsep2k7yS4',
      'B62qqivAM78XwQF1ZcUG8RgJZiBwRcU6tvXMPxEtvBSEqDvpjebJnxx',
    ],
    Ace: [
      'B62qqUATRGziyHWbWB1Rntd31M9mSEZeLJQ3wfDL2VozcvLycUrRJQi',
      'B62qkAeyYpzEX7YNanaCJuvcMr9GxGe5N7yZ8G9GxyPKyWNx2cSRy3G',
      'B62qpzGgedEbpFu9NZ2zDA2kZZnifS7VpGSDyaSiHZqHzdKLj5EPvca',
      'B62qqk57r3F5t4WfLj9CsnKyvmuGic1EjZ8fSczdfjMcWXjQ8QgG2Yk',
    ],
    Jack: [
      'B62qrjkymjUVysjxTPVZXawetRRiWwGAKVaUCkf3b6B21og2XegqAp2',
      'B62qnYrycuXXTkqByr6tfSAKv1Rfe9EbskyNrHkqS44shZzKpU8N8SF',
      'B62qneQtZ9P6fHueAgi5CsDEmxGzfGFsgEEQcXGqubom4kQZP9CjYKF',
      'B62qpodhAjNBKReLZzVFyik1pdycQczXfck9vj3xkhQ3qUqcCF2Qjic',
    ],
    Queen: [
      'B62qmZDEgheUvATNA3q7P2jHFBV2JpuGCauroj7BJSDkPaLc2jZ2HRM',
      'B62qk2yd8JFuJ5PGhrDc1cZMVg3SX3wFF7ByKdH4cGwEVfYgdj36kmy',
      'B62qm1ir9SgQHcKnPF9y3HtVzwo8jr3e7x78Z9nB9HHXXSQWmPHnLW5',
      'B62qkDWwYAK1a2LmbJtmoExCJfzyVpuwagAgseZextA962oVxTCPppr',
    ],
    King: [
      'B62qr1XVw8ukkcG57C2UtMnCcaEaYqzUhkEwUqNdmDRT66akZgkfLj6',
      'B62qno6ixA8FNw9gbtkicN9HKEpTSRkYqfhtBkXkyAvKbBLqq1tEwVk',
      'B62qrAfoAbNFxQXBteCHxrFNk1D4UHp3LMNXnzJ47cMkpquLKwgVNZe',
      'B62qoCBVwhGksAcnBchxZB8XZSYZe1HtwZWJr28maqxuze9L182TLzG',
    ],
  },
};
