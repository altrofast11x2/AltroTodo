'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { listItems, listCategories } from '@/lib/todo';
import { allCategories } from '@/lib/categories';
import { todayStr } from '@/lib/dates';
import {
  basicStats, streak, weekly, weeklyRate, monthly, monthlyRate, categoryDistribution,
} from '@/lib/stats';
import { Icons as I } from '../components/Icons';

// 막대 차트
function Bars({ data, accentToday }: { data: { label: string; done: number; today?: boolean }[]; accentToday?: boolean }) {
  const max = Math.max(1, ...data.map(d => d.done));
  return (
    <div className="td-bars">
      {data.map((d, i) => {
        const h = d.done > 0 ? Math.max((d.done / max) * 100, 6) : 0;
        return (
          <div className="td-bar-col" key={i}>
            <div className="td-bar-track">
              <div className={`td-bar ${d.done === 0 ? 'muted' : ''} ${accentToday && d.today ? 'today-col' : ''}`}
                style={{ height: `${h}%` }}>
                {d.done > 0 && <span className="td-bar-val">{d.done}</span>}
              </div>
            </div>
            <div className="td-bar-lbl">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altrotodo_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch { setUser(null); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [its, cs] = await Promise.all([listItems(user.id), listCategories(user.id)]);
      setItems(its); setCats(cs); setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => basicStats(items), [items]);
  const stk = useMemo(() => streak(items), [items]);
  const wk = useMemo(() => weekly(items, 7), [items]);
  const wkRate = useMemo(() => weeklyRate(items), [items]);
  const mo = useMemo(() => monthly(items, 6), [items]);
  const moRate = useMemo(() => monthlyRate(items), [items]);
  const dist = useMemo(() => categoryDistribution(items, allCategories(cats)), [items, cats]);

  const today = todayStr();
  const wkData = wk.map(d => ({ label: d.label, done: d.done, today: d.day === today }));
  const weekTotal = wk.reduce((s, d) => s + d.done, 0);

  if (!ready) return null;
  if (!user) {
    return (
      <main className="td-wrap">
        <div className="td-empty" style={{ paddingTop: 100 }}>
          <div className="td-empty-ico"><I.Chart width={28} height={28} /></div>
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
        <div className="td-page-title">완료 통계</div>
        <div className="td-page-sub">나의 할일 완료 흐름을 한눈에 확인하세요.</div>
      </div>

      {loading ? (
        <div className="td-empty">불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className="td-empty">
          <div className="td-empty-ico"><I.Chart width={28} height={28} /></div>
          아직 통계로 보여줄 할일이 없어요.<br />할일을 추가하고 완료해보세요!
        </div>
      ) : (
        <>
          {/* 큰 지표 */}
          <div className="td-bigstat-row">
            <div className="td-bigstat accent"><div className="v">{stats.rate}%</div><div className="l">전체 완료율</div></div>
            <div className="td-bigstat"><div className="v">{stats.total}</div><div className="l">총 할일</div></div>
            <div className="td-bigstat"><div className="v">{stats.done}</div><div className="l">완료</div></div>
            <div className="td-bigstat"><div className="v" style={{ color: 'var(--amber)' }}>{stk}<span style={{ fontSize: 15 }}>일</span></div><div className="l">연속 완료 스트릭</div></div>
          </div>

          <div className="td-stats-grid">
            {/* 주간 */}
            <div className="td-card">
              <div className="td-stat-head">주간 완료 추이</div>
              <div className="td-stat-note">최근 7일간 완료한 할일 · 이번 주 마감 완료율 {wkRate.rate}% ({wkRate.done}/{wkRate.total})</div>
              <Bars data={wkData} accentToday />
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)' }}>
                최근 7일 완료 <strong style={{ color: 'var(--text)' }}>{weekTotal}개</strong> · 일평균 {(weekTotal / 7).toFixed(1)}개
              </div>
            </div>

            {/* 월간 */}
            <div className="td-card">
              <div className="td-stat-head">월간 완료 추이</div>
              <div className="td-stat-note">최근 6주 주별 완료 · 이번 달 완료율 {moRate.rate}% ({moRate.done}/{moRate.total})</div>
              <Bars data={mo.map(m => ({ label: m.label, done: m.done }))} />
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)' }}>
                막대 위 숫자는 그 주에 완료한 할일 수예요.
              </div>
            </div>
          </div>

          {/* 카테고리별 완료 분포 */}
          <div className="td-card" style={{ marginTop: 16 }}>
            <div className="td-stat-head">카테고리별 완료율</div>
            <div className="td-stat-note">카테고리마다 얼마나 끝냈는지 보여줍니다.</div>
            {dist.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>데이터가 없어요.</div>
            ) : dist.map(c => {
              const rate = c.total ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <div className="td-dist-row" key={c.id}>
                  <span className="td-dist-label" style={{ color: c.color }}>{c.label}</span>
                  <span className="td-dist-track">
                    <span className="td-dist-fill" style={{ width: `${rate}%`, background: c.color }} />
                  </span>
                  <span className="td-dist-val">{c.done}/{c.total} · {rate}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
