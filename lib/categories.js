// AltroTodo 카테고리 정의
// 기본 카테고리는 코드에 고정(공부/운동/취미/업무/생활/기타).
// 사용자 정의 카테고리는 todo_categories/{uid} 에 저장되며 아래 팔레트에서 색을 고른다.

export const DEFAULT_CATEGORIES = [
  { id: 'study',    label: '공부', color: '#2f6df0' },
  { id: 'exercise', label: '운동', color: '#1a9e54' },
  { id: 'hobby',    label: '취미', color: '#8b5cf6' },
  { id: 'work',     label: '업무', color: '#c0392b' },
  { id: 'life',     label: '생활', color: '#d98a0b' },
  { id: 'etc',      label: '기타', color: '#7a6e58' },
];

// 사용자 정의 카테고리용 색상 팔레트
export const COLOR_PALETTE = [
  '#c0392b', // 와인레드
  '#e67e22', // 오렌지
  '#d98a0b', // 앰버
  '#1a9e54', // 그린
  '#0e9488', // 틸
  '#2f6df0', // 블루
  '#8b5cf6', // 퍼플
  '#d6336c', // 핑크
];

export const DEFAULT_CATEGORY_ID = 'etc';

// 기본 + 커스텀을 합친 전체 목록
export function allCategories(custom = []) {
  return [...DEFAULT_CATEGORIES, ...(custom || [])];
}

// id 로 카테고리 객체 조회 (없으면 '기타' fallback)
export function getCategory(id, custom = []) {
  const list = allCategories(custom);
  return list.find(c => c.id === id) || DEFAULT_CATEGORIES.find(c => c.id === 'etc');
}

export function isDefaultCategory(id) {
  return DEFAULT_CATEGORIES.some(c => c.id === id);
}
