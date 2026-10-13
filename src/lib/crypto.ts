import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
function key() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error("Configure ENCRYPTION_KEY with 32 base64 bytes");
  const k = Buffer.from(value, "base64");
  if (k.length !== 32) throw new Error("Invalid encryption key");
  return k;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}
export function decrypt(value: string) {
  const [version, iv, tag, data, ...extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data || extra.length)
    throw new Error("Invalid ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function verifyHmac(
  body: string | Buffer,
  secret: string,
  header: string | null,
) {
  const signature = header?.replace(/^sha256=/, "");
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "hex");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
export function newSecret() {
  return randomBytes(32).toString("hex");
}
