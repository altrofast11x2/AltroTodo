'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { listCategories, addCategory, updateCategory, deleteCategory, listItems } from '@/lib/todo';
import { DEFAULT_CATEGORIES, COLOR_PALETTE } from '@/lib/categories';
import { Icons as I } from '../components/Icons';

export default function CategoriesPage() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // 새 카테고리
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 편집
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLOR_PALETTE[0]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altrotodo_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch { setUser(null); }
    setReady(true);
  }, []);

  const load = async (uid: string) => {
    setLoading(true);
    const [cs, its] = await Promise.all([listCategories(uid), listItems(uid)]);
    setCats(cs);
    const m: Record<string, number> = {};
    for (const it of its) m[it.categoryId || 'etc'] = (m[it.categoryId || 'etc'] || 0) + 1;
    setCounts(m);
    setLoading(false);
  };
  useEffect(() => { if (user) load(user.id); }, [user]);

  const add = async () => {
    setErr('');
    const t = name.trim();
    if (!t) { setErr('카테고리 이름을 입력해주세요'); return; }
    if ([...DEFAULT_CATEGORIES, ...cats].some(c => c.label === t)) { setErr('이미 있는 카테고리예요'); return; }
    setBusy(true);
    try {
      const c = await addCategory(user.id, t, color);
      setCats(prev => [...prev, c]);
      setName('');
      window.dispatchEvent(new Event('altrotodo:refresh'));
    } catch (e: any) { setErr('추가 실패: ' + (e?.message || e)); }
    setBusy(false);
  };

  const startEdit = (c: any) => { setEditId(c.id); setEditName(c.label); setEditColor(c.color); };
  const saveEdit = async (c: any) => {
    const t = editName.trim();
    if (!t) { setEditId(null); return; }
    setCats(prev => prev.map(x => x.id === c.id ? { ...x, label: t, color: editColor } : x));
    setEditId(null);
    try { await updateCategory(user.id, c.id, { label: t, color: editColor }); window.dispatchEvent(new Event('altrotodo:refresh')); }
    catch { load(user.id); }
  };

  const del = async (c: any) => {
    if (!confirm(`'${c.label}' 카테고리를 삭제할까요?\n이 카테고리의 할일은 '기타'로 이동합니다.`)) return;
    setCats(prev => prev.filter(x => x.id !== c.id));
    try { await deleteCategory(user.id, c.id); window.dispatchEvent(new Event('altrotodo:refresh')); }
    catch { load(user.id); }
  };

  if (!ready) return null;
  if (!user) {
    return (
      <main className="td-wrap">
        <div className="td-empty" style={{ paddingTop: 100 }}>
          <div className="td-empty-ico"><I.Tag width={28} height={28} /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>로그인이 필요합니다</div>
          <Link href="/login" className="bj-btn bj-btn-primary">로그인 / 회원가입</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="td-wrap">
      <Link href="/" className="bj-back-link"><I.Chevron width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> 내 할일</Link>
      <div className="td-page-head">
        <div className="td-page-title">카테고리 관리</div>
        <div className="td-page-sub">할일을 색상으로 분류하세요. 기본 6종 + 나만의 카테고리를 자유롭게 추가할 수 있어요.</div>
      </div>

      {/* 새 카테고리 추가 */}
      <div className="td-card">
        <h3>새 카테고리 추가</h3>
        {err && <div className="bj-alert bj-alert-error">{err}</div>}
        <div className="bj-field" style={{ marginBottom: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 사이드 프로젝트"
            onKeyDown={e => e.key === 'Enter' && add()} maxLength={12} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>색상 선택</div>
        <div className="td-palette">
          {COLOR_PALETTE.map(c => (
            <button key={c} className={`td-swatch-btn ${color === c ? 'sel' : ''}`} style={{ background: c }}
              onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
        <button className="bj-btn bj-btn-primary" onClick={add} disabled={busy || !name.trim()}>
          <I.Plus width={16} height={16} /> 추가
        </button>
      </div>

      {/* 기본 카테고리 */}
      <div className="td-card">
        <h3>기본 카테고리</h3>
        {DEFAULT_CATEGORIES.map(c => (
          <div key={c.id} className="td-cat-row">
            <span className="td-cat-swatch" style={{ background: c.color }} />
            <span className="td-cat-name">{c.label}</span>
            <span className="td-cat-tag">{counts[c.id] || 0}개</span>
            <span className="td-cat-tag" style={{ background: 'transparent', color: 'var(--muted2)' }}>기본</span>
          </div>
        ))}
      </div>

      {/* 내 카테고리 */}
      <div className="td-card">
        <h3>내 카테고리 {cats.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {cats.length}개</span>}</h3>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>불러오는 중…</div>
        ) : cats.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>아직 추가한 카테고리가 없어요.</div>
        ) : cats.map(c => (
          <div key={c.id} className="td-cat-row">
            {editId === c.id ? (
              <>
                <span className="td-cat-swatch" style={{ background: editColor }} />
                <input className="td-mini" style={{ flex: 1 }} value={editName} autoFocus maxLength={12}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(c); if (e.key === 'Escape') setEditId(null); }} />
                <div style={{ display: 'flex', gap: 5 }}>
                  {COLOR_PALETTE.map(col => (
                    <button key={col} className={`td-swatch-btn ${editColor === col ? 'sel' : ''}`}
                      style={{ background: col, width: 22, height: 22 }} onClick={() => setEditColor(col)} aria-label={col} />
                  ))}
                </div>
                <button className="td-icon-btn" onClick={() => saveEdit(c)} aria-label="저장"><I.Check width={17} height={17} /></button>
              </>
            ) : (
              <>
                <span className="td-cat-swatch" style={{ background: c.color }} />
                <span className="td-cat-name">{c.label}</span>
                <span className="td-cat-tag">{counts[c.id] || 0}개</span>
                <button className="td-icon-btn" onClick={() => startEdit(c)} aria-label="수정"><I.Edit width={16} height={16} /></button>
                <button className="td-icon-btn danger" onClick={() => del(c)} aria-label="삭제"><I.Trash width={16} height={16} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
