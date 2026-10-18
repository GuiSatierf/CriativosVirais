import { createCipheriv, createDecipheriv, randomBytes, type DecipherGCM } from "node:crypto";
import { Transform } from "node:stream";

// Layout of every backup object: magic, random IV, AES-256-GCM ciphertext, authentication tag.
const magic = Buffer.from("CVB1");
const ivLength = 12;
const tagLength = 16;
const headerLength = magic.length + ivLength;

/** Encrypts a stream so a leaked backup bucket reveals no client data. */
export function encryptStream(key: Buffer) {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let headerSent = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      if (!headerSent) {
        this.push(Buffer.concat([magic, iv]));
        headerSent = true;
      }
      done(null, cipher.update(chunk));
    },
    flush(done) {
      if (!headerSent) this.push(Buffer.concat([magic, iv]));
      this.push(cipher.final());
      done(null, cipher.getAuthTag());
    },
  });
}

/**
 * Decrypts a stream written by encryptStream. The tag sits at the end, so the last bytes are
 * held back; a wrong key or a changed byte fails the stream when it finishes.
 */
export function decryptStream(key: Buffer) {
  let header = Buffer.alloc(0);
  let decipher: DecipherGCM | undefined;
  let tail = Buffer.alloc(0);
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      if (!decipher) {
        header = Buffer.concat([header, chunk]);
        if (header.length < headerLength) return done();
        if (!header.subarray(0, magic.length).equals(magic))
          return done(new Error("Not a backup file"));
        decipher = createDecipheriv("aes-256-gcm", key, header.subarray(magic.length, headerLength));
        chunk = header.subarray(headerLength);
      }
      const data = Buffer.concat([tail, chunk]);
      const cut = Math.max(0, data.length - tagLength);
      tail = data.subarray(cut);
      done(null, decipher.update(data.subarray(0, cut)));
    },
    flush(done) {
      if (!decipher || tail.length < tagLength) return done(new Error("Backup file is truncated"));
      decipher.setAuthTag(tail);
      try {
        done(null, decipher.final());
      } catch {
        done(new Error("Backup file failed the integrity check"));
      }
    },
  });
}
