import { NextResponse } from 'next/server';

// 마감 임박 할일을 이메일로 발송한다.
// RESEND_API_KEY 가 설정돼 있으면 Resend 로 실제 발송, 없으면 graceful degrade.
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const { email, name, items } = body || {};

  if (!email || !Array.isArray(items)) {
    return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'no_items' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // 키 미설정 — 인앱/브라우저 알림만 사용 중. 에러가 아니라 정상 응답으로 안내.
    return NextResponse.json({ ok: true, sent: false, reason: 'not_configured' });
  }

  const from = process.env.NOTIFY_FROM_EMAIL || 'AltroTodo <onboarding@resend.dev>';
  const rows = items.map((it: any) => {
    const due = it.due ? escapeHtml(it.due) : '';
    const when = it.status ? escapeHtml(it.status) : '';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(it.title || '')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;white-space:nowrap;">${due}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#c0392b;white-space:nowrap;">${when}</td>
    </tr>`;
  }).join('');

  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
    <h2 style="color:#c0392b;margin:0 0 4px;">AltroTodo · 마감 임박 알림</h2>
    <p style="color:#555;margin:0 0 16px;">${escapeHtml(name || '회원')}님, 마감이 임박했거나 지난 할일이 <b>${items.length}건</b> 있어요.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="text-align:left;color:#999;font-size:12px;">
        <th style="padding:8px 12px;">할일</th><th style="padding:8px 12px;">마감</th><th style="padding:8px 12px;">상태</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#aaa;font-size:12px;margin-top:20px;">AltroTodo — 오늘 할 일을 가볍게 정리하세요</p>
  </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: email,
        subject: `[AltroTodo] 마감 임박 할일 ${items.length}건`,
        html,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ ok: false, sent: false, error: t.slice(0, 200) }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent: true, count: items.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, sent: false, error: String(e?.message || e) }, { status: 500 });
  }
}
