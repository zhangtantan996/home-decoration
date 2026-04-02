import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSessionStore } from '../../modules/session/sessionStore';
import { requestJson, uploadFile } from '../../services/http';
import { updateProfile } from '../../services/profile';
import { getUploadedAssetPath, normalizeStoredAssetPath, toAbsoluteAssetUrl } from '../../utils/asset';
import styles from './ProfileEditPage.module.scss';

interface RawProfile {
  id: number;
  publicId?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  userType?: number;
}

interface ProfileFormState {
  nickname: string;
  avatar: string;
  phone: string;
  publicId: string;
}

interface FeedbackState {
  tone: 'success' | 'error';
  text: string;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 18 9 12l6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 8.5a2.5 2.5 0 0 1 2.5-2.5h1.95c.44 0 .86-.18 1.17-.49l.86-.86c.31-.31.73-.49 1.17-.49h.7c.44 0 .86.18 1.17.49l.86.86c.31.31.73.49 1.17.49h1.95A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="3.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 12 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="18" rx="3" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="3" />
      <path d="M10 17h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function IDIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
      <path d="M8 11h8M8 14h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="8" cy="8.5" fill="currentColor" r="1" />
    </svg>
  );
}

const EMPTY_FORM: ProfileFormState = {
  nickname: '',
  avatar: '',
  phone: '',
  publicId: '',
};

function maskPhone(phone: string) {
  if (!phone) {
    return '未绑定';
  }
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function buildForm(profile: RawProfile): ProfileFormState {
  return {
    nickname: profile.nickname || '',
    avatar: normalizeStoredAssetPath(profile.avatar || ''),
    phone: profile.phone || '',
    publicId: profile.publicId || '',
  };
}

function syncSessionUser(profile: RawProfile) {
  const sessionUser = useSessionStore.getState().user;
  if (!sessionUser) {
    return;
  }

  useSessionStore.setState({
    user: {
      ...sessionUser,
      id: profile.id || sessionUser.id,
      publicId: profile.publicId ?? sessionUser.publicId,
      phone: profile.phone || sessionUser.phone,
      nickname: profile.nickname ?? sessionUser.nickname,
      avatar: profile.avatar ?? sessionUser.avatar,
      userType: profile.userType ?? sessionUser.userType,
    },
  });
}

function LoadingSkeleton() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.skeleton} ${styles.skeletonBack}`} />
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeleton} ${styles.skeletonText}`} />
      </header>

      <div className={styles.layout}>
        <aside className={styles.sideColumn}>
          <section className={styles.card}>
            <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTextShort}`} />
            <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
          </section>
          <section className={styles.card}>
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
          </section>
        </aside>

        <main className={styles.mainColumn}>
          <section className={styles.card}>
            <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
            <div className={styles.skeletonInfoGrid}>
              <div className={`${styles.skeleton} ${styles.skeletonInfo}`} />
              <div className={`${styles.skeleton} ${styles.skeletonInfo}`} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonButtonWide}`} />
          </section>
          <section className={styles.card}>
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
          </section>
        </main>
      </div>
    </div>
  );
}

