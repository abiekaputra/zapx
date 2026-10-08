import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface EncryptedValue {
  ciphertext: string;
  nonce: string;
  tag: string;
}

export class PayloadCipher {
  public constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error('Payload encryption key must contain exactly 32 bytes.');
    }
  }

  public static fromBase64(encodedKey: string): PayloadCipher {
    return new PayloadCipher(Buffer.from(encodedKey, 'base64'));
  }

  public encrypt(plaintext: string, associatedData: string): EncryptedValue {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(associatedData));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  public decrypt(value: EncryptedValue, associatedData: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(value.nonce, 'base64'));
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  public fingerprint(value: string): string {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }
}
