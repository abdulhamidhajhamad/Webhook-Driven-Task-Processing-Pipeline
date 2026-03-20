import crypto from 'crypto';

export function verifySignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature.padEnd(expected.length, '0').slice(0, expected.length));

  try {
    return (
      signature.length === expected.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  } catch {
    return false;
  }
}

export function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}