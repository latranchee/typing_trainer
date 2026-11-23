import { el } from './dom';

/** One typist on the strip: the one at the keys, a ghost of a recorded run, or a racer in the room. */
export interface Lane {
  id: string;
  name: string;
  kind: 'you' | 'ghost' | 'racer';
  /** Characters finished, against the text's length. */
  done: number;
  total: number;
  /** The run's pace, once known: a ghost's recorded one, a racer's at the line. */
  wpm: number | null;
  place: number | null;
  /** A racer joined after the start and waits for the next race. */
  waiting?: boolean;
}

interface Row {
  root: HTMLElement;
  name: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
}

/**
 * Above the text while a fixed text or a race is on: a head line (what is being typed and
 * against whom) and one bar per typist. The bars are rebuilt only when the typists change;
 * progress only moves the fills.
 */
export class Strip {
  readonly root = el('div.strip', { 'aria-live': 'off' });
  private head = el('div.strip-head');
  private list = el('ol.strip-lanes');
  private rows = new Map<string, Row>();
  private order = '';

  constructor() {
    this.root.append(this.head, this.list);
    this.root.hidden = true;
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  get shown(): boolean {
    return !this.root.hidden;
  }

  setHead(...nodes: (Node | string | null)[]): void {
    this.head.replaceChildren(...nodes.filter((node): node is Node | string => node !== null));
  }

  set(lanes: readonly Lane[]): void {
    const order = lanes.map((lane) => `${lane.id}:${lane.kind}`).join('|');
    if (order !== this.order) {
      this.order = order;
      this.rows.clear();
      this.list.replaceChildren(
        ...lanes.map((lane) => {
          const row: Row = {
            root: el('li.lane', { 'data-kind': lane.kind }),
            name: el('span.lane-name'),
            fill: el('span.lane-fill'),
            value: el('span.lane-value'),
          };
          row.root.append(row.name, el('span.lane-track', {}, row.fill), row.value);
          this.rows.set(lane.id, row);
          return row.root;
        }),
      );
    }
    for (const lane of lanes) {
      const row = this.rows.get(lane.id)!;
      if (row.name.textContent !== lane.name) row.name.textContent = lane.name;
      const share = lane.total > 0 ? Math.min(1, lane.done / lane.total) : 0;
      const width = `${(share * 100).toFixed(2)}%`;
      if (row.fill.style.width !== width) row.fill.style.width = width;
      const value = lane.place !== null ? `#${lane.place}${lane.wpm !== null ? ` · ${Math.round(lane.wpm)}` : ''}` : lane.wpm !== null ? String(Math.round(lane.wpm)) : '';
      if (row.value.textContent !== value) row.value.textContent = value;
      row.root.classList.toggle('is-done', share >= 1);
      row.root.classList.toggle('is-waiting', lane.waiting === true);
    }
  }

  clear(): void {
    this.order = '';
    this.rows.clear();
    this.list.replaceChildren();
    this.head.replaceChildren();
  }
}
