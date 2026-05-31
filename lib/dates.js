// 날짜 유틸 — 로컬 타임존 기준 'YYYY-MM-DD' 문자열을 사용한다.

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' → 로컬 자정 Date
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// 두 날짜 문자열 사이의 일수 차이 (b - a)
export function diffDays(aStr, bStr) {
  const a = parseDate(aStr);
  const b = parseDate(bStr);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

// 마감일 → D-day 정보 { days, label, status }
//   status: 'none' | 'overdue' | 'today' | 'soon' | 'future'
export function ddayInfo(dueDate, baseStr = todayStr()) {
  if (!dueDate) return { days: null, label: '', status: 'none' };
  const days = diffDays(baseStr, dueDate); // 양수면 미래
  let status = 'future';
  let label = `D-${days}`;
  if (days < 0) { status = 'overdue'; label = `${-days}일 지남`; }
  else if (days === 0) { status = 'today'; label = 'D-DAY'; }
  else if (days <= 2) { status = 'soon'; label = `D-${days}`; }
  return { days, label, status };
}

// 사람이 읽기 좋은 마감일 표기 (예: 5월 31일 (오늘))
export function formatDue(dueDate, baseStr = todayStr()) {
  const d = parseDate(dueDate);
  if (!d) return '';
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const days = diffDays(baseStr, dueDate);
  if (days === 0) return `${base} (오늘)`;
  if (days === 1) return `${base} (내일)`;
  if (days === -1) return `${base} (어제)`;
  return base;
}

// 주의 시작(월요일) 'YYYY-MM-DD'
export function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 월=0
  date.setDate(date.getDate() - day);
  return todayStr(date);
}

export function addDaysStr(str, n) {
  const d = parseDate(str) || new Date();
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
