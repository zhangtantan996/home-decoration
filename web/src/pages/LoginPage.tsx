import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import companyLogo from '../assets/company-logo.png';
import { useSessionStore } from '../modules/session/sessionStore';
import { loginByCode, sendLoginCode } from '../services/auth';
import { toSafeUserFacingText } from '../utils/userFacingText';
import styles from './LoginPage.module.scss';

const phonePattern = /^1\d{10}$/;
const codePattern = /^\d{6}$/;

function PhoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="20" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="14" x="5" y="2" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12" y1="18" y2="18.01" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="11" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9l4-6z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}



function normalizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return '/';
  }
  return value;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useSessionStore((state) => state.setSession);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);

  const safeRedirect = useMemo(() => normalizeRedirectPath(searchParams.get('redirect')), [searchParams]);
  const phoneError = phone.length > 0 && !phonePattern.test(phone) ? '请输入 11 位手机号' : '';
  const codeError = code.length > 0 && !codePattern.test(code) ? '请输入 6 位数字验证码' : '';
  const canSend = phonePattern.test(phone) && !sending && countdown === 0;
  const canSubmit = phonePattern.test(phone) && codePattern.test(code) && agreed && !loggingIn;

  const startCountdown = () => {
    setCountdown(60);
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
    setStatusMessage('');
  };

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 6));
    setStatusMessage('');
  };

  const handleSendCode = async () => {
    if (!phonePattern.test(phone)) {
      setStatusTone('error');
      setStatusMessage('请先输入正确的手机号');
      return;
    }

    setSending(true);
    setStatusMessage('');
    try {
      const result = await sendLoginCode({ phone: phone.trim(), purpose: 'login' });
      if (import.meta.env.DEV && result.debugCode) {
        console.debug(`[DEV] 登录验证码: ${result.debugCode}`);
      }
      setStatusTone('success');
      setStatusMessage(`验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}`);
      startCountdown();
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(toSafeUserFacingText(error instanceof Error ? error.message : '', '获取验证码失败，请稍后重试'));
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!agreed) {
      setStatusTone('error');
      setStatusMessage('请先同意用户协议与隐私政策');
      return;
    }
    if (!phonePattern.test(phone) || !codePattern.test(code)) {
      setStatusTone('error');
      setStatusMessage('请检查手机号或验证码');
      return;
    }

    setLoggingIn(true);
    setStatusMessage('');
    try {
      const result = await loginByCode({ phone: phone.trim(), code: code.trim() });
      setSession({
        accessToken: result.token,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user || { id: 0, phone: phone.trim() },
      });
      navigate(safeRedirect, { replace: true });
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(toSafeUserFacingText(error instanceof Error ? error.message : '', '登录失败，请稍后重试'));
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Animated Background */}
      <div className={styles.bgGradients}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
        <div className={styles.blob4} />
      </div>
      <div className={styles.bgGrid} />

      {/* Top Navigation Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brandLockup}>
            <img alt="禾泽云 Logo" className={styles.brandLogo} src={companyLogo} />
            <div>
              <strong>禾泽云科技</strong>
              <span>数字化装修服务平台</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className={styles.viewport}>
        {/* Left: Hero Panel */}
        <section className={styles.heroPanel}>
          <div className={styles.heroContent}>
            <div className={styles.heroTag}>
              <span className={styles.heroTagDot} />
              全新版上线，体验升级
            </div>
            <h1 className={styles.heroTitle}>
              让每一次装修
              <br />
              都<em>清楚可控</em>
            </h1>
            <p className={styles.heroSub}>从找服务商、确认报价到跟进施工，<br />一个工作台帮你把装修过程理清楚。</p>



            {/* Feature Cards */}
            <div className={styles.heroFeatures}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}><DiamondIcon /></div>
                <div>
                  <dt>严选服务商</dt>
                  <dd>资质认证，放心托付，每位服务商均通过平台审核</dd>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}><CheckCircleIcon /></div>
                <div>
                  <dt>全流程管控</dt>
                  <dd>节点透明，拒绝增项，进度实时跟踪随时查看</dd>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}><ShieldIcon /></div>
                <div>
                  <dt>资金安全</dt>
                  <dd>平台资金担保，满意后才付款，保障您的权益</dd>
                </div>
              </div>
            </div>


          </div>
        </section>

        {/* Right: Login Card */}
        <section className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <div className={styles.formHeader}>
              <p className={styles.fhWelcome}>欢迎使用</p>
              <h2 className={styles.fhTitle}>
                登录禾泽云
                <br />
                <span>开始你的装修旅程</span>
              </h2>
            </div>

            <form
              className={styles.loginForm}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
            >
              <div className={styles.inputGroup}>
                <label htmlFor="login-phone">手机号</label>
                <div className={`${styles.inputWrap} ${phoneError ? styles.error : ''} ${phone ? styles.filled : ''}`}>
                  <span className={styles.inputIcon}><PhoneIcon /></span>
                  <input
                    autoComplete="tel"
                    id="login-phone"
                    inputMode="tel"
                    maxLength={11}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    placeholder="请输入手机号"
                    type="tel"
                    value={phone}
                  />
                </div>
                {phoneError && <p className={styles.fieldErrorMsg}>{phoneError}</p>}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="login-code">短信验证码</label>
                <div className={`${styles.inputWrap} ${codeError ? styles.error : ''} ${code ? styles.filled : ''}`}>
                  <span className={styles.inputIcon}><LockIcon /></span>
                  <input
                    autoComplete="one-time-code"
                    id="login-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    placeholder="6 位数字"
                    type="text"
                    value={code}
                  />
                  <button
                    className={`${styles.inlineBtn} ${countdown > 0 ? styles.counting : ''}`}
                    disabled={!canSend}
                    onClick={() => void handleSendCode()}
                    type="button"
                  >
                    {sending ? <span className={styles.spinner} /> : countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
                {codeError && <p className={styles.fieldErrorMsg}>{codeError}</p>}
              </div>

              {statusMessage && (
                <div className={`${styles.msg} ${statusTone === 'success' ? styles.success : styles.errorMsg} ${styles.visible}`} role="alert">
                  {statusMessage}
                </div>
              )}

              <button className={styles.submitBtn} disabled={!canSubmit} type="submit">
                {loggingIn ? <span className={styles.spinner} /> : '登 录'}
              </button>

              <label className={styles.agreement}>
                <input checked={agreed} onChange={(event) => setAgreed(event.target.checked)} type="checkbox" />
                <span>
                  登录即表示同意
                  <Link to="/legal/user-agreement">《用户协议》</Link>
                  和
                  <Link to="/legal/privacy-policy">《隐私政策》</Link>
                </span>
              </label>
            </form>


            <div className={styles.loginFooter}>&copy; 2026 禾泽云科技</div>
          </div>
        </section>
      </div>
    </div>
  );
}
