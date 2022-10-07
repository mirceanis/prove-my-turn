import { Field, Group, isReady, PrivateKey, Scalar, shutdown } from 'snarkyjs';
import { ZERO_KEY } from '../utils';

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
   * (G^a)^b === G^(a*b)
   */
  it('multi scaling in point space equivalent to multiplication in scalar space', async () => {
    const s1 = Scalar.fromJSON(2)!;
    const s2 = Scalar.fromJSON(3)!;
    const scalarSpace = s1.mul(s2);
    const pointSpace = Group.generator.scale(s1).scale(s2);
    expect(pointSpace).toEqual(Group.generator.scale(scalarSpace));
  });

  /**
   * G^a * G^b === G^(a+b)
   */
  it('adding in point space equivalent to adding in scalar space', async () => {
    const s1 = Scalar.fromJSON(2)!;
    const s2 = Scalar.fromJSON(3)!;
    const scalarSpace = s1.add(s2);
    const pointSpace = Group.generator.scale(s1).add(Group.generator.scale(s2));
    expect(pointSpace).toEqual(Group.generator.scale(scalarSpace));
  });

  it('masks and unmasks message 2 players', async () => {
    const s1 = Scalar.random();
    const s2 = Scalar.random();
    const P1 = Group.generator.scale(s1);
    const P2 = Group.generator.scale(s2);
    const msg = Group.generator.scale(Scalar.fromJSON(42)!);

    // // initialize:
    // joint ephemeral key
    let epk = ZERO_KEY.toGroup();
    // masked message point
    let masked = msg;
    // joint public key
    let pk = ZERO_KEY.toGroup();

    // first player joining
    pk = pk.add(P1);
    // masked = masked.add(epk.scale(s1)); // throws "to_affine_exn: Got identity" because JE is initially ZERO

    // masking
    const r1 = Scalar.random();
    epk = epk.add(Group.generator.scale(r1));
    masked = masked.add(pk.scale(r1));

    // second player joining the game
    pk = pk.add(P2);
    masked = masked.add(epk.scale(s2));

    // second player masks
    const r2 = Scalar.random();
    epk = epk.add(Group.generator.scale(r2));
    masked = masked.add(pk.scale(r2));

    // first player unmasks
    pk = pk.sub(P2);
    masked = masked.sub(epk.scale(s1));

    // second player unmasks
    pk = pk.sub(P1);
    masked = masked.sub(epk.scale(s2));

    expect(masked).toEqual(msg);
    expect(pk).toEqual(ZERO_KEY.toGroup());
  });

  it('masks and unmasks message interleaved by 3 players', async () => {
    const s1 = Scalar.random();
    const s2 = Scalar.random();
    const s3 = Scalar.random();
    const P1 = Group.generator.scale(s1);
    const P2 = Group.generator.scale(s2);
    const P3 = Group.generator.scale(s3);
    const msg = Group.generator.scale(Scalar.fromJSON(42)!);

    // initialize
    let epk = ZERO_KEY.toGroup();
    let masked = msg;
    let pk = ZERO_KEY.toGroup();

    // first player masking, using only his public key
    pk = pk.add(P1);

    const r1 = Scalar.random();
    epk = epk.add(Group.generator.scale(r1));
    masked = masked.add(pk.scale(r1));

    // second player joining the game
    pk = pk.add(P2);
    // c1 = c1
    masked = masked.add(epk.scale(s2));

    // second player masks
    const r2 = Scalar.random();
    epk = epk.add(Group.generator.scale(r2));
    masked = masked.add(pk.scale(r2));

    // first player unmasks
    const d1 = epk.scale(s1);
    pk = pk.sub(P1);
    // c1 = c1
    masked = masked.sub(d1);

    // third player joining the game
    pk = pk.add(P3);
    // c1 = c1
    masked = masked.add(epk.scale(s3));

    // third player masks
    const r3 = Scalar.random();
    epk = epk.add(Group.generator.scale(r3));
    masked = masked.add(pk.scale(r3));

    // second player unmasks
    const d2 = epk.scale(s2);
    pk = pk.sub(P2);
    // c1 = c1
    masked = masked.sub(d2);

    // third player unmasks
    const d3 = epk.scale(s3);
    pk = pk.sub(P3);
    // c1 = c1
    masked = masked.sub(d3);

    expect(masked).toEqual(msg);
    expect(pk).toEqual(ZERO_KEY.toGroup());
  });
});
