import '@fontsource-variable/roboto-mono';
import './styles/app.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app')!;

// Canvas text needs the face loaded before the first frame is drawn.
document.fonts.load('600 20px "Roboto Mono Variable"').finally(async () => {
  const app = new App(root);
  if (new URLSearchParams(location.search).get('demo') === 'comp') {
    const { compFixture } = await import('./dev/fixture');
    app.applyFixture(compFixture);
  }
});
