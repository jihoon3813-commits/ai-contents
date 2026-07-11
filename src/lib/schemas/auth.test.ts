import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "./auth";

describe("Auth Zod Schemas", () => {
  describe("loginSchema", () => {
    it("올바른 로그인 데이터는 성공해야 함", () => {
      const valid = { email: "user@example.com", password: "password123" };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("올바르지 않은 이메일 형식은 실패해야 함", () => {
      const invalid = { email: "notanemail", password: "password123" };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email?.[0]).toBe(
          "올바른 이메일 형식이 아닙니다."
        );
      }
    });

    it("비밀번호가 8자 미만이면 실패해야 함", () => {
      const invalid = { email: "user@example.com", password: "123" };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password?.[0]).toBe(
          "비밀번호는 최소 8자 이상이어야 합니다."
        );
      }
    });
  });

  describe("signupSchema", () => {
    it("올바른 회원가입 데이터와 약관 동의는 성공해야 함", () => {
      const valid = {
        email: "user@example.com",
        password: "password123",
        passwordConfirm: "password123",
        name: "홍길동",
        termsAccepted: true,
        privacyAccepted: true,
        marketingAccepted: false,
      };
      const result = signupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("비밀번호와 비밀번호 확인이 일치하지 않으면 실패해야 함", () => {
      const invalid = {
        email: "user@example.com",
        password: "password123",
        passwordConfirm: "different123",
        name: "홍길동",
        termsAccepted: true,
        privacyAccepted: true,
      };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.flatten().fieldErrors.passwordConfirm?.[0]
        ).toBe("비밀번호가 일치하지 않습니다.");
      }
    });

    it("필수 약관(이용약관/개인정보)에 동의하지 않으면 실패해야 함", () => {
      const invalid = {
        email: "user@example.com",
        password: "password123",
        passwordConfirm: "password123",
        name: "홍길동",
        termsAccepted: false,
        privacyAccepted: true,
      };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
