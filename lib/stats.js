// 완료 통계 집계 — 본인 todo_items 전체를 받아 클라이언트에서 계산한다.
import { todayStr, addDaysStr, startOfWeek, parseDate } from './dates';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

// 완료 처리된 '날짜' 문자열 (미완료/미기록이면 null)
function completedDay(it) {
  return it.done && it.completedAt ? todayStr(new Date(it.completedAt)) : null;
}

export function basicStats(items) {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  return { total, done, pending: total - done, rate: total ? Math.round((done / total) * 100) : 0 };
}

// 연속 완료 스트릭 — 매일 1개 이상 완료한 연속 일수 (오늘 미완료면 어제까지 인정)
export function streak(items) {
  const days = new Set(items.map(completedDay).filter(Boolean));
  if (!days.size) return 0;
  let count = 0;
  let cur = todayStr();
  if (!days.has(cur)) {
    cur = addDaysStr(cur, -1);
    if (!days.has(cur)) return 0;
  }
  while (days.has(cur)) { count++; cur = addDaysStr(cur, -1); }
  return count;
}

// 최근 n일 일별 완료 수 [{ day, label, done }]
export function weekly(items, n = 7) {
  const today = todayStr();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDaysStr(today, -i);
    const d = parseDate(day);
    const done = items.filter(it => completedDay(it) === day).length;
    out.push({ day, label: WD[d.getDay()], done });
  }
  return out;
}

// 최근 7일 마감 기준 완료율
export function weeklyRate(items) {
  const today = todayStr();
  const from = addDaysStr(today, -6);
  const win = items.filter(it => it.dueDate && it.dueDate >= from && it.dueDate <= today);
  const done = win.filter(it => it.done).length;
  return { total: win.length, done, rate: win.length ? Math.round((done / win.length) * 100) : 0 };
}

// 최근 weeks 주 주별 완료 수 [{ start, end, label, done }]
export function monthly(items, weeks = 6) {
  const curWeekStart = startOfWeek();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDaysStr(curWeekStart, -7 * i);
    const end = addDaysStr(start, 6);
    const done = items.filter(it => {
      const cd = completedDay(it);
      return cd && cd >= start && cd <= end;
    }).length;
    const d = parseDate(start);
    out.push({ start, end, label: `${d.getMonth() + 1}/${d.getDate()}`, done });
  }
  return out;
}

// 이번 달 생성된 할일 기준 완료율
export function monthlyRate(items) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const inMonth = items.filter(it => String(it.createdAt || '').slice(0, 7) === ym);
  const done = inMonth.filter(it => it.done).length;
  return { total: inMonth.length, done, rate: inMonth.length ? Math.round((done / inMonth.length) * 100) : 0 };
}

// 카테고리별 분포 [{ id, label, color, total, done }] — 항목 있는 것만, 많은 순
export function categoryDistribution(items, categories) {
  const map = {};
  for (const it of items) {
    const id = it.categoryId || 'etc';
    if (!map[id]) map[id] = { total: 0, done: 0 };
    map[id].total++;
    if (it.done) map[id].done++;
  }
  return categories
    .map(c => ({ ...c, total: map[c.id]?.total || 0, done: map[c.id]?.done || 0 }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
}
