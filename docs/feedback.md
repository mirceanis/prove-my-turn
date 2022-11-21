# Feedback for the awesome snarkyjs team

## PrivateKey fromFields unexpected behavior

```typescript
it('why are they not equal?', () => {
  const f1 = Field.random();
  const p1 = PrivateKey.fromFields(f1.toFields());
  const p2 = PrivateKey.fromBits(f1.toBits());
  expect(p1).toEqual(p2);
});
```

## Field.gt() only works in checked computation

Forces me to do this:

```typescript
if (Circuit.inCheckedComputation()) {
  compareWithOld = oldData.currentPlayer.gt(i);
} else {
  compareWithOld = Bool(oldData.currentPlayer.toBigInt() > i);
}
```

and can lead to bugs if I don't test the method in and out of circuit

## How to properly deep-copy structs?

    * foFields/fromFields seems to work, but then Circuit.if() complains that the data types don't match.

## `PublicKey.empty().toGroup().scale()` should be allowed?

maybe? and return `PublicKey.empty()`?

## Unsure if I should be extracting values from Struct arrays using Circuit.switch.

More examples of when that matters would help.
