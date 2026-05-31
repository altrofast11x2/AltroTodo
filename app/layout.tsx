import './globals.css';
import NavBar from './components/NavBar';
import NotifyManager from './components/NotifyManager';

export const metadata = {
  title: 'AltroTodo — 할일 관리',
  description: 'AltroTodo — 카테고리·마감일로 정리하는 나만의 할일 관리',
};

// 페인트 전에 테마를 적용해 깜빡임(FOUC) 방지
const themeInit = `(function(){try{var t=localStorage.getItem('altrotodo_theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body suppressHydrationWarning>
        <NavBar />
        <NotifyManager />
        {children}
        <footer className="bj-footer">
          AltroTodo — 오늘 할 일을 가볍게 정리하세요<br />
          AltroBoard 통합 계정으로 로그인됩니다
        </footer>
      </body>
    </html>
  );
}
