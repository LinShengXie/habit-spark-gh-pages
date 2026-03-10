import { useMemo, useState } from "react";

type THabit = {
  id: string;
  name: string;
  createdAt: string;
};

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

export default function App() {
  const [state, setState] = useState<TStoredData>(() => readStorage());
  const [name, setName] = useState("");

  const today = todayKey();
  const todayChecked = state.checkinsByDate[today] ?? [];

  const todayDoneCount = useMemo(() => {
    return state.habits.reduce((acc, habit) => acc + (todayChecked.includes(habit.id) ? 1 : 0), 0);
  }, [state.habits, todayChecked]);

  const completionRate = state.habits.length > 0 ? Math.round((todayDoneCount / state.habits.length) * 100) : 0;

  const trend = useMemo(() => {
    return last7Days().map((day) => {
      const checked = state.checkinsByDate[day] ?? [];
      const done = state.habits.reduce((acc, habit) => acc + (checked.includes(habit.id) ? 1 : 0), 0);
      const percent = state.habits.length > 0 ? Math.round((done / state.habits.length) * 100) : 0;
      return { day, percent };
    });
  }, [state.checkinsByDate, state.habits]);

  function updateState(next: TStoredData): void {
    setState(next);
    writeStorage(next);
  }

  function handleAddHabit(): void {
    const value = name.trim();
    if (!value) return;
    const next: TStoredData = {
      ...state,
      habits: [...state.habits, { id: crypto.randomUUID(), name: value, createdAt: new Date().toISOString() }],
    };
    updateState(next);
    setName("");
  }

  function handleDeleteHabit(id: string): void {
    if (!window.confirm("确认删除这个习惯吗？")) return;
    const habits = state.habits.filter((item) => item.id !== id);
    const checkinsByDate: Record<string, string[]> = {};
    Object.entries(state.checkinsByDate).forEach(([day, ids]) => {
      checkinsByDate[day] = ids.filter((habitId) => habitId !== id);
    });
    updateState({ habits, checkinsByDate });
  }

  function toggleCheckin(id: string): void {
    const set = new Set(state.checkinsByDate[today] ?? []);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    updateState({
      ...state,
      checkinsByDate: {
        ...state.checkinsByDate,
        [today]: Array.from(set),
      },
    });
  }

  return (
    <main className="container">
      <header className="panel">
        <h1>Habit Spark</h1>
        <p className="muted">本地优先、可直接部署到 GitHub Pages 的习惯打卡项目。</p>
        <p className="progress">
          今日进度：{todayDoneCount} / {state.habits.length}（{completionRate}%）
        </p>
      </header>

      <section className="panel form">
        <label htmlFor="habitName">新习惯</label>
        <div className="row">
          <input
            id="habitName"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：晚饭后散步 20 分钟"
            maxLength={64}
          />
          <button type="button" onClick={handleAddHabit}>
            添加
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>习惯列表</h2>
        {state.habits.length === 0 ? (
          <p className="muted">还没有习惯，先新增一个吧。</p>
        ) : (
          <ul className="habitList">
            {state.habits.map((habit) => {
              const checked = todayChecked.includes(habit.id);
              return (
                <li key={habit.id} className="habitItem">
                  <div>
                    <strong>{habit.name}</strong>
                    <p className="muted">创建于 {new Date(habit.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="actions">
                    <button type="button" className={checked ? "ok" : ""} onClick={() => toggleCheckin(habit.id)}>
                      {checked ? "已打卡" : "打卡"}
                    </button>
                    <button type="button" className="danger" onClick={() => handleDeleteHabit(habit.id)}>
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>近 7 天完成率</h2>
        <ul className="trendList">
          {trend.map((item) => (
            <li key={item.day}>
              <span>{item.day}</span>
              <div className="bar">
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
