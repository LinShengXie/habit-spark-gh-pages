import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCreateCheckin,
  apiCreateHabit,
  apiDeleteCheckin,
  apiDeleteHabit,
  apiGetDailyStats,
  apiGetTodayCheckins,
  apiListHabits,
  getApiBaseUrl,
  type IDailyStatItem,
  type IHabitDto,
} from "./api";

/** 空状态用 SVG 图标（无 emoji，符合 ui-ux-pro-max） */
function EmptyStateIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
      <path d="M22 32h8v8h-8v-8zm12 0h8v8h-8v-8zm12 0h8v8h-8v-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
      <path d="M20 24l4 4 8-8 8 8 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
    </svg>
  );
}

const useApiMode = !!getApiBaseUrl();

/** 前端展示用习惯（API 模式下 id 为数字，本地模式为 string） */
type THabit = {
  id: number | string;
  name: string;
  createdAt: string;
};

/** 仅本地模式使用的存储结构 */
type TStoredData = {
  habits: THabit[];
  checkinsByDate: Record<string, string[]>;
};

const STORAGE_KEY = "habit-spark-v1";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function last7Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function readStorage(): TStoredData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      habits: [{ id: crypto.randomUUID(), name: "每日阅读 20 分钟", createdAt: new Date().toISOString() }],
      checkinsByDate: {},
    };
  }
  try {
    const data = JSON.parse(raw) as TStoredData;
    return {
      habits: Array.isArray(data.habits) ? data.habits : [],
      checkinsByDate: data.checkinsByDate ?? {},
    };
  } catch {
    return { habits: [], checkinsByDate: {} };
  }
}

