import { Route, Routes } from 'react-router-dom';
import { AdminPage } from './AdminPage';
import { JoinPage } from './play/JoinPage';
import { PlayPage } from './play/PlayPage';
import { NotFound } from './site/NotFound';
import { PAGES } from './site/pages';

export function App() {
  return (
    <Routes>
      {/* Public pages (also built as static HTML for search engines). */}
      {PAGES.map((page) => (
        <Route key={page.path} path={page.path} element={page.element} />
      ))}
      {/* The game itself. */}
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
