import { HashRouter, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import { Layout } from './Layout.tsx';
import { Home } from './Home.tsx';
import { ChapterPage } from './ChapterPage.tsx';

const PlaygroundPage = lazy(() => import('./PlaygroundPage.tsx'));
const ReferencePage = lazy(() => import('./ReferencePage.tsx'));

export function App() {
  return (
    <HashRouter root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/ch/:slug" component={ChapterPage} />
      <Route path="/playground" component={PlaygroundPage} />
      <Route path="/reference/:page" component={ReferencePage} />
      <Route path="*" component={Home} />
    </HashRouter>
  );
}
