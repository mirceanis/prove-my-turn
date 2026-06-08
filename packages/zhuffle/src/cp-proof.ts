import { CPProof, EllipticCurve, FSRNG, CurvePoint, PRNG, Scalar } from './types';

function computeChallenge(curve: EllipticCurve, fsprng: FSRNG, elements: CurvePoint[]): Scalar {
  fsprng.absorb(elements);
  return curve.hashToScalar(fsprng.randomBytes(32));
}

export function generateCPProof(
  curve: EllipticCurve,
  x: CurvePoint,
  y: CurvePoint,
  g: CurvePoint,
  h: CurvePoint,
  alfa: Scalar,
  fsprng: FSRNG,
  rng: PRNG
): CPProof {
  const omega = curve.randomScalar(rng);
  // Prover computes: a = g^omega, b = h^omega
  const a = curve.mul(g, omega);
  const b = curve.mul(h, omega);
  // Prover computes the challenge c = H(g, h, x, y, a, b)
  const c = computeChallenge(curve, fsprng, [g, h, x, y, a, b]);
  const response = (omega + alfa * c) % curve.order();

  return {
    a: a,
    b: b,
    r: response,
  };
}

export function verifyCPProof(
  curve: EllipticCurve,
  proof: CPProof,
  x: CurvePoint,
  y: CurvePoint,
  g: CurvePoint,
  h: CurvePoint,
  fsprng: FSRNG
): boolean {
  // Verifier computes the challenge c = H(g, h, x, y, a, b)
  const c = computeChallenge(curve, fsprng, [g, h, x, y, proof.a, proof.b]);

  // Verifier checks the two equations:
  // g^r = a + x^c
  const left1 = curve.mul(g, proof.r);
  const right1 = curve.add(proof.a, curve.mul(x, c));

  // h^r = b + y^c
  const left2 = curve.mul(h, proof.r);
  const right2 = curve.add(proof.b, curve.mul(y, c));

  return left1.x === right1.x && left1.y === right1.y && left2.x === right2.x && left2.y === right2.y;
}
