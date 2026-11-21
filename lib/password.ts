import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

// Unknown usernames still do the same expensive verification work.
const dummyHash = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`;

export async function verifyPassword(password: string, encoded = dummyHash) {
  const [version, salt, hex] = encoded.split(":");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hex, "hex"));
}
