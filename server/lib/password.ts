// =========================================================================
// password: 密码哈希工具（Node 内置 crypto scrypt，无第三方依赖）
// 存储格式: "scrypt:<salt-hex>:<hash-hex>"
// 兼容历史明文密码：verifyPassword 对非哈希格式的存储值做明文比对，
// 登录成功后由调用方自动升级为哈希存储。
// =========================================================================
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const PREFIX = "scrypt:";

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LENGTH).toString("hex");
  return `${PREFIX}${salt}:${hash}`;
}

export function isHashed(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof stored !== "string" || stored.length === 0) return false;
  if (!isHashed(stored)) return stored === plain;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(plain, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
