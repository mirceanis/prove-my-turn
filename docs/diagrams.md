# Game state

The high level game states and transitions:

```mermaid
graph TD;
    SHUFFLE-MASK((shuffle/mask))-->keys[Players publish keys];
    keys-->shuffle[each player applies shuffle key and shuffles deck];
    shuffle-->shuffle;
    shuffle-->mask[each player applies mask key to each card];
    mask-->mask
    mask-->DEAL((deal cards))
    DEAL-->cardIndex[cards get assigned a player index];
    cardIndex-->keyShare[for every card whose index is not local, publish masking key]
    keyShare-->game((game progress))
```

## Transition signing

```mermaid
proposalCreate-->proposalBroadcast
proposalBroadcast-->proposalReceive
proposalReceive-->proposalSign-->refresh
proposalReceive-->proposalReject-->refresh
refresh-->proposalCreate
```