export function ProfileEditPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [profileMeta, setProfileMeta] = useState<RawProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileFormState>(EMPTY_FORM);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await requestJson<RawProfile>('/user/profile');
      const nextForm = buildForm(profile);
      setProfileMeta(profile);
      setForm(nextForm);
      setInitialForm(nextForm);
      syncSessionUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const completeness = useMemo(() => {
    const checkpoints = [Boolean(form.avatar), Boolean(form.nickname.trim()), Boolean(form.phone)];
    const completed = checkpoints.filter(Boolean).length;
    return Math.round((completed / checkpoints.length) * 100);
  }, [form.avatar, form.nickname, form.phone]);

  const readinessItems = useMemo(
    () => [
      { label: '头像已设置', ready: Boolean(form.avatar) },
      { label: '昵称可展示', ready: Boolean(form.nickname.trim()) },
      { label: '手机号已绑定', ready: Boolean(form.phone) },
    ],
    [form.avatar, form.nickname, form.phone],
  );

  const syncTargets = useMemo(() => ['顶部导航头像', '个人中心概览', '业务详情中的用户昵称'], []);

  const isDirty = form.nickname.trim() !== initialForm.nickname.trim() || form.avatar !== initialForm.avatar;
  const maskedPhone = useMemo(() => maskPhone(form.phone), [form.phone]);
  const displayName = form.nickname.trim() || '未设置昵称';
  const avatarFallback = (displayName.slice(0, 1) || '我').toUpperCase();
  const phoneBound = Boolean(form.phone);

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFeedback({ tone: 'error', text: '请选择 JPG、PNG、WEBP 等图片文件。' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ tone: 'error', text: '头像大小请控制在 10MB 以内。' });
      return;
    }

    try {
      setUploadingAvatar(true);
      setFeedback(null);
      const uploaded = await uploadFile('/upload', file);
      setForm((current) => ({ ...current, avatar: getUploadedAssetPath(uploaded, current.avatar) }));
      setFeedback({ tone: 'success', text: '头像已上传，记得保存资料。' });
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : '头像上传失败，请稍后重试。' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleNicknameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.slice(0, 20);
    setForm((current) => ({ ...current, nickname: value }));
    if (feedback) {
      setFeedback(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || uploadingAvatar || !profileMeta || !isDirty) {
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        nickname: form.nickname.trim(),
        avatar: form.avatar,
      };

      await updateProfile(payload);

      const nextProfile: RawProfile = {
        ...profileMeta,
        nickname: payload.nickname,
        avatar: toAbsoluteAssetUrl(payload.avatar),
      };

      const nextForm = buildForm(nextProfile);
      setProfileMeta(nextProfile);
      setForm(nextForm);
      setInitialForm(nextForm);
      syncSessionUser(nextProfile);
      setFeedback({ tone: 'success', text: '资料已保存，顶部头像和个人中心会同步刷新。' });
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : '保存失败，请稍后重试。' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <section className={`${styles.card} ${styles.errorCard}`}>
          <p className={styles.sectionTag}>加载失败</p>
          <h1 className={styles.pageTitle}>当前无法读取个人资料</h1>
          <p className={styles.pageDesc}>{error}</p>
          <div className={styles.inlineActions}>
            <button className={styles.primaryButton} onClick={() => void loadData()} type="button">
              重新加载
            </button>
            <Link className={styles.ghostLink} to="/me">
              返回个人中心
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} to="/me">
          <BackIcon />
          返回个人中心
        </Link>
        <div className={styles.headerCopy}>
          <p className={styles.sectionTag}>个人资料</p>
          <h1 className={styles.pageTitle}>编辑资料</h1>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sideColumn}>
          <section className={`${styles.card} ${styles.avatarCard}`}>
            <div className={styles.avatarShell}>
              {form.avatar ? <img alt={`${displayName}头像`} className={styles.avatarImage} src={toAbsoluteAssetUrl(form.avatar)} /> : <div className={styles.avatarFallback}>{avatarFallback}</div>}
            </div>

            <div className={styles.profileSummary}>
              <strong>{displayName}</strong>
              <span>{maskedPhone}</span>
            </div>

            <input accept="image/png,image/jpeg,image/webp,image/gif" className={styles.hiddenInput} onChange={handleAvatarChange} ref={fileInputRef} type="file" />

            <button className={styles.secondaryButton} onClick={handleAvatarPick} type="button">
              <CameraIcon />
              {uploadingAvatar ? '头像上传中...' : '上传新头像'}
            </button>
          </section>

          <section className={styles.card}>
            <div className={styles.compactHeader}>
              <div>
                <p className={styles.sectionTag}>资料状态</p>
                <h2 className={styles.sectionTitle}>当前完成度</h2>
              </div>
              <strong className={styles.progressValue}>{completeness}%</strong>
            </div>

            <div aria-hidden="true" className={styles.progressTrack}>
              <span className={styles.progressBar} style={{ width: `${completeness}%` }} />
            </div>

            <div className={styles.statusList}>
              {readinessItems.map((item) => (
                <div className={styles.statusItem} key={item.label}>
                  <span className={item.ready ? styles.statusIndicatorReady : styles.statusIndicatorPending}>{item.ready ? <CheckIcon /> : null}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className={styles.mainColumn}>
          <form className={`${styles.card} ${styles.formCard}`} id="profile-edit-form" onSubmit={handleSubmit}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionTag}>基础资料</p>
                <h2 className={styles.sectionTitle}>头像与昵称</h2>
              </div>
            </header>

            <label className={styles.fieldBlock} htmlFor="profile-nickname">
              <span className={styles.fieldLabel}>昵称</span>
              <input id="profile-nickname" maxLength={20} onChange={handleNicknameChange} placeholder="请输入昵称" type="text" value={form.nickname} />
            </label>

            <div className={styles.infoGrid}>
              <div className={styles.infoBlock}>
                <span className={styles.infoIcon}>
                  <PhoneIcon />
                </span>
                <div className={styles.infoCopy}>
                  <span className={styles.infoLabel}>绑定手机号</span>
                  <strong>{maskedPhone}</strong>
                </div>
              </div>
              <div className={styles.infoBlock}>
                <span className={styles.infoIcon}>
                  <IDIcon />
                </span>
                <div className={styles.infoCopy}>
                  <span className={styles.infoLabel}>账户编号</span>
                  <strong>{form.publicId || '系统生成中'}</strong>
                </div>
              </div>
            </div>

            <section className={styles.syncSection}>
              <div className={styles.syncHeader}>
                <h3 className={styles.syncTitle}>保存后会同步到</h3>
              </div>
              <div className={styles.syncChips}>
                {syncTargets.map((item) => (
                  <span className={styles.syncChip} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </section>

            {feedback ? <div className={feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div> : null}

            <div className={styles.formFooter}>
              <div className={styles.footerActions}>
                <Link className={styles.ghostLink} to="/me">
                  返回个人中心
                </Link>
                <button className={styles.primaryButton} disabled={!isDirty || saving || uploadingAvatar} type="submit">
                  {saving ? '保存中...' : '保存资料'}
                </button>
              </div>
            </div>
          </form>

          <section className={`${styles.card} ${styles.securityCard}`}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionTag}>账号说明</p>
                <h2 className={styles.sectionTitle}>当前能力边界</h2>
              </div>
            </header>

            <div className={styles.securityList}>
              <div className={styles.securityRow}>
                <div className={styles.securityCopy}>
                  <strong>绑定手机号</strong>
                </div>
                <div className={styles.securityMeta}>
                  <span className={phoneBound ? `${styles.badge} ${styles.badgeReady}` : `${styles.badge} ${styles.badgePending}`}>{phoneBound ? '已绑定' : '未绑定'}</span>
                  <em>{maskedPhone}</em>
                </div>
              </div>

              <div className={styles.securityRow}>
                <div className={styles.securityCopy}>
                  <strong>实名认证</strong>
                </div>
                <div className={styles.securityMeta}>
                  <span className={`${styles.badge} ${styles.badgePending}`}>待接入</span>
                </div>
              </div>

              <div className={styles.securityRow}>
                <div className={styles.securityCopy}>
                  <strong>账号注销</strong>
                </div>
                <div className={styles.securityMeta}>
                  <span className={`${styles.badge} ${styles.badgeMuted}`}>未开放</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
