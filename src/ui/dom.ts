type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

/** Minimal element builder: `el('button.tab', { type: 'button' }, 'words')`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag as K);
  if (classes.length > 0) node.className = classes.join(' ');
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Add a class for a moment, restarting cleanly if it is already on. */
export function flash(node: Element, className: string, ms: number): void {
  const key = `flash:${className}`;
  const store = node as unknown as Record<string, ReturnType<typeof setTimeout> | undefined>;
  clearTimeout(store[key]);
  node.classList.add(className);
  store[key] = setTimeout(() => node.classList.remove(className), ms);
}

/** Size a canvas backing store to its box at device resolution. Returns the context in CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}
