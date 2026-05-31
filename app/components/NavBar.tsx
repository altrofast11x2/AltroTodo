'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, listItems, listCategories } from '@/lib/todo';
import { ddayInfo } from '@/lib/dates';
import { getCategory } from '@/lib/categories';
import { Icons as I } from './Icons';

const NAV = [
  { href: '/',           label: '내 할일', icon: I.List },
  { href: '/stats',      label: '통계',    icon: I.Chart },
  { href: '/categories', label: '카테고리', icon: I.Tag },
];

// Altro 패밀리 다른 앱 (현재 앱 AltroTodo 제외)
const OTHER_APPS = [
  { label: 'AltroBoard', desc: '커뮤니티 · 게시판', url: 'https://altroboard.vercel.app/' },
  { label: 'AltroShop',  desc: '중고거래 쇼핑몰',    url: 'https://altroshop.vercel.app/' },
];

export default function NavBar() {
  const [user, setUser] = useState<any>(null);
  const [drawer, setDrawer] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const raw = localStorage.getItem('altrotodo_user');
        if (!raw) { setUser(null); setItems([]); setCats([]); return; }
        const s = JSON.parse(raw);
        setUser(s);
        const [its, cs] = await Promise.all([listItems(s.id), listCategories(s.id)]);
        setItems(its);
        setCats(cs);
      } catch { setUser(null); }
    };
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener('storage', onRefresh);
    window.addEventListener('altrotodo:refresh', onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener('altrotodo:refresh', onRefresh);
    };
  }, [pathname]);

  useEffect(() => { setDrawer(false); setNotifOpen(false); }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  // 벨 바깥 클릭 시 닫기
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  const logout = () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    localStorage.removeItem('altrotodo_user');
    setUser(null);
    window.dispatchEvent(new Event('altrotodo:refresh'));
    router.push('/');
  };

  // 마감 임박/지난 알림 목록 (미완료 + 마감일 있음 + 오늘/임박/지남)
  const alerts = items
    .filter(it => !it.done && it.dueDate)
    .map(it => ({ ...it, dd: ddayInfo(it.dueDate) }))
    .filter(it => ['overdue', 'today', 'soon'].includes(it.dd.status))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const alertCount = alerts.length;

  return (
    <>
      <header className="bj-header">
        <div className="bj-header-inner">
          <Link href="/" className="bj-logo">Altro<span>Todo</span></Link>

          {user && (
            <nav className="bj-header-right" style={{ marginLeft: 8 }}>
              {NAV.map(n => {
                const Ico = n.icon;
                const active = pathname === n.href;
                return (
                  <Link key={n.href} href={n.href} className={`bj-nav-link ${active ? 'active' : ''}`}>
                    <Ico width={17} height={17} /><span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="bj-header-spacer" />

          <div className="bj-header-right">
            {user ? (
              <>
                {/* 알림 벨 */}
                <div ref={bellRef} style={{ position: 'relative' }}>
                  <button className="bj-bell" onClick={() => setNotifOpen(o => !o)} aria-label="알림">
                    <I.Bell width={20} height={20} />
                    {alertCount > 0 && <span className="bj-bell-dot">{alertCount}</span>}
                  </button>
                  {notifOpen && (
                    <div className="bj-notif">
                      <div className="bj-notif-head">
                        <span>마감 알림</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{alertCount}건</span>
                      </div>
                      <div className="bj-notif-list">
                        {alerts.length === 0 ? (
                          <div className="bj-notif-empty">임박하거나 지난 할일이 없어요.<br />여유롭네요!</div>
                        ) : alerts.map(a => {
                          const cat = getCategory(a.categoryId, cats);
                          const overdue = a.dd.status === 'overdue';
                          return (
                            <Link key={a.id} href="/" className="bj-notif-item" onClick={() => setNotifOpen(false)}>
                              <span className={`bj-notif-ico ${overdue ? 'overdue' : 'soon'}`}>
                                {overdue ? <I.Clock width={18} height={18} /> : <I.Bell width={18} height={18} />}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span className="bj-notif-title">{a.title}</span>
                                <span className="bj-notif-meta">
                                  <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                                  {' · '}{overdue ? `${a.dd.label}` : a.dd.label}
                                </span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => setDrawer(true)} className="bj-avatar" aria-label="메뉴">
                  {(user.name || '?')[0].toUpperCase()}
                </button>
              </>
            ) : (
              <Link href="/login" className="bj-login-btn">로그인 / 회원가입</Link>
            )}
            <button onClick={() => setDrawer(true)} className="bj-hamburger" aria-label="메뉴">
              <I.Menu width={22} height={22} />
            </button>
          </div>
        </div>
      </header>

      {/* 햄버거 드로어 */}
      {drawer && (
        <>
          <div className="bj-drawer-overlay" onClick={() => setDrawer(false)} />
          <aside className="bj-drawer">
            <div className="bj-drawer-head">
              <div className="bj-drawer-head-title">메뉴</div>
              <button className="bj-drawer-close" onClick={() => setDrawer(false)} aria-label="닫기">
                <I.X width={20} height={20} />
              </button>
            </div>

            {user ? (
              <div className="bj-drawer-user">
                <div className="bj-avatar">{(user.name || '?')[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bj-drawer-user-name">{user.name}</div>
                  <div className="bj-drawer-user-email">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="bj-drawer-cta">
                <Link href="/login" className="bj-drawer-coin-btn">
                  <I.Login width={14} height={14} /> 로그인 / 회원가입
                </Link>
                <div className="bj-drawer-cta-note">
                  AltroBoard 계정으로도 로그인할 수 있어요<br />
                  내 할일은 <strong>나에게만</strong> 보입니다
                </div>
              </div>
            )}

            <nav className="bj-drawer-nav">
              {user && NAV.map(n => {
                const Ico = n.icon;
                return (
                  <Link key={n.href} href={n.href} className={`bj-drawer-item ${pathname === n.href ? 'active' : ''}`}>
                    <span className="bj-drawer-item-icon"><Ico width={20} height={20} /></span>
                    {n.label}
                  </Link>
                );
              })}
              {user && (
                <Link href="/settings" className={`bj-drawer-item ${pathname === '/settings' ? 'active' : ''}`}>
                  <span className="bj-drawer-item-icon"><I.Cog width={20} height={20} /></span>
                  설정
                </Link>
              )}
              <div className="bj-drawer-apps">
                <div className="bj-drawer-label">Altro 다른 앱</div>
                {OTHER_APPS.map(a => (
                  <a key={a.label} href={a.url} target="_blank" rel="noopener noreferrer" className="bj-drawer-item">
                    <span className="bj-drawer-item-icon"><I.Apps width={20} height={20} /></span>
                    <span className="bj-drawer-app-text">
                      <span className="bj-drawer-app-name">{a.label}</span>
                      <span className="bj-drawer-app-desc">{a.desc}</span>
                    </span>
                    <span className="bj-drawer-item-ext"><I.Ext width={13} height={13} /></span>
                  </a>
                ))}
              </div>
            </nav>

            {user && (
              <div className="bj-drawer-bottom">
                <button onClick={logout} className="bj-drawer-item bj-drawer-logout">
                  <span className="bj-drawer-item-icon"><I.Logout width={20} height={20} /></span>
                  로그아웃
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
