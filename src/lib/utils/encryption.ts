import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length
const KEY_LENGTH = 32; // 256-bit key

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || "default_local_encryption_secret_antigravity";
  const salt = "antigravity_salt_fixed";
  // PBKDF2를 사용하여 임의 길이의 비밀 키를 고정 32바이트 대칭 키로 안전하게 유도
  return crypto.pbkdf2Sync(secret, salt, 10000, KEY_LENGTH, "sha256");
}

/**
 * 평문을 AES-256-GCM 알고리즘으로 양방향 암호화합니다.
 * @param text 평문
 * @returns iv:ciphertext:authTag 형태의 결합된 헥사 문자열
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // 분리 보관을 위해 콜론(:) 구분자로 병합하여 리턴
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * 암호화된 문자열을 평문으로 복호화합니다.
 * @param encryptedText iv:ciphertext:authTag 결합 문자열
 * @returns 복호화된 평문
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format.");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], "hex");

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
