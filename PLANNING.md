# AltroTodo — 할일 관리(To-Do) 웹앱 계획서

> AltroBoard · AltroShop 에 이은 Altro 패밀리 3번째 앱.
> 로그인한 사용자별로 본인의 할일을 관리하고, 카테고리·마감일로 분류하며, 완료 통계와 마감 알림까지 제공한다.

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | AltroTodo |
| **목표** | 로그인 사용자별 개인 할일(To-Do) 관리 — 추가/완료체크/삭제, 마감일, 카테고리 색상 분류, 완료 통계, 마감 임박 알림 |
| **디자인 컨셉** | AltroBoard 와 동일한 종이 질감 + 와인레드 액센트 (크림 배경, 2px 샤프 코너, 세리프+산세리프 폰트, 다크모드 지원) |
| **계정** | AltroBoard / AltroShop 과 동일한 SHA-256 해시 포맷 → **통합 로그인** 호환 |

## 2. 기술 스택

| 분류 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | AltroShop 과 동일 버전 |
| 언어 | TypeScript / React 19 | |
| 데이터베이스 | Firebase Realtime DB (`cozyboard-9fb1a`) | Altro 패밀리 공용 프로젝트 재사용 (`todo_*` 네임스페이스로 격리) |
| 비밀번호 보안 | SHA-256 (`v1$<email>$<plain>`) | AltroBoard/AltroShop 과 동일한 `lib/security.js` 패턴 |
| 세션 | LocalStorage (`altrotodo_user`) | AltroShop 과 동일 패턴 |
| 차트 | 순수 SVG (외부 차트 라이브러리 미사용) | 의존성 최소화 — AltroShop 과 동일 철학 |
| 알림 | 인앱 알림 센터 + Web Notifications API + (선택) Resend 이메일 | |
| 호스팅 | Vercel | production 배포 |

## 3. 폴더 구조

```
AltroTodo/
├── app/
│   ├── layout.tsx              루트 레이아웃 (테마 부트스트랩 + NavBar + 알림 스케줄러)
│   ├── page.tsx                메인 대시보드 — 할일 목록/추가/완료/삭제/필터
│   ├── globals.css             AltroBoard 팔레트 + 할일 전용 스타일
│   ├── components/
│   │   ├── NavBar.tsx          상단 네비 + 햄버거 드로어 + 알림 벨
│   │   ├── Icons.tsx           공용 SVG 아이콘 (이모지 미사용)
│   │   └── NotifyManager.tsx   마감 임박 감시 → 브라우저 알림 트리거
│   ├── login/page.tsx          로그인 / 회원가입 (탭, AltroBoard 계정 호환)
│   ├── categories/page.tsx     카테고리 관리 (생성/색상/삭제)        [3단계]
│   ├── stats/page.tsx          완료 통계 (주간/월간 차트)            [4단계]
│   ├── settings/page.tsx       테마 + 알림 설정                      [4단계]
│   └── api/notify/route.ts     마감 임박 이메일 발송 (Resend)        [4단계]
├── lib/
│   ├── firebase.js             Firebase Realtime DB 초기화
│   ├── security.js             SHA-256 비밀번호 해시 (Altro 공용 포맷)
│   ├── categories.js           기본 카테고리 + 색상 팔레트
│   ├── todo.js                 모든 CRUD (users / items / categories / settings)
│   └── stats.js                완료율·스트릭 등 통계 집계 헬퍼
├── database.rules.json         Firebase 보안 규칙 (todo_* 노드 추가)
├── .env.local                  Firebase + (선택)Resend 자격 증명 (git 제외)
├── next.config.ts
├── tsconfig.json
├── package.json
└── PLANNING.md
```

## 4. 데이터 모델 (Firebase Realtime DB)

다른 Altro 앱과 충돌 방지를 위해 모든 노드는 `todo_` 프리픽스 사용.

| 노드 | 구조 | 인덱스 |
|------|------|--------|
| `todo_users/{uid}` | `{ name, email, password(sha256), createdAt }` | `email`, `createdAt` |
| `todo_items/{uid}/{tid}` | `{ title, note, categoryId, done, dueDate, priority, createdAt, completedAt }` | `done`, `dueDate`, `createdAt`, `categoryId`, `completedAt` |
| `todo_categories/{uid}/{cid}` | `{ name, color, createdAt }` (사용자 정의 카테고리) | `createdAt` |
| `todo_settings/{uid}` | `{ emailNotify, browserNotify, notifyLeadHours }` | — |

