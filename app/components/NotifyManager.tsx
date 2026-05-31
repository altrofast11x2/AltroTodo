'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { listItems } from '@/lib/todo';
import { todayStr, diffDays } from '@/lib/dates';

// 마감 임박/지난 할일에 대해 브라우저 알림(Web Notifications API)을 띄운다.
// - 설정에서 켠 경우 + 권한 허용 시에만 동작
// - 같은 할일은 하루 한 번만 알림 (localStorage 로 dedupe)
const LEAD_KEY = 'altrotodo_notify_lead';
const ON_KEY = 'altrotodo_browser_notify';
const SENT_KEY = 'altrotodo_notified';

function getSent(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch { return {}; }
}

export default function NotifyManager() {
  const pathname = usePathname();

  useEffect(() => {
    let timer: any;

    const run = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (localStorage.getItem(ON_KEY) !== '1') return;
        if (Notification.permission !== 'granted') return;
        const raw = localStorage.getItem('altrotodo_user');
        if (!raw) return;
        const user = JSON.parse(raw);
        const lead = Number(localStorage.getItem(LEAD_KEY) || '1');

        const items = await listItems(user.id);
        const today = todayStr();
        const due = items.filter(it => {
          if (it.done || !it.dueDate) return false;
          const d = diffDays(today, it.dueDate);
          return d < 0 || (d >= 0 && d <= lead);
        });
        if (!due.length) return;

        const sent = getSent();
        let changed = false;
        for (const it of due) {
          const key = `${it.id}:${today}`;
          if (sent[key]) continue;
          const d = diffDays(today, it.dueDate);
          const when = d < 0 ? `${-d}일 지남` : d === 0 ? '오늘 마감' : `D-${d}`;
          try {
            new Notification('할일 마감 알림 · AltroTodo', {
              body: `${it.title} — ${when}`,
              tag: `altrotodo-${it.id}`,
            });
          } catch {}
          sent[key] = '1';
          changed = true;
        }
        // 오래된 dedupe 키 정리 (오늘 것만 유지)
        if (changed) {
          const pruned: Record<string, string> = {};
          for (const k of Object.keys(sent)) if (k.endsWith(`:${today}`)) pruned[k] = '1';
          localStorage.setItem(SENT_KEY, JSON.stringify(pruned));
        }
      } catch { /* 조용히 무시 */ }
    };

    run();
    timer = setInterval(run, 30 * 60 * 1000); // 30분마다 재확인
    return () => clearInterval(timer);
  }, [pathname]);

  return null;
}
