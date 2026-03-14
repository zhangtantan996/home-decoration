import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import companyLogo from '../assets/company-logo.png';
import { useSessionStore } from '../modules/session/sessionStore';
import { loginByCode, sendLoginCode } from '../services/auth';
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

  const redirect = useMemo(() => searchParams.get('redirect') || '/', [searchParams]);
  const safeRedirect = useMemo(() => (redirect.startsWith('/') ? redirect : '/'), [redirect]);
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
      setStatusTone('success');
      setStatusMessage(result.debugCode ? `验证码已发送，开发环境验证码：${result.debugCode}` : `验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}`);
      startCountdown();
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(error instanceof Error ? error.message : '获取验证码失败，请稍后重试');
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
      setStatusMessage(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className={styles.viewport}>
      <section className={`${styles.heroPanel} ${styles.heroA}`}>
        <div className={styles.scene}>
          <div className={styles.archOuter} />
          <div className={styles.archInner} />
          <div className={styles.glow} />
          <div className={`${styles.lineH} ${styles.lineTop}`} />
          <div className={`${styles.lineH} ${styles.lineBottom}`} />
          <div className={`${styles.pillar} ${styles.pillarLeft}`} />
          <div className={`${styles.pillar} ${styles.pillarRight}`} />
          <div className={styles.chandelier} />
        </div>

        <div className={styles.brandLockup}>
          <img alt="禾泽云公司 Logo" className={styles.brandLogo} src={companyLogo} />
          <div>
            <strong>禾泽云科技</strong>
            <span>家装管家</span>
          </div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroTag}>
            <span className={styles.heroTagDot} />
            平台已服务 2,400+ 家庭
          </div>
          <h1 className={styles.heroTitle}>
            让每一次装修
            <br />
            都<em>清楚可控</em>
          </h1>
          <p className={styles.heroSub}>从找服务商、确认报价到跟进施工，一个工作台帮你把装修过程理清楚。</p>
          <dl className={styles.heroStats}>
            <div>
              <dt>850+</dt>
              <dd>认证服务商</dd>
            </div>
            <div>
              <dt>98.6%</dt>
              <dd>按时交付</dd>
            </div>
            <div>
              <dt>4.9</dt>
              <dd>用户评分</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={`${styles.loginPanel} ${styles.formR1}`}>
        <div className={styles.formHeader}>
          <p className={styles.fhWelcome}>欢迎使用</p>
          <h2 className={styles.fhTitle}>
            登录家装管家
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
            <div className={`${styles.inputWrap} ${phoneError ? styles.error : ''}`}>
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
            {phoneError ? <p className={styles.fieldErrorMsg}>{phoneError}</p> : null}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="login-code">短信验证码</label>
            <div className={`${styles.inputWrap} ${codeError ? styles.error : ''}`}>
              <span className={styles.inputIcon}><LockIcon /></span>
              <input
                autoComplete="one-time-code"
                id="login-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => handleCodeChange(event.target.value)}
                placeholder="6 位数字验证码"
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
            {codeError ? <p className={styles.fieldErrorMsg}>{codeError}</p> : null}
          </div>

          {statusMessage ? (
            <div className={`${styles.msg} ${statusTone === 'success' ? styles.success : styles.errorMsg} ${styles.visible}`} role="alert">
              {statusMessage}
            </div>
          ) : null}

          <button className={styles.submitBtn} disabled={!canSubmit} type="submit">
            {loggingIn ? <span className={styles.spinner} /> : '登录'}
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

        <div className={styles.loginFooter}>&copy; 2026 禾泽云科技 · 家装管家</div>
      </section>
    </div>
  );
}
