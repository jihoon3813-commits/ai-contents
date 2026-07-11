import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("공백이 포함된 워크스페이스 이름을 하이픈으로 변경하고 소문자로 변환해야 함", () => {
    expect(generateSlug("My Workspace Name")).toBe("my-workspace-name");
  });

  it("한글 워크스페이스 이름을 정상적으로 유지해야 함", () => {
    expect(generateSlug("안티그래비티 SaaS")).toBe("안티그래비티-saas");
  });

  it("특수문자는 제거하거나 하이픈으로 치환되어야 함", () => {
    expect(generateSlug("Awesome!!! Workspace #1")).toBe("awesome-workspace-1");
  });

  it("시작과 끝에 하이픈이 오지 않아야 하며 중복 하이픈은 제거해야 함", () => {
    expect(generateSlug("---test---workspace---")).toBe("test-workspace");
  });

  it("입력값이 비어있는 경우 기본값 'workspace'를 반환해야 함", () => {
    expect(generateSlug("")).toBe("workspace");
    // @ts-expect-error - testing invalid JS inputs
    expect(generateSlug(null)).toBe("workspace");
  });
});
