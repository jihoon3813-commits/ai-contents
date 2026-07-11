import { describe, it, expect } from "vitest";
import { hasPermission } from "./permission";

describe("hasPermission", () => {
  it("자신의 권한보다 같거나 낮은 조건에 대해서는 true를 반환해야 함", () => {
    expect(hasPermission("OWNER", "OWNER")).toBe(true);
    expect(hasPermission("OWNER", "ADMIN")).toBe(true);
    expect(hasPermission("ADMIN", "ADMIN")).toBe(true);
    expect(hasPermission("ADMIN", "EDITOR")).toBe(true);
    expect(hasPermission("EDITOR", "VIEWER")).toBe(true);
  });

  it("자신의 권한보다 높은 권한이 요구되면 false를 반환해야 함", () => {
    expect(hasPermission("VIEWER", "EDITOR")).toBe(false);
    expect(hasPermission("EDITOR", "ADMIN")).toBe(false);
    expect(hasPermission("ADMIN", "OWNER")).toBe(false);
    expect(hasPermission("VIEWER", "OWNER")).toBe(false);
  });

  it("잘못된 역할명이 주어지면 false를 반환해야 함", () => {
    // @ts-expect-error - testing invalid JS input
    expect(hasPermission("GUEST", "VIEWER")).toBe(false);
    // @ts-expect-error - testing invalid JS input
    expect(hasPermission("ADMIN", "INVALID")).toBe(false);
  });
});
