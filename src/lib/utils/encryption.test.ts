import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("대칭 키 암복호화 유틸리티 검증 테스트", () => {
  it("정상적으로 암호화와 복호화가 매핑 복원되어야 한다", () => {
    const rawText = "AntigravitySecretPassword123!@#";
    const encrypted = encrypt(rawText);
    
    // 원본과 암호문이 달라야 함
    expect(encrypted).not.toBe(rawText);
    // iv:ciphertext:authTag 포맷 형태 확인
    expect(encrypted.split(":").length).toBe(3);

    const decrypted = decrypt(encrypted);
    // 원본과 복호화 결과가 동일해야 함
    expect(decrypted).toBe(rawText);
  });

  it("빈 값 입력 시 빈 문자열을 즉시 반환해야 한다", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });

  it("잘못된 형태의 암호화 데이터 복호화 시 예외를 던져야 한다", () => {
    expect(() => decrypt("malformedText")).toThrow();
    expect(() => decrypt("part1:part2")).toThrow();
  });
});
