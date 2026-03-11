/**
 * Habit API 客户端：与 note/myToy/habit-api 后端通信
 * 使用 VITE_API_BASE_URL，未配置时返回 null 表示走本地 localStorage。
 */

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

/** 今日打卡项（与后端 TodayCheckinItem 对齐） */
export interface ITodayCheckinItem {
  habit_id: number;
  habit_name: string;
  checked: boolean;
}

/** 每日统计（与后端 DailyStatItem 对齐） */
export interface IDailyStatItem {
  date: string;
  actual_checkins: number;
  total_habits: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<IApiResponse<T>> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
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
