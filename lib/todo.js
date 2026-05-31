// AltroTodo Firebase Realtime DB helpers
// 모든 노드는 다른 Altro 앱과 충돌하지 않게 `todo_` 프리픽스 사용.
import {
  ref, get, set, update, push, remove, query, orderByChild, equalTo,
} from 'firebase/database';
import { db } from './firebase';
import { hashPassword } from './security';

// ───────── USERS ─────────
// 규칙 미게시 등으로 조회 실패해도 무너지지 않게 try/catch → null 반환
export async function findUserByEmail(email) {
  const lower = String(email || '').toLowerCase();
  try {
    const snap = await get(query(ref(db, 'todo_users'), orderByChild('email'), equalTo(lower)));
    if (!snap.exists()) return null;
    const [uid, u] = Object.entries(snap.val())[0];
    return { uid, ...u };
  } catch (e) {
    console.warn('[AltroTodo] todo_users 조회 실패 (Firebase 규칙 미게시 가능성):', e?.message || e);
    return null;
  }
}

export async function loginUser(email, password) {
  const lower = String(email || '').toLowerCase();
  const hashed = await hashPassword(password, lower);

  // 1) AltroTodo 자체 회원
  const own = await findUserByEmail(lower);
  if (own && own.password === hashed) {
    return { id: own.uid, name: own.name, email: own.email, source: 'todo' };
  }

  // 2) AltroBoard 통합 로그인 — users/ 노드에서 같은 이메일+해시 매칭 시 자동 인증
  try {
    const altro = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lower)));
    if (altro.exists()) {
      for (const [uid, u] of Object.entries(altro.val())) {
        if (!u || typeof u.password !== 'string') continue;
        if (u.password !== hashed) continue;
        // todo_users 미러 생성 (권한 없으면 무시 — 메모리 세션만)
        try {
          const mirror = await get(ref(db, `todo_users/${uid}`));
          if (!mirror.exists()) {
            await set(ref(db, `todo_users/${uid}`), {
              name: u.name || '익명',
              email: lower,
              password: hashed,
              fromAltroboard: true,
              createdAt: u.createdAt || new Date().toISOString(),
              linkedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('[AltroTodo] todo_users 미러 생성 실패 — Firebase 규칙 게시 필요:', e?.message || e);
        }
        return { id: uid, name: u.name || '익명', email: lower, source: 'altroboard' };
      }
    }
  } catch (e) {
    console.warn('[AltroTodo] altroboard users 조회 실패:', e?.message || e);
  }

  return null;
}

export async function registerUser(name, email, password) {
  const lower = String(email).toLowerCase();
  if (await findUserByEmail(lower)) return { error: '이미 가입된 이메일입니다. 로그인 해주세요.' };

  // AltroBoard 에 같은 이메일이 있으면 그쪽 비밀번호로 로그인하도록 안내
  try {
    const altro = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lower)));
    if (altro.exists()) {
      return { error: 'AltroBoard 에 이미 가입된 이메일입니다. AltroBoard 비밀번호로 바로 로그인 해주세요.' };
    }
  } catch {}

  const hashed = await hashPassword(password, lower);
  const newRef = push(ref(db, 'todo_users'));
  await set(newRef, { name, email: lower, password: hashed, createdAt: new Date().toISOString() });
  return { id: newRef.key, name, email: lower };
}

export async function getUser(uid) {
  try {
    const snap = await get(ref(db, `todo_users/${uid}`));
    if (!snap.exists()) return null;
    return { id: uid, ...snap.val() };
  } catch { return null; }
}

// ───────── ITEMS (할일) ─────────
export async function listItems(uid) {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `todo_items/${uid}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
  } catch (e) {
    console.warn('[AltroTodo] listItems 실패:', e?.message || e);
    return [];
  }
}

export async function addItem(uid, data) {
  const newRef = push(ref(db, `todo_items/${uid}`));
  const item = {
    title: String(data.title || '').trim(),
    note: data.note || '',
    categoryId: data.categoryId || 'etc',
    dueDate: data.dueDate || null,
    priority: data.priority || 'normal',
    done: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  await set(newRef, item);
  return { id: newRef.key, ...item };
}

export async function updateItem(uid, id, patch) {
  await update(ref(db, `todo_items/${uid}/${id}`), patch);
}

// 완료 토글 — 완료 시각(completedAt)을 통계용으로 기록
export async function toggleItem(uid, id, done) {
  await update(ref(db, `todo_items/${uid}/${id}`), {
    done,
    completedAt: done ? new Date().toISOString() : null,
  });
}

export async function deleteItem(uid, id) {
  await remove(ref(db, `todo_items/${uid}/${id}`));
}

// 완료된 할일 일괄 삭제
export async function clearCompleted(uid) {
  const items = await listItems(uid);
  const updates = {};
  for (const it of items) if (it.done) updates[it.id] = null;
  if (Object.keys(updates).length) await update(ref(db, `todo_items/${uid}`), updates);
  return Object.keys(updates).length;
}

// ───────── CATEGORIES (사용자 정의) ─────────
export async function listCategories(uid) {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `todo_categories/${uid}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
  } catch { return []; }
}

export async function addCategory(uid, label, color) {
  const newRef = push(ref(db, `todo_categories/${uid}`));
  const cat = { label: String(label).trim(), color, createdAt: new Date().toISOString() };
  await set(newRef, cat);
  return { id: newRef.key, ...cat };
}

export async function updateCategory(uid, id, patch) {
  await update(ref(db, `todo_categories/${uid}/${id}`), patch);
}

// 카테고리 삭제 시, 그 카테고리를 쓰던 할일은 '기타'로 이동
export async function deleteCategory(uid, id) {
  await remove(ref(db, `todo_categories/${uid}/${id}`));
  const items = await listItems(uid);
  const updates = {};
  for (const it of items) if (it.categoryId === id) updates[`${it.id}/categoryId`] = 'etc';
  if (Object.keys(updates).length) await update(ref(db, `todo_items/${uid}`), updates);
}

// ───────── SETTINGS (알림 등) ─────────
export async function getSettings(uid) {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, `todo_settings/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}

export async function saveSettings(uid, settings) {
  await update(ref(db, `todo_settings/${uid}`), settings);
}
