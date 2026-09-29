import { render } from 'solid-js/web';
import './styles/base.css';
import './styles/layout.css';
import { App } from './app/App.tsx';

render(() => <App />, document.getElementById('root')!);
