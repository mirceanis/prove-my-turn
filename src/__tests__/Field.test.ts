import { Field, Group, isReady, PrivateKey, PublicKey, Scalar, shutdown } from 'snarkyjs';
import { Deck } from '../deck';
import { computeJointKey, mask, partialUnmask, ZERO_KEY } from '../utils';

describe('Field EC operations', () => {
  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('different private keys ofBits generate different public keys', () => {
    const p1 = PrivateKey.ofBits(Field(2).toBits()).toPublicKey();
    const p2 = PrivateKey.ofBits(Field(3).toBits()).toPublicKey();
    expect(p1).not.toEqual(p2);
  });

  it.skip('why are they not equal?', () => {
    const f1 = Field.random();
    const p1 = PrivateKey.ofFields(f1.toFields());
    const p2 = PrivateKey.ofBits(f1.toBits());
    expect(p1).toEqual(p2);
  });

  it('ECDH works', async () => {
    const s1 = Scalar.fromJSON(2)!;
    const s2 = Scalar.fromJSON(3)!;

    const p2 = Group.generator.scale(s1);
    const p3 = Group.generator.scale(s2);
    expect(p2).not.toEqual(p3);

    const shared1 = p2.scale(s2);
    const shared2 = p3.scale(s1);
    expect(shared1).toEqual(shared2);

    expect(shared1).toEqual(Group.generator.scale(s1.mul(s2)));
    expect(shared1).toEqual(Group.generator.scale(Scalar.fromJSON(6)!));
  });

  /**
   * (g^a)^b === g^(a*b)
   */
  it('multi scaling in point space equivalent to multiplication in scalar space', async () => {
    const s1 = Scalar.fromJSON(2)!;
    const s2 = Scalar.fromJSON(3)!;
    const scalarSpace = s1.mul(s2);
    const pointSpace = Group.generator.scale(s1).scale(s2);
    expect(pointSpace).toEqual(Group.generator.scale(scalarSpace));
  });

  /**
   * g^a * g^b === g^(a+b)
   */
  it('adding in point space equivalent to adding in scalar space', async () => {
    const s1 = Scalar.fromJSON(2)!;
    const s2 = Scalar.fromJSON(3)!;
    const scalarSpace = s1.add(s2);
    const pointSpace = Group.generator.scale(s1).add(Group.generator.scale(s2));
    expect(pointSpace).toEqual(Group.generator.scale(scalarSpace));
  });
});
