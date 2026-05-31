'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  listItems, listCategories, addItem, toggleItem, deleteItem, updateItem, clearCompleted,
} from '@/lib/todo';
import { allCategories, getCategory, DEFAULT_CATEGORY_ID } from '@/lib/categories';
import { ddayInfo, formatDue, todayStr } from '@/lib/dates';
import { basicStats, streak } from '@/lib/stats';
import { Icons as I } from './components/Icons';

type Filter = 'all' | 'active' | 'done' | 'today' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '진행중' },
  { id: 'today', label: '오늘' },
  { id: 'overdue', label: '지연' },
  { id: 'done', label: '완료' },
];

const PRIOS: Record<string, string> = { high: '높음', normal: '보통', low: '낮음' };

// 완료율 도넛 링
function Ring({ pct }: { pct: number }) {
  const r = 40, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg className="td-ring" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface3)" strokeWidth="11" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="11"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize="23" fontWeight="800" fill="var(--accent)">{pct}%</text>
    </svg>
  );
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>('all');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  // 새 할일 입력
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [catId, setCatId] = useState(DEFAULT_CATEGORY_ID);
  const [prio, setPrio] = useState('normal');
  const [adding, setAdding] = useState(false);

  // 인라인 편집
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altrotodo_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch { setUser(null); }
    setReady(true);
  }, []);

  const load = async (uid: string) => {
    setLoading(true);
    const [its, cs] = await Promise.all([listItems(uid), listCategories(uid)]);
    setItems(its);
    setCats(cs);
    setLoading(false);
  };

  useEffect(() => { if (user) load(user.id); }, [user]);

  const fullCats = useMemo(() => allCategories(cats), [cats]);
  const stats = useMemo(() => basicStats(items), [items]);
  const stk = useMemo(() => streak(items), [items]);

  const today = todayStr();
  const todayCount = items.filter(it => !it.done && it.dueDate === today).length;
  const overdueCount = items.filter(it => !it.done && it.dueDate && it.dueDate < today).length;

  // 카테고리별 개수 (범례용)
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.categoryId || 'etc'] = (m[it.categoryId || 'etc'] || 0) + 1;
    return m;
  }, [items]);

  // 필터링 + 정렬
  const visible = useMemo(() => {
    let list = items.slice();
    if (catFilter) list = list.filter(it => (it.categoryId || 'etc') === catFilter);
    if (filter === 'active') list = list.filter(it => !it.done);
    else if (filter === 'done') list = list.filter(it => it.done);
    else if (filter === 'today') list = list.filter(it => !it.done && it.dueDate === today);
    else if (filter === 'overdue') list = list.filter(it => !it.done && it.dueDate && it.dueDate < today);
    // 정렬: 미완료 우선 → 마감일 빠른 순(없으면 뒤) → 생성 최신
    const w = (it: any) => (it.done ? 1 : 0);
    list.sort((a, b) => {
      if (w(a) !== w(b)) return w(a) - w(b);
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
      return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    });
    return list;
  }, [items, filter, catFilter, today]);

  const refreshBadge = () => window.dispatchEvent(new Event('altrotodo:refresh'));

  const add = async () => {
    const t = title.trim();
    if (!t || !user) return;
    setAdding(true);
    try {
      const it = await addItem(user.id, { title: t, dueDate: due || null, categoryId: catId, priority: prio });
      setItems(prev => [it, ...prev]);
      setTitle(''); setDue('');
      refreshBadge();
    } catch (e: any) {
      alert('추가 실패: ' + (e?.message || e));
    }
    setAdding(false);
  };

  const toggle = async (it: any) => {
    const done = !it.done;
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, done, completedAt: done ? new Date().toISOString() : null } : x));
    try { await toggleItem(user.id, it.id, done); refreshBadge(); }
    catch { load(user.id); }
  };

  const del = async (it: any) => {
    setItems(prev => prev.filter(x => x.id !== it.id));
    try { await deleteItem(user.id, it.id); refreshBadge(); }
    catch { load(user.id); }
  };

  const startEdit = (it: any) => { setEditId(it.id); setEditText(it.title); };
  const saveEdit = async (it: any) => {
    const t = editText.trim();
    setEditId(null);
    if (!t || t === it.title) return;
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, title: t } : x));
    try { await updateItem(user.id, it.id, { title: t }); } catch { load(user.id); }
  };

  const clearDone = async () => {
    if (!confirm('완료된 할일을 모두 삭제할까요?')) return;
    const n = await clearCompleted(user.id);
    if (n) { setItems(prev => prev.filter(x => !x.done)); refreshBadge(); }
  };

  // ── 렌더 ──
  if (!ready) return null;

  if (!user) {
    return (
      <main className="td-wrap">
        <div className="td-empty" style={{ paddingTop: 100 }}>
          <div className="td-empty-ico"><I.List width={28} height={28} /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            로그인하고 할일을 관리하세요
          </div>
          <div style={{ marginBottom: 20 }}>내 할일은 나에게만 보입니다.</div>
          <Link href="/login" className="bj-btn bj-btn-primary">로그인 / 회원가입</Link>
        </div>
      </main>
    );
  }

  const doneCount = visible.filter(it => it.done).length;

  return (
    <main className="td-wrap">
      <div className="td-layout">
        {/* 좌측 요약 */}
        <aside className="td-side">
          <div className="td-summary">
            <div className="td-summary-title"><I.Chart width={15} height={15} /> 진행 요약</div>
            <div className="td-ring-row">
              <Ring pct={stats.rate} />
              <div className="td-ring-label">
                <div className="td-ring-pct" style={{ color: 'var(--text)', fontSize: 22 }}>{stats.done}/{stats.total}</div>
                <div className="td-ring-sub">완료 / 전체</div>
                <div className="td-streak" style={{ marginTop: 6 }}><I.Flame width={15} height={15} /> {stk}일 연속</div>
              </div>
            </div>
            <div className="td-summary-stats">
              <div className="td-stat-box"><div className="v">{stats.pending}</div><div className="l">진행중</div></div>
              <div className="td-stat-box"><div className="v">{stats.done}</div><div className="l">완료</div></div>
              <div className="td-stat-box"><div className="v" style={{ color: todayCount ? 'var(--amber)' : undefined }}>{todayCount}</div><div className="l">오늘 마감</div></div>
              <div className="td-stat-box"><div className="v" style={{ color: overdueCount ? 'var(--accent)' : undefined }}>{overdueCount}</div><div className="l">지연</div></div>
            </div>
          </div>

          <div className="td-side-cats">
            <div className="td-summary-title"><I.Tag width={15} height={15} /> 카테고리</div>
            <button className={`td-side-cat ${catFilter === null ? 'active' : ''}`} onClick={() => setCatFilter(null)}>
              <span className="td-cat-dot" style={{ background: 'var(--muted)' }} /> 전체
              <span className="cnt">{items.length}</span>
            </button>
            {fullCats.filter(c => catCounts[c.id]).map(c => (
              <button key={c.id} className={`td-side-cat ${catFilter === c.id ? 'active' : ''}`} onClick={() => setCatFilter(c.id)}>
                <span className="td-cat-dot" style={{ background: c.color }} /> {c.label}
                <span className="cnt">{catCounts[c.id]}</span>
              </button>
            ))}
            <Link href="/categories" className="td-side-cat" style={{ color: 'var(--muted)', marginTop: 4 }}>
              <span className="td-cat-dot" style={{ background: 'transparent', border: '1.5px dashed var(--border-dark)' }} /> 카테고리 관리
            </Link>
          </div>
        </aside>

        {/* 우측 메인 */}
        <section className="td-main">
          {/* 추가 폼 */}
          <div className="td-add">
            <div className="td-add-row">
              <input
                className="td-add-input"
                placeholder="할일을 입력하고 Enter (예: 알고리즘 과제 끝내기)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
              />
              <button className="td-add-btn" onClick={add} disabled={adding || !title.trim()} aria-label="추가">
                <I.Plus width={22} height={22} />
              </button>
            </div>
            <div className="td-add-opts">
              <input className="td-mini" type="date" value={due} onChange={e => setDue(e.target.value)} title="마감일" />
              <select className="td-mini td-select" value={catId} onChange={e => setCatId(e.target.value)} title="카테고리">
                {fullCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select className="td-mini td-select" value={prio} onChange={e => setPrio(e.target.value)} title="우선순위">
                <option value="normal">보통</option>
                <option value="high">높음</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>

          {/* 필터 바 */}
          <div className="td-filters">
            {FILTERS.map(f => {
              const cnt = f.id === 'all' ? items.length
                : f.id === 'active' ? stats.pending
                : f.id === 'done' ? stats.done
                : f.id === 'today' ? todayCount
                : overdueCount;
              return (
                <button key={f.id} className={`td-filter ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}<span className="cnt">{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* 리스트 */}
          {loading ? (
            <div className="td-empty">불러오는 중…</div>
          ) : visible.length === 0 ? (
            <div className="td-empty">
              <div className="td-empty-ico"><I.Check width={28} height={28} /></div>
              {filter === 'all' && !catFilter ? '아직 할일이 없어요. 위에서 첫 할일을 추가해보세요!' : '해당하는 할일이 없어요.'}
            </div>
          ) : (
            <div className="td-list">
              {visible.map(it => {
                const cat = getCategory(it.categoryId, cats);
                const dd = it.done ? null : ddayInfo(it.dueDate);
                return (
                  <div key={it.id} className={`td-item ${it.done ? 'done' : ''}`} style={{ ['--bar' as any]: cat.color }}>
                    <button className={`td-check ${it.done ? 'on' : ''}`} onClick={() => toggle(it)} aria-label="완료 토글">
                      {it.done && <I.Check width={15} height={15} />}
                    </button>
                    <div className="td-body">
                      {editId === it.id ? (
                        <input
                          className="td-title-input"
                          value={editText}
                          autoFocus
                          onChange={e => setEditText(e.target.value)}
                          onBlur={() => saveEdit(it)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(it); if (e.key === 'Escape') setEditId(null); }}
                        />
                      ) : (
                        <div className="td-title" onDoubleClick={() => startEdit(it)}>
                          {it.priority === 'high' && <span className="td-prio-high" title="높은 우선순위">★ </span>}
                          {it.title}
                        </div>
                      )}
                      <div className="td-meta">
                        <span className="td-cat-pill" style={{ color: cat.color, background: cat.color + '1f' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: cat.color, display: 'inline-block' }} />
                          {cat.label}
                        </span>
                        {it.dueDate && (
                          <span className={`td-dday ${dd ? dd.status : ''}`}>
                            <I.Calendar width={12} height={12} /> {formatDue(it.dueDate)}{dd && dd.status !== 'none' && dd.status !== 'future' ? ` · ${dd.label}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="td-actions">
                      <button className="td-icon-btn" onClick={() => startEdit(it)} aria-label="수정"><I.Edit width={16} height={16} /></button>
                      <button className="td-icon-btn danger" onClick={() => del(it)} aria-label="삭제"><I.Trash width={16} height={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(stats.done > 0) && (
            <div className="td-list-foot">
              <span>완료 {stats.done}개 · 진행 {stats.pending}개</span>
              <button className="td-clear-btn" onClick={clearDone}>완료한 할일 비우기</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
