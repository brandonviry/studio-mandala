import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { App, type AppProps } from './App';

export function bootstrapEditor(container: HTMLElement, props: AppProps = {}): Root {
  const root = createRoot(container);
  root.render(<App {...props} />);
  return root;
}
