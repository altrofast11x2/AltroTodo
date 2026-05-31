'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listItems } from '@/lib/todo';
import { todayStr, diffDays } from '@/lib/dates';
import { Icons as I } from '../components/Icons';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  if (!dark) document.documentElement.removeAttribute('data-theme');
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [browserOn, setBrowserOn] = useState(false);
  const [emailOn, setEmailOn] = useState(false);
  const [lead, setLead] = useState(1);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altrotodo_user');
      setUser(raw ? JSON.parse(raw) : null);
      setTheme((localStorage.getItem('altrotodo_theme') as Theme) || 'light');
      setBrowserOn(localStorage.getItem('altrotodo_browser_notify') === '1');
      setEmailOn(localStorage.getItem('altrotodo_email_notify') === '1');
      setLead(Number(localStorage.getItem('altrotodo_notify_lead') || '1'));
    } catch {}
    setReady(true);
  }, []);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('altrotodo_theme', t);
    applyTheme(t);
  };

  const toggleBrowser = async () => {
    if (!browserOn) {
      if (!('Notification' in window)) { setMsg({ type: 'error', text: '이 브라우저는 알림을 지원하지 않아요.' }); return; }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') { setMsg({ type: 'error', text: '브라우저 알림 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.' }); return; }
      setBrowserOn(true);
      localStorage.setItem('altrotodo_browser_notify', '1');
      setMsg({ type: 'success', text: '브라우저 알림을 켰어요. 마감 임박 시 데스크톱 알림을 받습니다.' });
      try { new Notification('AltroTodo', { body: '알림이 켜졌어요! 마감이 다가오면 알려드릴게요.' }); } catch {}
    } else {
      setBrowserOn(false);
      localStorage.setItem('altrotodo_browser_notify', '0');
      setMsg(null);
    }
  };

  const toggleEmail = () => {
    const next = !emailOn;
    setEmailOn(next);
    localStorage.setItem('altrotodo_email_notify', next ? '1' : '0');
  };

  const changeLead = (n: number) => {
    setLead(n);
    localStorage.setItem('altrotodo_notify_lead', String(n));
  };

  // 마감 임박 메일 발송
  const sendEmail = async () => {
    setMsg(null); setSending(true);
    try {
      const items = await listItems(user.id);
      const today = todayStr();
      const due = items
        .filter(it => !it.done && it.dueDate)
        .map(it => ({ it, d: diffDays(today, it.dueDate) }))
        .filter(({ d }) => d < 0 || (d >= 0 && d <= lead))
        .sort((a, b) => a.d - b.d)
        .map(({ it, d }) => ({
          title: it.title,
          due: it.dueDate,
          status: d < 0 ? `${-d}일 지남` : d === 0 ? '오늘 마감' : `D-${d}`,
        }));

      if (due.length === 0) { setMsg({ type: 'info', text: '마감이 임박했거나 지난 할일이 없어요. 메일을 보낼 항목이 없습니다.' }); setSending(false); return; }

      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name, items: due }),
      });
      const data = await r.json();
      if (data.sent) {
        setMsg({ type: 'success', text: `${user.email} 로 마감 임박 할일 ${data.count}건을 보냈어요.` });
      } else if (data.reason === 'not_configured') {
        setMsg({ type: 'info', text: `이메일 서비스(RESEND_API_KEY)가 설정되지 않아 발송은 생략됐어요. 대상 ${due.length}건은 인앱·브라우저 알림으로 확인할 수 있어요.` });
      } else {
        setMsg({ type: 'error', text: '메일 발송에 실패했어요: ' + (data.error || '알 수 없는 오류') });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: '오류: ' + (e?.message || e) });
    }
    setSending(false);
  };

  if (!ready) return null;
  if (!user) {
    return (
      <main className="td-wrap">
        <div className="td-empty" style={{ paddingTop: 100 }}>
          <div className="td-empty-ico"><I.Cog width={28} height={28} /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>로그인이 필요합니다</div>
          <Link href="/login" className="bj-btn bj-btn-primary">로그인 / 회원가입</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="td-wrap" style={{ maxWidth: 640 }}>
      <Link href="/" className="bj-back-link"><I.Chevron width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> 내 할일</Link>
      <div className="td-page-head">
        <div className="td-page-title">설정</div>
        <div className="td-page-sub">테마와 마감 알림을 설정하세요.</div>
      </div>

      {msg && <div className={`bj-alert bj-alert-${msg.type === 'error' ? 'error' : msg.type === 'success' ? 'success' : 'info'}`}>{msg.text}</div>}

      {/* 테마 */}
      <div className="td-card">
        <h3>테마</h3>
        <div className="td-theme-opts">
          {([['light', '라이트'], ['dark', '다크'], ['system', '시스템']] as [Theme, string][]).map(([v, l]) => (
            <button key={v} className={`td-theme-opt ${theme === v ? 'active' : ''}`} onClick={() => pickTheme(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* 알림 */}
      <div className="td-card">
        <h3>마감 알림</h3>
        <div className="td-toggle-row">
          <div className="td-toggle-text">
            <strong>브라우저 알림</strong>
            <small>마감이 다가오면 데스크톱 알림을 띄웁니다.</small>
          </div>
          <button className={`td-switch ${browserOn ? 'on' : ''}`} onClick={toggleBrowser} aria-label="브라우저 알림 토글" />
        </div>

        <div className="td-toggle-row">
          <div className="td-toggle-text">
            <strong>알림 기준</strong>
            <small>마감 며칠 전부터 임박으로 볼지 정합니다.</small>
          </div>
          <select className="td-mini td-select" value={lead} onChange={e => changeLead(Number(e.target.value))}>
            <option value={0}>당일</option>
            <option value={1}>1일 전</option>
            <option value={2}>2일 전</option>
            <option value={3}>3일 전</option>
          </select>
        </div>

        <div className="td-toggle-row">
          <div className="td-toggle-text">
            <strong>이메일 알림</strong>
            <small>마감 임박 할일을 {user.email} 로 보냅니다.</small>
          </div>
          <button className={`td-switch ${emailOn ? 'on' : ''}`} onClick={toggleEmail} aria-label="이메일 알림 토글" />
        </div>

        {emailOn && (
          <div style={{ marginTop: 14 }}>
            <button className="bj-btn bj-btn-primary bj-btn-sm" onClick={sendEmail} disabled={sending}>
              <I.Bell width={15} height={15} /> {sending ? '발송 중…' : '지금 마감 임박 메일 보내기'}
            </button>
            <div className="bj-notice" style={{ marginTop: 12 }}>
              <strong>참고</strong> 서버에 <code>RESEND_API_KEY</code>가 설정된 경우에만 실제 메일이 발송됩니다.
              설정 전에는 인앱 알림(상단 벨)과 브라우저 알림으로 마감을 확인할 수 있어요.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
