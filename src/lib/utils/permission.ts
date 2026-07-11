export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

const ROLE_WEIGHTS: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/**
 * 사용자의 역할(userRole)이 필요한 최소 역할(requiredRole) 이상의 권한을 가지고 있는지 검증합니다.
 * @param userRole 사용자의 소속 워크스페이스 역할
 * @param requiredRole 해당 리소스/작업에 필요한 최소 역할
 * @returns 권한 충족 여부
 */
export function hasPermission(
  userRole: WorkspaceRole,
  requiredRole: WorkspaceRole
): boolean {
  const userWeight = ROLE_WEIGHTS[userRole];
  const requiredWeight = ROLE_WEIGHTS[requiredRole];

  if (userWeight === undefined || requiredWeight === undefined) {
    return false;
  }

  return userWeight >= requiredWeight;
}
