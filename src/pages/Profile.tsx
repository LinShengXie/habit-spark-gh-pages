import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGetMe, apiListHabits, apiUpdateMe, apiUploadAvatar, type IUserMe } from "../api";
import { removeToken } from "../auth";

/** 展示用名称：昵称优先，否则用户名 */
function displayName(user: IUserMe): string {
  const n = (user.nickname ?? "").trim();
  return n || user.username;
}

/**
 * 个人中心：身份展示、资料编辑、使用概览、账号操作。
 */
export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<IUserMe | null>(null);
  const [habitCount, setHabitCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchUser = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [me, habits] = await Promise.all([apiGetMe(), apiListHabits()]);
      setUser(me ?? null);
      setNickname((me?.nickname ?? "") as string);
      setHabitCount(habits?.length ?? 0);
      if (me == null) setError("无法加载用户信息");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setUser(null);
      setHabitCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleLogout = useCallback(() => {
    removeToken();
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const updated = await apiUpdateMe({ nickname: nickname.trim() || null });
      setUser(updated);
      setSaveMsg("已保存");
      window.setTimeout(() => setSaveMsg(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [user, nickname]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      setUploadingAvatar(true);
      setError(null);
      try {
        const updated = await apiUploadAvatar(file);
        setUser(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "头像上传失败");
      } finally {
        setUploadingAvatar(false);
      }
    },
    []
  );

  const joinedAt = user
    ? new Date(user.created_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <main className="container" role="main">
      <div className="panel profile-page">
        <h1 className="profile-page__title">个人中心</h1>
        <p className="profile-page__subtitle">管理你的账号与设置</p>

        {loading && (
          <p className="profile-page__loading" aria-live="polite">
            加载中…
          </p>
        )}

        {error && !loading && (
          <div className="profile-page__error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn--primary" onClick={fetchUser}>
              重试
            </button>
          </div>
        )}

        {user && !loading && (
          <>
            {/* 身份区：头像 + 展示名 + 注册时间 */}
            <header className="profile-hero">
              <div className="profile-hero__avatar-wrap">
                {user.avatar_url ? (
                  <div className="profile-hero__avatar">
                    <img src={user.avatar_url} alt="" loading="lazy" />
                  </div>
                ) : (
                  <div className="profile-hero__avatar profile-hero__avatar--empty" aria-hidden>
                    暂无头像
                  </div>
                )}
              </div>
              <div className="profile-hero__text">
                <p className="profile-hero__name">{displayName(user)}</p>
                <p className="profile-hero__meta">注册于 {joinedAt}</p>
              </div>
            </header>

            {/* 资料编辑 */}
            <section className="profile-section" aria-labelledby="profile-edit-heading">
              <h2 id="profile-edit-heading" className="profile-section__title">
                资料编辑
              </h2>
              <div className="profile-edit">
                <div className="profile-edit__row">
                  <label htmlFor="profile-nickname" className="profile-edit__label">
                    昵称
                  </label>
                  <input
                    id="profile-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="给自己起个昵称"
                    maxLength={64}
                    className="profile-input"
                    aria-label="昵称"
                  />
                </div>
                <div className="profile-edit__row">
                  <span className="profile-edit__label">头像</span>
                  <div className="profile-avatar-wrap">
                    {user.avatar_url ? (
                      <div className="profile-avatar">
                        <img src={user.avatar_url} alt="当前头像" loading="lazy" />
                      </div>
                    ) : (
                      <div className="profile-avatar profile-avatar--empty" aria-hidden>
                        暂无
                      </div>
                    )}
                    <label className="profile-avatar-upload">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarUpload}
                        aria-label="上传头像"
                      />
                      {uploadingAvatar ? "上传中…" : "上传头像"}
                    </label>
                  </div>
                  <p className="profile-edit__hint">支持 JPG、PNG、GIF、WebP，建议正方形图片</p>
                </div>
                <div className="profile-save">
                  <button
                    type="button"
                    className="btn--primary"
                    onClick={handleSave}
                    disabled={saving}
                    aria-busy={saving}
                  >
                    {saving ? "保存中…" : "保存昵称"}
                  </button>
                  {saveMsg && <span className="profile-save__msg" aria-live="polite">{saveMsg}</span>}
                </div>
              </div>
            </section>

            {/* 账号信息（只读） */}
            <section className="profile-section" aria-labelledby="profile-account-heading">
              <h2 id="profile-account-heading" className="profile-section__title">
                账号信息
              </h2>
              <dl className="profile-info__list">
                <div className="profile-info__row">
                  <dt className="profile-info__term">用户名</dt>
                  <dd className="profile-info__value">{user.username}</dd>
                </div>
                <div className="profile-info__row">
                  <dt className="profile-info__term">注册时间</dt>
                  <dd className="profile-info__value">
                    {new Date(user.created_at).toLocaleString("zh-CN", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 使用概览 */}
            <section className="profile-section" aria-labelledby="profile-overview-heading">
              <h2 id="profile-overview-heading" className="profile-section__title">
                使用概览
              </h2>
              <p className="profile-overview__text">
                {habitCount !== null && (
                  <>
                    共 <strong>{habitCount}</strong> 个习惯
                    {habitCount > 0 ? "，" : ""}
                  </>
                )}
                <Link to="/" className="nav-link">
                  {habitCount && habitCount > 0 ? "前往首页管理" : "去首页添加习惯"}
                </Link>
              </p>
            </section>

            {/* 操作 */}
            <div className="profile-page__actions">
              <button
                type="button"
                className="habit-card__btn habit-card__btn--danger"
                onClick={handleLogout}
                aria-label="登出账号"
              >
                登出
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
