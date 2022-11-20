import { Circuit, Field, isReady, shutdown, Struct } from 'snarkyjs';

describe('struct sandbox', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('can pick value from array', async () => {
    const MAX_VALUES = 5;

    class MyArray extends Struct({
      values: Circuit.array<Field>(Field, MAX_VALUES),
    }) {}

    const myArr = new MyArray({ values: [Field(0), Field(1), Field(2), Field(3), Field(4)] });

    const index = Field(2);
    const value = Field(2);

    Circuit.runAndCheck(() => {
      // prove that myArr.values[index] === value
      const mask = Array(MAX_VALUES)
        .fill(null)
        .map((_, i) => Field(i).equals(index));
      const extracted = Circuit.switch(mask, Field, myArr.values);
      extracted.assertEquals(value);
    });
  });

  it('can compare arrays up to index', async () => {
    const MAX_VALUES = 5;

    class MyArray extends Struct({
      values: Circuit.array<Field>(Field, MAX_VALUES),
    }) {}

    const arr1 = new MyArray({ values: [Field(0), Field(1), Field(2), Field(3), Field(4)] });
    const arr2 = new MyArray({ values: [Field(0), Field(1), Field(2), Field(8), Field(9)] });

    const index = Field(2); // fails with 3 as expected

    Circuit.runAndCheck(() => {
      // prove that arr1[0..index] === arr2[0..index]
      for (let i = 0; i < MAX_VALUES; i++) {
        const compareTo = Circuit.if(Field(i).lte(index), arr2.values[i], arr1.values[i]);
        arr1.values[i].assertEquals(compareTo);
      }
    });
  });

  it('can find value in array', async () => {
    const MAX_VALUES = 5;

    class MyArray extends Struct({
      values: Circuit.array<Field>(Field, MAX_VALUES),
    }) {}

    const myArr = new MyArray({ values: [Field(1), Field(1), Field(2), Field(2), Field(3)] });

    const value = Field(2);

    Circuit.runAndCheck(() => {
      // prove that arr1[0..index] === arr2[0..index]
      let found = Field(0);
      for (let i = 0; i < MAX_VALUES; i++) {
        found = found.add(Circuit.if(myArr.values[i].equals(value), Field(1), Field(0)));
      }
      found.gt(0).assertTrue(`could not find ${value.toJSON()} in array: ${JSON.stringify(MyArray.toJSON(myArr))}`);
    });
  });
});
