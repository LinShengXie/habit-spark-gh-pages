/**
 * 鉴权：Token 存读与登录页路径
 * 与 07-auth-and-images-plan / 前端改造计划 对齐
 */

export const AUTH_TOKEN_KEY = "habit-spark-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  const t = getToken();
  return typeof t === "string" && t.length > 0;
}

/** 未登录时跳转的登录页路径（与 Router basename 无关，相对站点根） */
export function getLoginPath(): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "") || "";
  return `${base}${base ? "/" : ""}login`;
}