**할일(item) 필드 상세**

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 할일 제목 (필수) |
| `note` | string | 메모/상세 (선택) |
| `categoryId` | string | 카테고리 slug (기본) 또는 커스텀 카테고리 id |
| `done` | boolean | 완료 여부 |
| `dueDate` | string\|null | 마감일 `YYYY-MM-DD` |
| `priority` | `'low'\|'normal'\|'high'` | 우선순위 |
| `createdAt` | ISO string | 생성 시각 |
| `completedAt` | ISO string\|null | 완료 처리 시각 (통계 집계 기준) |

> **사용자별 격리**: `todo_items/{uid}` 하위에 본인 할일만 저장된다. 다른 사용자의 노드는 읽지 않으며 UI 상 접근 경로도 없다.

## 5. 핵심 기능

### 5.1 회원 / 로그인 (1·2단계)
- 이메일/비밀번호 가입·로그인 (SHA-256 해시 저장)
- **AltroBoard / AltroShop 통합 로그인**: 같은 이메일+비밀번호면 AltroBoard `users/` 노드로도 인증
- LocalStorage 세션 (`altrotodo_user`)
- 별도 관리자 권한/기능 없음(개인용 앱) — 비밀정보를 소스에 하드코딩하지 않음

### 5.2 할일 CRUD (2단계)
- **추가**: 제목 + (선택)마감일/카테고리/우선순위
- **완료 체크**: 체크박스 토글 → `done` + `completedAt` 기록
- **삭제**: 개별 삭제, 완료 항목 일괄 삭제
- **수정**: 제목/메모 인라인 편집
- 필터: 전체 / 진행중 / 완료 / 오늘 / 지연

### 5.3 카테고리 + 마감일 (3단계)
- 기본 카테고리 6종(공부·운동·취미·업무·생활·기타)을 색상으로 구분
- 사용자 정의 카테고리 추가(이름 + 색상 팔레트 선택)
- 카테고리별 필터링 + 좌측 색상 막대 표시
- 마감일: 오늘/내일/지남(빨강)/임박(앰버) 상태를 배지로 시각화
- D-day 표시 (D-3, D-DAY, +2일 지남 등)

### 5.4 완료 통계 (4단계)
- 전체 완료율 도넛 + 누적/완료/진행 카운트
- **주간 완료율**: 최근 7일 일별 완료 막대 차트
- **월간 완료율**: 최근 N주 주별 완료 추이 + 이번 달 달성률
- 카테고리별 완료 분포 (색상 막대)
- 연속 완료 스트릭(streak) — 매일 1개 이상 완료한 연속 일수

### 5.5 알림 (4단계)
- **인앱 알림 센터**: NavBar 벨 아이콘 → 마감 임박/지난 할일 목록 + 카운트 배지
- **브라우저 알림**: Web Notifications API 권한 요청 후, 마감 `notifyLeadHours` 시간 전 데스크톱 알림
- **이메일 알림(선택)**: 설정에서 켜면 `/api/notify` 라우트가 Resend 로 마감 임박 메일 발송 (`RESEND_API_KEY` 없으면 인앱/브라우저 알림만 동작 — graceful degrade)

## 6. 화면 레이아웃

```
┌───────────────────────────────────────────────────────────┐
│  AltroTodo            [+ 새 할일]      🔔(3)   [아바타] ☰   │  ← NavBar
├───────────────────────────────────────────────────────────┤
│  [전체] [진행중] [완료] [오늘] [지연]    카테고리 ▾  통계↗  │  ← 필터 바
├──────────────┬────────────────────────────────────────────┤
│ 요약 카드     │  ░ 새 할일 입력 (제목 / 마감일 / 카테고리)  │
│  진행 12      │  ────────────────────────────────────────  │
│  완료 8       │  ▌□ 알고리즘 과제   공부  D-2   ⋯ 🗑       │  ← 할일 행
│  완료율 40%   │  ▌■ 헬스장 가기     운동  완료             │  (좌측 색상 막대
│  스트릭 5일   │  ▌□ 기타 연습       취미  D-DAY            │   = 카테고리 색)
│              │  ▌□ 보고서 제출     업무  +1일 지남(빨강)   │
└──────────────┴────────────────────────────────────────────┘
```