function writeStorage(data: TStoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function habitDtoToDisplay(dto: IHabitDto): THabit {
  return {
    id: dto.id,
    name: dto.name,
    createdAt: dto.created_at,
  };
}

export default function App() {
  const today = todayKey();

  // API 模式：习惯列表、今日打卡集合、近 7 天统计、loading、error
  const [habits, setHabits] = useState<THabit[]>([]);
  const [todayCheckedIds, setTodayCheckedIds] = useState<Set<number | string>>(new Set());
  const [dailyStats, setDailyStats] = useState<IDailyStatItem[]>([]);
  const [loading, setLoading] = useState(useApiMode);
  const [error, setError] = useState<string | null>(null);

  // 本地模式：沿用原 state
  const [localState, setLocalState] = useState<TStoredData>(() => readStorage());
  const [name, setName] = useState("");

  const isApiMode = useApiMode;

  const fetchHabitsAndToday = useCallback(async () => {
    if (!isApiMode) return;
    setError(null);
    try {
      const [habitList, todayList] = await Promise.all([apiListHabits(), apiGetTodayCheckins()]);
      setHabits(habitList.map(habitDtoToDisplay));
      const checked = new Set<number>(todayList.filter((t) => t.checked).map((t) => t.habit_id));
      setTodayCheckedIds(checked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHabits([]);
      setTodayCheckedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [isApiMode]);

  const fetchDailyStats = useCallback(async () => {
    if (!isApiMode) return;
    try {
      const stats = await apiGetDailyStats(7);
      setDailyStats(stats);
    } catch {
      setDailyStats([]);
    }
  }, [isApiMode]);

  useEffect(() => {
    if (isApiMode) {
      fetchHabitsAndToday();
      fetchDailyStats();
    }
  }, [isApiMode, fetchHabitsAndToday, fetchDailyStats]);

  const displayHabits = isApiMode ? habits : localState.habits;
  const displayTodayChecked = isApiMode
    ? todayCheckedIds
    : new Set(localState.checkinsByDate[today] ?? []);

  const todayDoneCount = useMemo(() => {
    return displayHabits.filter((h) => displayTodayChecked.has(h.id)).length;
  }, [displayHabits, displayTodayChecked]);

  const completionRate = displayHabits.length > 0 ? Math.round((todayDoneCount / displayHabits.length) * 100) : 0;

  const trend = useMemo(() => {
    if (isApiMode && dailyStats.length > 0) {
      return dailyStats.map((s) => ({
        day: typeof s.date === "string" ? s.date.slice(0, 10) : s.date,
        percent: s.total_habits > 0 ? Math.round((s.actual_checkins / s.total_habits) * 100) : 0,
      }));
    }
    if (!isApiMode) {
      return last7Days().map((day) => {
        const checked = localState.checkinsByDate[day] ?? [];
        const done = localState.habits.filter((h) => checked.includes(String(h.id))).length;
        const pct = localState.habits.length > 0 ? Math.round((done / localState.habits.length) * 100) : 0;
        return { day, percent: pct };
      });
    }
    return last7Days().map((day) => ({ day, percent: 0 }));
  }, [isApiMode, dailyStats, localState]);

  const handleAddHabit = useCallback(() => {
    const value = name.trim();
    if (!value) return;
    if (isApiMode) {
      apiCreateHabit(value)
        .then(() => {
          setName("");
          return fetchHabitsAndToday();
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
      return;
    }
    const next: TStoredData = {
      ...localState,
      habits: [...localState.habits, { id: crypto.randomUUID(), name: value, createdAt: new Date().toISOString() }],
    };
    setLocalState(next);
    writeStorage(next);
    setName("");
  }, [name, isApiMode, localState, fetchHabitsAndToday]);

  const handleDeleteHabit = useCallback(
    (id: number | string) => {
      if (!window.confirm("确认删除这个习惯吗？")) return;
      if (isApiMode && typeof id === "number") {
        apiDeleteHabit(id)
          .then(() => fetchHabitsAndToday())
          .catch((e) => setError(e instanceof Error ? e.message : String(e)));
        return;
      }
      const habitsNext = localState.habits.filter((item) => item.id !== id);
      const checkinsByDate: Record<string, string[]> = {};
      Object.entries(localState.checkinsByDate).forEach(([day, ids]) => {
        checkinsByDate[day] = ids.filter((habitId) => String(habitId) !== String(id));
      });
      const next = { habits: habitsNext, checkinsByDate };
      setLocalState(next);
      writeStorage(next);
    },
    [isApiMode, localState, fetchHabitsAndToday]
  );

  const toggleCheckin = useCallback(
    (id: number | string) => {
      if (isApiMode && typeof id === "number") {
        const checked = todayCheckedIds.has(id);
        const fn = checked ? () => apiDeleteCheckin(id, today) : () => apiCreateCheckin(id, today);
        fn()
          .then(() => {
            fetchHabitsAndToday();
          })
          .catch((e) => setError(e instanceof Error ? e.message : String(e)));
        return;
      }
      const set = new Set(localState.checkinsByDate[today] ?? []);
      const sid = String(id);
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      const next = {
        ...localState,
        checkinsByDate: { ...localState.checkinsByDate, [today]: Array.from(set) },
      };
      setLocalState(next);
      writeStorage(next);
    },
    [isApiMode, today, todayCheckedIds, localState, fetchHabitsAndToday]
  );

  if (isApiMode && loading) {
    return (
      <main className="container" role="main">
        <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
          <p className="muted">加载中…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container" role="main">
      {isApiMode && error && (
        <div className="panel" style={{ background: "rgba(248,113,113,0.15)", borderColor: "var(--danger)" }}>
          <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
        </div>
      )}
      <header className="panel">
        <h1>Habit Spark</h1>
        <p className="muted">本地优先、可直接部署到 GitHub Pages 的习惯打卡项目。</p>
        <div className="header__progress" aria-live="polite" aria-atomic="true">
          <span
            className={`progress-pill ${completionRate === 100 && displayHabits.length > 0 ? "progress-pill--full" : ""}`}
            aria-label={`今日进度 ${todayDoneCount} 共 ${displayHabits.length}，完成率 ${completionRate}%`}
          >
            {todayDoneCount} / {displayHabits.length} · {completionRate}%
          </span>
        </div>
      </header>

      <section className="panel form" aria-labelledby="form-heading">
        <h2 id="form-heading" className="visually-hidden">添加新习惯</h2>
        <label htmlFor="habitName">新习惯</label>
        <div className="row">
          <input
            id="habitName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
            placeholder="例如：晚饭后散步 20 分钟"
            maxLength={64}
          />
          <button type="button" className="btn--primary" onClick={handleAddHabit} disabled={!name.trim()}>
            添加
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="habit-list-heading">
        <h2 id="habit-list-heading">习惯列表</h2>
        {displayHabits.length === 0 ? (
          <div className="empty-state">
            <EmptyStateIcon className="empty-state__icon" aria-hidden />
            <p>还没有习惯，在上方输入名称并点击「添加」开始吧。</p>
          </div>
        ) : (
          <ul className="habitList">
            {displayHabits.map((habit) => {
              const checked = displayTodayChecked.has(habit.id);
              return (
                <li key={habit.id} className="habitItem">
                  <div>
                    <strong>{habit.name}</strong>
                    <p className="muted">创建于 {new Date(habit.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className={checked ? "ok" : ""}
                      onClick={() => toggleCheckin(habit.id)}
                      aria-pressed={checked}
                      aria-label={checked ? `取消今日打卡：${habit.name}` : `今日打卡：${habit.name}`}
                    >
                      {checked ? "已打卡" : "打卡"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDeleteHabit(habit.id)}
                      aria-label={`删除习惯：${habit.name}`}
                    >
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="trend-heading">
        <h2 id="trend-heading">近 7 天完成率</h2>
        <ul className="trendList">
          {trend.map((item) => (
            <li key={item.day} className={item.day === today ? "trendList__today" : undefined}>
              <span>{item.day}</span>
              <div className="bar" role="progressbar" aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.day} 完成率 ${item.percent}%`}>
                <div style={{ width: `${item.percent}%` }} />
              </div>
              <span>{item.percent}%</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
