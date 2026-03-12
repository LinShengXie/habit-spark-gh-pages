/**
 * Habit API 客户端：与 note/myToy/habit-api 后端通信
 * 使用 VITE_API_BASE_URL，未配置时返回 null 表示走本地 localStorage。
 * 鉴权：请求头自动带 Authorization: Bearer <token>，401 时清 token 并跳转登录页。
 */

import { getLoginPath, getToken, removeToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function getApiBaseUrl(): string | null {
  const url = typeof BASE_URL === "string" ? BASE_URL.trim() : "";
  return url || null;
}

export const useApi = !!getApiBaseUrl();

/** 后端统一成功格式 */
export interface IApiResponse<T> {
  data: T;
  code: number;
}

/** 习惯（与后端 HabitResponse 对齐，id 为数字） */
export interface IHabitDto {
  id: number;
  name: string;
  created_at: string;
}

/** 今日打卡项（与后端 TodayCheckinItem 对齐，含配图 URL 列表） */
export interface ITodayCheckinItem {
  habit_id: number;
  habit_name: string;
  checked: boolean;
  image_urls?: string[];
}

/** 每日统计（与后端 DailyStatItem 对齐） */
export interface IDailyStatItem {
  date: string;
  actual_checkins: number;
  total_habits: number;
}

/** 当前用户信息（与后端 UserMeResponse 对齐） */
export interface IUserMe {
  id: number;
  username: string;
  nickname?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<IApiResponse<T>> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    removeToken();
    window.location.href = getLoginPath();
    throw new Error("未授权，请重新登录");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return { data: undefined as T, code: 0 };
  return res.json() as Promise<IApiResponse<T>>;
}

export async function apiListHabits(): Promise<IHabitDto[]> {
  const { data } = await request<IHabitDto[]>("/habits");
  return data ?? [];
}

export async function apiCreateHabit(name: string): Promise<IHabitDto> {
  const { data } = await request<IHabitDto>("/habits", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data!;
}

export async function apiUpdateHabit(id: number, name: string): Promise<IHabitDto> {
  const { data } = await request<IHabitDto>(`/habits/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return data!;
}

export async function apiDeleteHabit(id: number): Promise<void> {
  await request(`/habits/${id}`, { method: "DELETE" });
}

export async function apiGetTodayCheckins(): Promise<ITodayCheckinItem[]> {
  const { data } = await request<ITodayCheckinItem[]>("/checkins/today");
  return data ?? [];
}

export async function apiCreateCheckin(habitId: number, checkinDate?: string): Promise<void> {
  await request(`/habits/${habitId}/checkins`, {
    method: "POST",
    body: JSON.stringify(checkinDate ? { checkin_date: checkinDate } : {}),
  });
}

export async function apiDeleteCheckin(habitId: number, checkinDate?: string): Promise<void> {
  const q = checkinDate ? `?checkin_date=${checkinDate}` : "";
  await request(`/habits/${habitId}/checkins${q}`, { method: "DELETE" });
}

export async function apiGetDailyStats(days: number = 7): Promise<IDailyStatItem[]> {
  const { data } = await request<IDailyStatItem[]>(`/stats/daily?days=${days}`);
  return data ?? [];
}

/** 获取当前登录用户信息（个人中心用） */
export async function apiGetMe(): Promise<IUserMe | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  try {
    const { data } = await request<IUserMe>("/auth/me");
    return data ?? null;
  } catch {
    return null;
  }
}

export async function apiUpdateMe(payload: {
  nickname?: string | null;
  avatar_url?: string | null;
}): Promise<IUserMe> {
  const { data } = await request<IUserMe>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data!;
}

/** 上传头像（R2），后端会更新当前用户 avatar_url 并返回最新用户信息 */
export async function apiUploadAvatar(file: File): Promise<IUserMe> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const url = `${base.replace(/\/$/, "")}/auth/me/avatar`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = getLoginPath();
    throw new Error("未授权，请重新登录");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`上传失败 ${res.status}: ${body || res.statusText}`);
  }
  const json = (await res.json()) as IApiResponse<IUserMe>;
  return json.data!;
}

/**
 * 上传打卡配图到 R2 并绑定到该习惯当日打卡，返回公网 URL。
 * 传 habitId 与 checkinDate 后，刷新页面配图仍会从接口拉取保留。
 */
export async function apiUploadCheckinImage(
  file: File,
  habitId: number,
  checkinDate: string
): Promise<string> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("habit_id", String(habitId));
  formData.append("checkin_date", checkinDate);
  const url = `${base.replace(/\/$/, "")}/upload/checkin-image`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = getLoginPath();
    throw new Error("未授权，请重新登录");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`上传失败 ${res.status}: ${body || res.statusText}`);
  }
  const json = (await res.json()) as IApiResponse<{ url: string }>;
  return json.data?.url ?? "";
}