- **데스크톱**: 좌측 요약 사이드 + 우측 할일 리스트 2열
- **모바일**: 요약 카드 가로 스크롤 → 그 아래 입력 + 리스트 1열
- 색상 좌측 막대(4px)로 카테고리를 즉시 구분, 우측에 D-day 배지

## 7. 카테고리 & 색상 설계 (3단계 상세)

기본 카테고리(코드 정의, `lib/categories.js`):

| slug | 라벨 | 색상 |
|------|------|------|
| `study` | 공부 | `#2f6df0` (블루) |
| `exercise` | 운동 | `#1a9e54` (그린) |
| `hobby` | 취미 | `#8b5cf6` (퍼플) |
| `work` | 업무 | `#c0392b` (와인레드/액센트) |
| `life` | 생활 | `#d98a0b` (앰버) |
| `etc` | 기타 | `#7a6e58` (뮤트) |

- 사용자 정의 카테고리는 `todo_categories/{uid}` 에 저장, 8색 팔레트에서 선택
- `categoryId` 가 기본 slug 면 코드 색상, 커스텀 id 면 저장된 색상 사용
- 헬퍼: `getCategory(id, customList)` → `{ id, label, color }`

## 8. 통계 & 알림 설계 (4단계 상세)

- **집계 입력**: 본인 `todo_items` 전체 로드 → 클라이언트 집계(`lib/stats.js`)
- **주간**: `completedAt` 을 최근 7일 버킷으로 분류, (완료/그날 마감 또는 생성된 할일) 비율
- **월간**: 최근 6주 주별 완료 개수 추이 + 이번 달 완료율
- **스트릭**: `completedAt` 날짜 집합에서 오늘부터 역순 연속 일수
- **차트**: 막대/도넛 모두 인라인 SVG (반응형 viewBox)
- **알림 판정**: `dueDate` 가 오늘~`notifyLeadHours` 내 또는 지남 → "임박/지연" 분류

## 9. 배포

- **라이브 URL**: https://altrotodo.vercel.app  (Vercel · production, READY)
- 빌드 검증: `npm run build` 통과 (`/`, `/login`, `/categories`, `/stats`, `/settings`, `/api/notify`)
- 환경변수: Firebase 7종 + NOTIFY_FROM_EMAIL 을 Vercel production 에 등록 (RESEND_API_KEY 는 선택). 비밀값은 `.env.local`(git 제외)·Vercel 설정에만 보관

### ⚠️ 남은 1단계 수동 작업 — Firebase 규칙 게시
공용 DB(`cozyboard-9fb1a`)에 아직 `todo_*` 규칙이 없어, 게시 전에는 데이터 저장/조회가 거부됩니다(앱은 graceful degrade — 빈 목록).
1. Firebase 콘솔 → Realtime Database → **규칙(Rules)** 탭
2. 이 저장소의 `database.rules.json` **전체 내용**을 붙여넣기 (기존 board/shop 규칙 포함되어 있어 그대로 덮어쓰면 됨)
3. **게시(Publish)** → 끝. 이후 로그인/할일 추가/완료/통계가 모두 동작합니다.

## 10. 개발 단계 (4단계 분할 — 절대 스킵 없이 진행)

- ✅ **1단계**: 할일 관리 계획서 (본 문서) — 기능 정의 / DB 설계 / 화면 레이아웃 + 프로젝트 스캐폴딩
- ✅ **2단계**: 할일 CRUD 기본 기능 구현 및 배포 (로그인 · 추가/완료/삭제 · 마감일) — Vercel 배포 완료
- ✅ **3단계**: 카테고리·마감일 기능 (기본 6색 + 커스텀 카테고리 관리 · D-day 배지 · 지연 강조)
- ✅ **4단계**: 완료 통계 차트 + 알림 (완료율 도넛 · 주간/월간 막대 차트 · 카테고리별 완료율 · 스트릭 · 인앱 벨/브라우저/이메일 알림)
