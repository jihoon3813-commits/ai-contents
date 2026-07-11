import { z } from "zod";

// 1. 로그인 스키마
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "이메일을 입력해 주세요." })
    .email({ message: "올바른 이메일 형식이 아닙니다." }),
  password: z
    .string()
    .min(1, { message: "비밀번호를 입력해 주세요." })
    .min(8, { message: "비밀번호는 최소 8자 이상이어야 합니다." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// 2. 회원가입 스키마
export const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: "이메일을 입력해 주세요." })
      .email({ message: "올바른 이메일 형식이 아닙니다." }),
    password: z
      .string()
      .min(1, { message: "비밀번호를 입력해 주세요." })
      .min(8, { message: "비밀번호는 최소 8자 이상이어야 합니다." }),
    passwordConfirm: z
      .string()
      .min(1, { message: "비밀번호 확인을 입력해 주세요." }),
    name: z
      .string()
      .min(1, { message: "이름을 입력해 주세요." })
      .max(50, { message: "이름은 50자 이하로 입력해 주세요." }),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "이용약관 동의가 필요합니다.",
    }),
    privacyAccepted: z.boolean().refine((val) => val === true, {
      message: "개인정보 처리방침 동의가 필요합니다.",
    }),
    marketingAccepted: z.boolean().optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

// 3. 비밀번호 재설정 이메일 발송 스키마
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "이메일을 입력해 주세요." })
    .email({ message: "올바른 이메일 형식이 아닙니다." }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// 4. 비밀번호 변경 스키마
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, { message: "비밀번호를 입력해 주세요." })
      .min(8, { message: "비밀번호는 최소 8자 이상이어야 합니다." }),
    passwordConfirm: z
      .string()
      .min(1, { message: "비밀번호 확인을 입력해 주세요." }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
