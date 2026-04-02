import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useSessionStore } from '../../modules/session/sessionStore';
import { sendCode, type SendCodeResponse } from '../../services/auth';
import { requestJson, uploadFile } from '../../services/http';
import { updateProfile } from '../../services/profile';
import {
  changeUserPhone,
  deleteUserAccount,
  getUserSettings,
  getUserVerification,
  updateUserSettings,
  type UserVerificationRecord,
} from '../../services/settings';
import type { SettingsFormVM } from '../../types/viewModels';
import { formatDateTime } from '../../utils/format';
import { getUploadedAssetPath, normalizeStoredAssetPath, toAbsoluteAssetUrl } from '../../utils/asset';
import styles from './SettingsPage.module.scss';

interface RawProfile {
  id: number;
  publicId?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  birthday?: string;
  bio?: string;
  userType?: number;
}

type SettingsTabKey = 'profile' | 'security' | 'notifications';
type SecurityDialogKey = 'phone' | 'verification' | 'delete';

interface FeedbackState {
  tone: 'success' | 'error';
  text: string;
}

interface BirthdayDraft {
  year: string;
  month: string;
  day: string;
}

const defaultSettings: SettingsFormVM = {
  notifySystem: true,
  notifyProject: true,
  notifyPayment: true,
  fontSize: 'medium',
  language: 'zh',
};

const tabItems: Array<{ key: SettingsTabKey; label: string; description: string }> = [
  { key: 'profile', label: '个人信息', description: '头像、昵称、手机号' },
  { key: 'security', label: '账号安全', description: '手机号、实名、注销' },
  { key: 'notifications', label: '消息通知', description: '系统、项目、支付提醒' },
];

function CameraIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 8.5a2.5 2.5 0 0 1 2.5-2.5h1.95c.44 0 .86-.18 1.17-.49l.86-.86c.31-.31.73-.49 1.17-.49h.7c.44 0 .86.18 1.17.49l.86.86c.31.31.73.49 1.17.49h1.95A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="3.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="15" rx="3" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="5" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function maskPhone(phone?: string) {
  if (!phone) {
    return '未绑定';
  }
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function maskIdCard(idCard?: string) {
  if (!idCard) {
    return '待补充';
  }
  if (idCard.length <= 8) {
    return idCard;
  }
  return `${idCard.slice(0, 4)} ********** ${idCard.slice(-4)}`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function isValidPhone(value: string) {
  return /^1\d{10}$/.test(value);
}

function resolveVerificationStatusMeta(status?: number) {
  switch (status) {
    case 1:
      return { label: '已认证', tone: 'success' as const, description: '实名认证已通过，可直接用于业务场景。' };
    case 0:
      return { label: '审核中', tone: 'info' as const, description: '资料已提交，平台审核中。' };
    case 2:
      return { label: '已驳回', tone: 'danger' as const, description: '根据驳回原因修改后可重新提交。' };
    default:
      return { label: '未提交', tone: 'neutral' as const, description: '补齐实名信息后即可提交审核。' };
  }
}

function resolveCodeHint(result: SendCodeResponse) {
  if (result.debugCode) {
    return `开发环境验证码：${result.debugCode}`;
  }
  return '验证码已发送，请留意短信。';
}

function formatBirthdayDisplay(value: string) {
  if (!value) {
    return '未设置生日';
  }
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${year} 年 ${month} 月 ${day} 日`;
}

function resolveBirthdayAge(value: string) {
  if (!value) {
    return '';
  }
  const birthdayDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthdayDate.getTime())) {
    return '';
  }

  const now = new Date();
  let age = now.getFullYear() - birthdayDate.getFullYear();
  const monthDiff = now.getMonth() - birthdayDate.getMonth();
  const dayDiff = now.getDate() - birthdayDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? `${age} 岁` : '';
}

function padBirthdayUnit(value: string) {
  return value.padStart(2, '0');
}

function buildBirthdayValue(draft: BirthdayDraft) {
  if (!draft.year || !draft.month || !draft.day) {
    return '';
  }
  return `${draft.year}-${padBirthdayUnit(draft.month)}-${padBirthdayUnit(draft.day)}`;
}

function getMonthDayCount(year: string, month: string) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeMonth = Number(month) || 1;
  return new Date(safeYear, safeMonth, 0).getDate();
}

function createBirthdayDraft(value: string): BirthdayDraft {
  if (!value) {
    return {
      year: '1995',
      month: '1',
      day: '1',
    };
  }

  const [year = '1995', month = '1', day = '1'] = value.split('-');
  return {
    year,
    month: String(Number(month) || 1),
    day: String(Number(day) || 1),
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

function resolveTab(value: string | null): SettingsTabKey {
  return value === 'security' || value === 'notifications' || value === 'profile' ? value : 'profile';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const birthdayYearListRef = useRef<HTMLDivElement>(null);
  const birthdayMonthListRef = useRef<HTMLDivElement>(null);
  const birthdayDayListRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RawProfile | null>(null);
  const [settings, setSettings] = useState<SettingsFormVM>(defaultSettings);
  const [initialSettings, setInitialSettings] = useState<SettingsFormVM>(defaultSettings);
  const [verification, setVerification] = useState<UserVerificationRecord | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [birthday, setBirthday] = useState('');
  const [bio, setBio] = useState('');
  const [birthdayDraft, setBirthdayDraft] = useState<BirthdayDraft>(createBirthdayDraft(''));
  const [initialNickname, setInitialNickname] = useState('');
  const [initialAvatar, setInitialAvatar] = useState('');
  const [initialBirthday, setInitialBirthday] = useState('');
  const [initialBio, setInitialBio] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [changingPhone, setChangingPhone] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [securityDialog, setSecurityDialog] = useState<SecurityDialogKey | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<FeedbackState | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<FeedbackState | null>(null);
  const [phoneFeedback, setPhoneFeedback] = useState<FeedbackState | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<FeedbackState | null>(null);
  const [phoneCodeHint, setPhoneCodeHint] = useState<string | null>(null);
  const [deleteCodeHint, setDeleteCodeHint] = useState<string | null>(null);

  const activeTab = resolveTab(searchParams.get('tab'));

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileData, settingsData, verificationData] = await Promise.all([
        requestJson<RawProfile>('/user/profile'),
        getUserSettings(),
        getUserVerification(),
      ]);
      setProfile(profileData);
      setNickname(profileData.nickname || '');
      setAvatar(normalizeStoredAssetPath(profileData.avatar || ''));
      setBirthday(profileData.birthday || '');
      setBirthdayDraft(createBirthdayDraft(profileData.birthday || ''));
      setBio(profileData.bio || '');
      setInitialNickname(profileData.nickname || '');
      setInitialAvatar(normalizeStoredAssetPath(profileData.avatar || ''));
      setInitialBirthday(profileData.birthday || '');
      setInitialBio(profileData.bio || '');
      setSettings(settingsData);
      setInitialSettings(settingsData);
      setVerification(verificationData);
      syncSessionUser(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账户设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const displayName = nickname.trim() || '未设置昵称';
  const avatarFallback = (displayName.slice(0, 1) || '我').toUpperCase();
  const phoneText = maskPhone(profile?.phone);
  const birthdayDisplay = formatBirthdayDisplay(birthday);
  const birthdayAge = resolveBirthdayAge(birthday);
  const birthdayPreview = formatBirthdayDisplay(buildBirthdayValue(birthdayDraft));
  const birthdayPreviewAge = resolveBirthdayAge(buildBirthdayValue(birthdayDraft));
  const profileDirty =
    nickname.trim() !== initialNickname.trim() ||
    avatar !== initialAvatar ||
    birthday !== initialBirthday ||
    bio.trim() !== initialBio.trim();
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);
  const verificationStatus = resolveVerificationStatusMeta(verification?.status);
  const verificationTimestamp = formatDateTime(verification?.verifiedAt || verification?.updatedAt || verification?.createdAt);
  const verificationImages = [verification?.idFrontImage, verification?.idBackImage].filter(Boolean);
  const phoneSubmitDisabled = changingPhone || !isValidPhone(phoneDraft) || !phoneCode.trim();
  const deleteSubmitDisabled = deletingAccount || !deleteCode.trim();
  const currentYear = new Date().getFullYear();
  const birthdayYearOptions = Array.from({ length: currentYear - 1940 + 1 }, (_, index) => String(currentYear - index));
  const birthdayMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const birthdayDayOptions = Array.from({ length: getMonthDayCount(birthdayDraft.year, birthdayDraft.month) }, (_, index) => String(index + 1));
  const verificationNote = verification?.message || '网页端暂不支持提交或修改实名认证，请前往小程序或 App 处理。';

  const notificationItems = [
    {
      key: 'notifySystem' as const,
      label: '系统通知',
      hint: '平台公告与安全提醒',
    },
    {
      key: 'notifyProject' as const,
      label: '项目提醒',
      hint: '进度更新、延期、验收提醒',
    },
    {
      key: 'notifyPayment' as const,
      label: '支付提醒',
      hint: '待付款与支付结果通知',
    },
  ];

  const verificationSummaryRows = useMemo(
    () => [
      { label: '认证状态', value: verificationStatus.label },
      { label: '真实姓名', value: verification?.realName || '待提交' },
      { label: '证件号码', value: maskIdCard(verification?.idCard) },
      { label: verification?.status === 1 ? '认证时间' : '最近更新', value: verificationTimestamp || '待补充' },
    ],
    [verification?.idCard, verification?.realName, verification?.status, verificationStatus.label, verificationTimestamp],
  );

  const securityCards = useMemo(
    () => [
      {
        key: 'phone' as const,
        title: '修改手机号',
        value: phoneText,
        hint: '短信验证码校验后可换绑手机号',
        actionText: '去修改',
        toneClass: styles.badgeInfo,
        badgeText: '已启用',
      },
      {
        key: 'verification' as const,
        title: '实名认证',
        value: verificationStatus.label,
        hint: '网页端仅支持查看认证状态与资料摘要',
        actionText: '查看状态',
        toneClass: styles[`badge${verificationStatus.tone.charAt(0).toUpperCase()}${verificationStatus.tone.slice(1)}`],
        badgeText: verificationStatus.label,
      },
      {
        key: 'delete' as const,
        title: '账号注销',
        value: '高风险操作',
        hint: '需短信验证码二次确认，确认后不可撤销',
        actionText: '申请注销',
        toneClass: styles.badgeDanger,
        badgeText: '谨慎操作',
      },
    ],
    [phoneText, verificationStatus.label, verificationStatus.tone],
  );

  const handleTabChange = (key: SettingsTabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (!birthdayPickerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBirthdayPickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [birthdayPickerOpen]);

  useEffect(() => {
    if (!birthdayPickerOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      [birthdayYearListRef.current, birthdayMonthListRef.current, birthdayDayListRef.current].forEach((container) => {
        const activeButton = container?.querySelector<HTMLButtonElement>('[data-selected="true"]');
        activeButton?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [birthdayDraft.day, birthdayDraft.month, birthdayDraft.year, birthdayPickerOpen]);

  useEffect(() => {
    if (!securityDialog) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingAccount) {
        setSecurityDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [deletingAccount, securityDialog]);

  const openBirthdayPicker = () => {
    setBirthdayDraft(createBirthdayDraft(birthday));
    setBirthdayPickerOpen(true);
  };

  const openSecurityDialog = (key: SecurityDialogKey) => {
    if (key === 'phone') {
      setPhoneDraft('');
      setPhoneCode('');
      setPhoneCodeHint(null);
      setPhoneFeedback(null);
    }
    if (key === 'delete') {
      setDeleteCode('');
      setDeleteCodeHint(null);
      setDeleteFeedback(null);
    }
    setSecurityDialog(key);
  };

  const closeSecurityDialog = () => {
    if (deletingAccount) {
      return;
    }
    setSecurityDialog(null);
  };

  const handleBirthdayDraftChange = (field: keyof BirthdayDraft, value: string) => {
    setBirthdayDraft((current) => {
      const next = { ...current, [field]: value };
      const maxDay = getMonthDayCount(next.year, next.month);
      if (Number(next.day) > maxDay) {
        next.day = String(maxDay);
      }
      return next;
    });
  };

  const applyBirthdayDraft = () => {
    setBirthday(buildBirthdayValue(birthdayDraft));
    setBirthdayPickerOpen(false);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ tone: 'error', text: '请选择 JPG、PNG、WEBP 等图片文件。' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setProfileFeedback({ tone: 'error', text: '头像大小请控制在 10MB 以内。' });
      return;
    }

    try {
      setUploadingAvatar(true);
      setProfileFeedback(null);
      const uploaded = await uploadFile('/upload', file);
      setAvatar(getUploadedAssetPath(uploaded, avatar));
      setProfileFeedback({ tone: 'success', text: '头像已上传，记得保存。' });
    } catch (err) {
      setProfileFeedback({ tone: 'error', text: err instanceof Error ? err.message : '头像上传失败，请稍后重试。' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileSave = async () => {
    if (!profile || savingProfile || uploadingAvatar || !profileDirty) {
      return;
    }

    try {
      setSavingProfile(true);
      setProfileFeedback(null);
      const payload = {
        nickname: nickname.trim(),
        avatar,
        birthday,
        bio: bio.trim(),
      };
      await updateProfile(payload);
      const nextProfile: RawProfile = {
        ...profile,
        nickname: payload.nickname,
        avatar: toAbsoluteAssetUrl(payload.avatar),
        birthday: payload.birthday,
        bio: payload.bio,
      };
      setProfile(nextProfile);
      setInitialNickname(payload.nickname);
      setInitialAvatar(payload.avatar);
      setInitialBirthday(payload.birthday);
      setInitialBio(payload.bio);
      syncSessionUser(nextProfile);
      setProfileFeedback({ tone: 'success', text: '个人信息已保存。' });
    } catch (err) {
      setProfileFeedback({ tone: 'error', text: err instanceof Error ? err.message : '保存失败，请稍后重试。' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSettingsSave = async () => {
    if (savingSettings || !settingsDirty) {
      return;
    }

    try {
      setSavingSettings(true);
      setSettingsFeedback(null);
      await updateUserSettings(settings);
      setInitialSettings(settings);
      setSettingsFeedback({ tone: 'success', text: '通知设置已保存。' });
    } catch (err) {
      setSettingsFeedback({ tone: 'error', text: err instanceof Error ? err.message : '保存失败，请稍后重试。' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendPhoneCode = async () => {
    const nextPhone = normalizePhone(phoneDraft);
    setPhoneDraft(nextPhone);

    if (!isValidPhone(nextPhone)) {
      setPhoneFeedback({ tone: 'error', text: '请输入正确的 11 位手机号。' });
      return;
    }

    if (nextPhone === normalizePhone(profile?.phone || '')) {
      setPhoneFeedback({ tone: 'error', text: '新手机号不能与当前手机号相同。' });
      return;
    }

    try {
      setSendingPhoneCode(true);
      setPhoneFeedback(null);
      const result = await sendCode({ phone: nextPhone, purpose: 'change_phone' });
      setPhoneCodeHint(resolveCodeHint(result));
      setPhoneFeedback({ tone: 'success', text: '验证码已发送，请填写后提交换绑。' });
    } catch (err) {
      setPhoneFeedback({ tone: 'error', text: err instanceof Error ? err.message : '验证码发送失败，请稍后重试。' });
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const handleChangePhone = async () => {
    if (!profile || phoneSubmitDisabled) {
      return;
    }

    const nextPhone = normalizePhone(phoneDraft);
    if (!isValidPhone(nextPhone)) {
      setPhoneFeedback({ tone: 'error', text: '请输入正确的 11 位手机号。' });
      return;
    }

    try {
      setChangingPhone(true);
      setPhoneFeedback(null);
      await changeUserPhone({ newPhone: nextPhone, code: phoneCode.trim() });
      const nextProfile: RawProfile = { ...profile, phone: nextPhone };
      setProfile(nextProfile);
      syncSessionUser(nextProfile);
      setPhoneDraft('');
      setPhoneCode('');
      setPhoneCodeHint(null);
      setPhoneFeedback({ tone: 'success', text: '手机号已更新。' });
    } catch (err) {
      setPhoneFeedback({ tone: 'error', text: err instanceof Error ? err.message : '手机号修改失败，请稍后重试。' });
    } finally {
      setChangingPhone(false);
    }
  };

  const handleSendDeleteCode = async () => {
    if (!profile?.phone) {
      setDeleteFeedback({ tone: 'error', text: '当前账号未绑定手机号，暂无法执行注销。' });
      return;
    }

    try {
      setSendingDeleteCode(true);
      setDeleteFeedback(null);
      const result = await sendCode({ phone: profile.phone, purpose: 'delete_account' });
      setDeleteCodeHint(resolveCodeHint(result));
      setDeleteFeedback({ tone: 'success', text: '注销验证码已发送，请谨慎操作。' });
    } catch (err) {
      setDeleteFeedback({ tone: 'error', text: err instanceof Error ? err.message : '验证码发送失败，请稍后重试。' });
    } finally {
      setSendingDeleteCode(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteSubmitDisabled) {
      return;
    }

    try {
      setDeletingAccount(true);
      setDeleteFeedback(null);
      await deleteUserAccount({ code: deleteCode.trim() });
      setDeleteDialogOpen(false);
      clearSession();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteFeedback({ tone: 'error', text: err instanceof Error ? err.message : '账号注销失败，请稍后重试。' });
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return <LoadingBlock title="加载账户设置" />;
  }

  if (error) {
    return <ErrorBlock description={error} onRetry={() => void loadData()} />;
  }

  if (!profile) {
    return <EmptyBlock description="" title="暂无账户信息" />;
  }

  return (
    <>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>设置</p>
            <h2>账户设置</h2>
          </div>
        </header>

        <section className={styles.tabRail}>
          {tabItems.map((item) => (
            <button
              className={`${styles.tabCard} ${activeTab === item.key ? styles.tabCardActive : ''}`.trim()}
              key={item.key}
              onClick={() => handleTabChange(item.key)}
              type="button"
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </section>

        {activeTab === 'profile' ? (
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h3>个人信息</h3>
                <p>头像、昵称、生日、简介均实时写入用户资料</p>
              </div>
            </header>

            <div className={styles.profileCard}>
              <div className={styles.avatarArea}>
                <div className={styles.avatarShell}>
                  {avatar ? <img alt={`${displayName}头像`} className={styles.avatarImage} src={toAbsoluteAssetUrl(avatar)} /> : <div className={styles.avatarFallback}>{avatarFallback}</div>}
                </div>
                <input accept="image/png,image/jpeg,image/webp,image/gif" className={styles.hiddenInput} onChange={handleAvatarChange} ref={fileInputRef} type="file" />
                <button className={styles.secondaryButton} onClick={handleAvatarPick} type="button">
                  <CameraIcon />
                  {uploadingAvatar ? '头像上传中...' : '更换头像'}
                </button>
              </div>

              <div className={styles.formArea}>
                <label className={styles.fieldBlock} htmlFor="settings-nickname">
                  <span>昵称</span>
                  <input id="settings-nickname" maxLength={20} onChange={(event) => setNickname(event.target.value.slice(0, 20))} placeholder="请输入昵称" type="text" value={nickname} />
                </label>

                <div className={styles.infoList}>
                  <div className={styles.infoRow}>
                    <span>手机号</span>
                    <strong>{phoneText}</strong>
                  </div>
                </div>

                <div className={styles.birthdayBlock}>
                  <div className={styles.birthdayHead}>
                    <span>生日</span>
                  </div>

                  <button
                    className={styles.birthdayCard}
                    onClick={openBirthdayPicker}
                    type="button"
                  >
                    <div className={styles.birthdayIcon}>
                      <CalendarIcon />
                    </div>
                    <div className={styles.birthdayCopy}>
                      <strong>{birthdayDisplay}</strong>
                      <span>{birthday ? (birthdayAge ? `已选择 · ${birthdayAge}` : '已选择生日') : '点击选择出生日期'}</span>
                    </div>
                    <span className={styles.birthdayAction}>{birthday ? '重新选择' : '选择日期'}</span>
                  </button>
                </div>

                <label className={styles.fieldBlock} htmlFor="settings-bio">
                  <span>个人简介</span>
                  <textarea
                    id="settings-bio"
                    maxLength={200}
                    onChange={(event) => setBio(event.target.value.slice(0, 200))}
                    placeholder="介绍一下你的装修偏好、生活习惯或关注重点"
                    rows={4}
                    value={bio}
                  />
                </label>

                {profileFeedback ? <div className={profileFeedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError}>{profileFeedback.text}</div> : null}

                <div className={styles.panelActions}>
                  <button className={styles.primaryButton} disabled={!profileDirty || savingProfile || uploadingAvatar} onClick={handleProfileSave} type="button">
                    {savingProfile ? '保存中...' : '保存个人信息'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'security' ? (
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h3>账号安全</h3>
                <p>按需进入对应操作，避免页面默认展开过多内容</p>
              </div>
            </header>

            <div className={styles.securityGrid}>
              {securityCards.map((item) => (
                <article
                  className={`${styles.securityActionCard} ${item.key === 'delete' ? styles.securityActionCardDanger : ''}`.trim()}
                  key={item.key}
                >
                  <div className={styles.securityActionTop}>
                    <div className={styles.securityActionMeta}>
                      <span>{item.title}</span>
                      <strong>{item.value}</strong>
                      <p>{item.hint}</p>
                    </div>
                    <span className={`${styles.badge} ${item.toneClass}`.trim()}>{item.badgeText}</span>
                  </div>

                  <div className={styles.securityActionFooter}>
                    <button
                      className={item.key === 'delete' ? styles.dangerGhostButton : styles.secondaryButton}
                      onClick={() => openSecurityDialog(item.key)}
                      type="button"
                    >
                      {item.actionText}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'notifications' ? (
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h3>消息通知</h3>
                <p>系统、项目、支付三类提醒均可真实保存</p>
              </div>
            </header>

            <div className={styles.rowGroup}>
              {notificationItems.map((item) => (
                <label className={styles.settingRow} key={item.key}>
                  <div className={styles.rowCopy}>
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </div>
                  <span className={styles.switchWrap}>
                    <input
                      checked={settings[item.key]}
                      onChange={(event) => {
                        setSettings((current) => ({ ...current, [item.key]: event.target.checked }));
                        if (settingsFeedback) {
                          setSettingsFeedback(null);
                        }
                      }}
                      type="checkbox"
                    />
                  </span>
                </label>
              ))}
            </div>

            {settingsFeedback ? <div className={settingsFeedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError}>{settingsFeedback.text}</div> : null}

            <div className={styles.panelActions}>
              <button className={styles.primaryButton} disabled={!settingsDirty || savingSettings} onClick={handleSettingsSave} type="button">
                {savingSettings ? '保存中...' : '保存通知设置'}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {securityDialog ? (
        <div
          aria-hidden="true"
          className={styles.actionModalBackdrop}
          onClick={closeSecurityDialog}
          role="presentation"
        >
          <div
            aria-modal="true"
            className={styles.actionModalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.actionModalHead}>
              <div>
                <p className={styles.actionModalKicker}>账号安全</p>
                <h3>
                  {securityDialog === 'phone'
                    ? '修改手机号'
                    : securityDialog === 'verification'
                      ? '实名认证'
                      : '账号注销'}
                </h3>
              </div>
              <button className={styles.textButton} onClick={closeSecurityDialog} type="button">
                关闭
              </button>
            </div>

            {securityDialog === 'phone' ? (
              <div className={styles.formArea}>
                <div className={styles.infoRow}>
                  <span>当前手机号</span>
                  <strong>{phoneText}</strong>
                </div>

                <div className={styles.splitFields}>
                  <label className={styles.fieldBlock} htmlFor="settings-new-phone-modal">
                    <span>新手机号</span>
                    <input
                      id="settings-new-phone-modal"
                      inputMode="numeric"
                      maxLength={11}
                      onChange={(event) => {
                        setPhoneDraft(normalizePhone(event.target.value));
                        if (phoneFeedback) {
                          setPhoneFeedback(null);
                        }
                      }}
                      placeholder="请输入新的 11 位手机号"
                      type="text"
                      value={phoneDraft}
                    />
                  </label>
                  <button className={styles.secondaryButton} disabled={sendingPhoneCode || changingPhone} onClick={() => void handleSendPhoneCode()} type="button">
                    {sendingPhoneCode ? '发送中...' : '发送验证码'}
                  </button>
                </div>

                <label className={styles.fieldBlock} htmlFor="settings-phone-code-modal">
                  <span>短信验证码</span>
                  <input
                    id="settings-phone-code-modal"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入验证码"
                    type="text"
                    value={phoneCode}
                  />
                </label>

                {phoneCodeHint ? <div className={styles.helperText}>{phoneCodeHint}</div> : null}
                {phoneFeedback ? <div className={phoneFeedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError}>{phoneFeedback.text}</div> : null}

                <div className={styles.panelActions}>
                  <button className={styles.primaryButton} disabled={phoneSubmitDisabled} onClick={() => void handleChangePhone()} type="button">
                    {changingPhone ? '提交中...' : '确认修改手机号'}
                  </button>
                </div>
              </div>
            ) : null}

            {securityDialog === 'verification' ? (
              <div className={styles.formArea}>
                <div className={styles.readonlyNotice}>
                  <span className={`${styles.badge} ${styles[`badge${verificationStatus.tone.charAt(0).toUpperCase()}${verificationStatus.tone.slice(1)}`]}`.trim()}>
                    {verificationStatus.label}
                  </span>
                  <p>{verificationNote}</p>
                </div>

                <div className={styles.metricsGrid}>
                  {verificationSummaryRows.map((item) => (
                    <div className={styles.metricCard} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>

                {verification?.status === 2 && verification.rejectReason ? <div className={styles.feedbackError}>驳回原因：{verification.rejectReason}</div> : null}

                {verificationImages.length ? (
                  <div className={styles.uploadGrid}>
                    {verificationImages.map((image, index) => (
                      <div className={styles.uploadCardStatic} key={`${image}-${index}`}>
                        <img alt={index === 0 ? '身份证正面' : '身份证反面'} className={styles.uploadPreview} src={image} />
                        <em>{index === 0 ? '身份证正面' : '身份证反面'}</em>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.helperText}>当前暂无实名图片资料。</div>
                )}
              </div>
            ) : null}

            {securityDialog === 'delete' ? (
              <div className={styles.formArea}>
                <div className={styles.infoRow}>
                  <span>验证手机号</span>
                  <strong>{phoneText}</strong>
                </div>

                <label className={styles.fieldBlock} htmlFor="settings-delete-code-modal">
                  <span>注销验证码</span>
                  <input
                    id="settings-delete-code-modal"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入短信验证码"
                    type="text"
                    value={deleteCode}
                  />
                </label>

                <div className={styles.inlineActionRow}>
                  <button className={styles.secondaryButton} disabled={sendingDeleteCode || deletingAccount || !profile.phone} onClick={() => void handleSendDeleteCode()} type="button">
                    {sendingDeleteCode ? '发送中...' : '发送验证码'}
                  </button>
                </div>

                {deleteCodeHint ? <div className={styles.helperText}>{deleteCodeHint}</div> : null}
                {deleteFeedback ? <div className={deleteFeedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError}>{deleteFeedback.text}</div> : null}

                <div className={styles.panelActions}>
                  <button
                    className={styles.dangerButton}
                    disabled={!deleteCode.trim() || deletingAccount}
                    onClick={() => {
                      setSecurityDialog(null);
                      setDeleteDialogOpen(true);
                    }}
                    type="button"
                  >
                    申请注销账号
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        cancelText="取消"
        confirmDisabled={deletingAccount}
        confirmText={deletingAccount ? '注销中...' : '确认注销'}
        description="注销后将退出当前账号，相关登录态会被清除。该操作不可撤销。"
        error={deleteFeedback?.tone === 'error' ? deleteFeedback.text : null}
        kicker="账号操作"
        notice="请确认验证码无误后再执行。若只是暂时停用，建议保留账号。"
        noticeTitle="注销提醒"
        onCancel={() => {
          if (!deletingAccount) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDeleteAccount();
        }}
        open={deleteDialogOpen}
        title="确认注销当前账号"
      />

      {birthdayPickerOpen ? (
        <div
          aria-hidden="true"
          className={styles.birthPickerBackdrop}
          onClick={() => setBirthdayPickerOpen(false)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className={styles.birthPickerSheet}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.birthPickerHandle} />
            <div className={styles.birthPickerHeader}>
              <div>
                <p>生日设置</p>
                <h3>选择你的出生日期</h3>
              </div>
            </div>

            <div className={styles.birthPreviewCard}>
              <span>当前预览</span>
              <strong>{birthdayPreview}</strong>
              <em>{birthdayPreviewAge || '用于完善个人资料展示'}</em>
            </div>

            <div className={styles.birthPickerGrid}>
              <section className={styles.birthColumn}>
                <span>年份</span>
                <div className={styles.birthColumnList} ref={birthdayYearListRef}>
                  {birthdayYearOptions.map((year) => {
                    const active = birthdayDraft.year === year;
                    return (
                      <button
                        className={`${styles.birthOption} ${active ? styles.birthOptionActive : ''}`.trim()}
                        data-selected={active}
                        key={year}
                        onClick={() => handleBirthdayDraftChange('year', year)}
                        type="button"
                      >
                        {year} 年
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.birthColumn}>
                <span>月份</span>
                <div className={styles.birthColumnList} ref={birthdayMonthListRef}>
                  {birthdayMonthOptions.map((month) => {
                    const active = birthdayDraft.month === month;
                    return (
                      <button
                        className={`${styles.birthOption} ${active ? styles.birthOptionActive : ''}`.trim()}
                        data-selected={active}
                        key={month}
                        onClick={() => handleBirthdayDraftChange('month', month)}
                        type="button"
                      >
                        {padBirthdayUnit(month)} 月
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.birthColumn}>
                <span>日期</span>
                <div className={styles.birthColumnList} ref={birthdayDayListRef}>
                  {birthdayDayOptions.map((day) => {
                    const active = birthdayDraft.day === day;
                    return (
                      <button
                        className={`${styles.birthOption} ${active ? styles.birthOptionActive : ''}`.trim()}
                        data-selected={active}
                        key={day}
                        onClick={() => handleBirthdayDraftChange('day', day)}
                        type="button"
                      >
                        {padBirthdayUnit(day)} 日
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className={styles.birthPickerActions}>
              <button className={styles.secondaryButton} onClick={() => setBirthdayPickerOpen(false)} type="button">
                取消
              </button>
              <button className={styles.primaryButton} onClick={applyBirthdayDraft} type="button">
                确认日期
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
