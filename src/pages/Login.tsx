import { useCallback, useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { isLoggedIn, setToken } from "../auth";
import { getApiBaseUrl } from "../api";

const API_BASE = getApiBaseUrl();

/** 将接口错误转为用户可理解的文案（规范：错误提示说人话、可操作） */
function friendlyAuthError(status: number, data: { detail?: string | Array<{ msg?: string }> }): string {
  let raw = "";
  if (typeof data.detail === "string") raw = data.detail;
  else if (Array.isArray(data.detail) && data.detail[0]?.msg) raw = data.detail[0].msg;
  if (raw && !/^[\d\s]+$/.test(raw)) return raw;
  if (status === 400) return "用户名或密码格式不正确，请检查后重试";
  if (status === 401) return "用户名或密码错误，请重试";
  if (status === 409 || (raw && /已存在|重复/i.test(raw))) return "该用户名已被注册，请换一个或直接登录";
  if (status >= 500) return "服务暂时不可用，请稍后再试";
  return "请求失败，请稍后重试";
}

/**
 * 登录 / 注册页
 * 后端未提供 /auth 时可用「开发模式」：任意非空账号密码通过并写入 mock token
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const u = username.trim();
      const p = password;
      if (!u || !p) {
        setError("请输入用户名和密码");
        return;
      }
      setLoading(true);
      try {
        if (!API_BASE) {
          setError("未配置 API 地址，无法登录");
          setLoading(false);
          return;
        }
        const path = isRegister ? "/auth/register" : "/auth/login";
        const url = `${API_BASE.replace(/\/$/, "")}${path}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
          setToken(data.access_token);
          navigate(from, { replace: true });
          return;
        }
        if (res.status === 404 || res.status === 422) {
          setError("dev_mode");
          setLoading(false);
          return;
        }
        setError(friendlyAuthError(res.status, data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络异常，请检查网络后重试");
      } finally {
        setLoading(false);
      }
    },
    [username, password, isRegister, navigate, from]
  );

  if (isLoggedIn()) {
    return <Navigate to={from || "/"} replace />;
  }

  return (
    <main className="auth-page" role="main">
      <div className="auth-layout">
        <section className="auth-aside" aria-label="产品介绍">
          <div className="auth-aside__top">
            <div className="auth-aside__brand">
              <div className="auth-aside__logo" aria-hidden>
                HS
              </div>
              <div className="auth-aside__brand-text">
                <p className="auth-aside__kicker">习惯养成 · 轻量打卡</p>
                <p className="auth-aside__brand-name">Habit Spark</p>
                <p className="auth-aside__brand-tagline">把每天的小坚持变成看得见的进步</p>
              </div>
            </div>

            <div className="auth-aside__badges" aria-label="亮点标签">
              <span className="auth-aside__badge">近 7 天趋势</span>
              <span className="auth-aside__badge">配图留念</span>
              <span className="auth-aside__badge">账号同步</span>
            </div>
          </div>

          <ul className="auth-aside__points" aria-label="核心能力">
            <li>一键打卡，保持节奏不打断</li>
            <li>趋势可视化，复盘更容易</li>
            <li>打卡配图与头像上传，记录更完整</li>
            <li>登录后同步，多端一致</li>
          </ul>

          <div className="auth-aside__cards" aria-label="安全与同步说明">
            <div className="auth-aside__card" role="note">
              <p className="auth-aside__card-title">隐私与安全</p>
              <p className="auth-aside__card-text">密码不会以明文保存；你可以随时更换头像与配图。</p>
            </div>
            <div className="auth-aside__card" role="note">
              <p className="auth-aside__card-title">数据同步</p>
              <p className="auth-aside__card-text">登录后你的习惯、打卡与图片会随账号同步。</p>
            </div>
          </div>

          <p className="auth-aside__small">
            想先看看？{" "}
            <Link to="/" className="auth-aside__link" aria-label="回到首页查看">
              前往首页
            </Link>
          </p>
        </section>

        <section className="auth-card" aria-label={isRegister ? "注册表单" : "登录表单"}>
          <header className="auth-card__header">
            <h1 className="auth-card__title">{isRegister ? "注册" : "登录"}</h1>
            <p className="auth-card__subtitle">{isRegister ? "创建账号以使用习惯打卡" : "登录以使用习惯打卡"}</p>
          </header>
          <form onSubmit={handleSubmit} className="auth-card__form">
            <div className="auth-field">
              <label htmlFor="login-username">用户名或邮箱</label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名或邮箱"
                className="auth-input"
                aria-invalid={!!error && error !== "dev_mode"}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">密码</label>
              <input
                id="login-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="auth-input"
                aria-invalid={!!error && error !== "dev_mode"}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            {error && (
              <div id="login-error" role="alert" className="auth-card__error">
                {error === "dev_mode" ? (
                  <>
                    <p className="auth-card__error-hint">服务暂未就绪，可先使用开发模式进入</p>
                    <button
                      type="button"
                      className="auth-btn auth-btn--primary"
                      onClick={() => {
                        setToken("dev-mock-token");
                        navigate(from, { replace: true });
                      }}
                      aria-label="使用开发模式进入"
                    >
                      开发模式进入
                    </button>
                  </>
                ) : (
                  <p className="auth-card__error-text">{error}</p>
                )}
              </div>
            )}
            {error !== "dev_mode" && (
              <button
                type="submit"
                className="auth-btn auth-btn--primary auth-btn--block"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "提交中…" : isRegister ? "注册" : "登录"}
              </button>
            )}
          </form>
          <footer className="auth-card__footer">
            <span className="auth-card__footer-text">{isRegister ? "已有账号？" : "还没有账号？"}</span>
            <button
              type="button"
              className="auth-card__footer-link"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              aria-label={isRegister ? "切换到登录" : "切换到注册"}
            >
              {isRegister ? "去登录" : "去注册"}
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
