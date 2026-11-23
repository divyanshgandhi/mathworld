/**
 * A film is a list of steps. Each step enters once, updates every frame with its own clock,
 * and ends after `d` seconds or when `done` says so. The director only sequences; the steps own
 * what happens.
 */
export interface Step {
  name?: string;
  d?: number;
  enter?(): void;
  update?(t: number, dt: number): void;
  done?(t: number): boolean;
}

export class Director<S extends Step> {
  index = -1;
  t = 0;

  constructor(
    readonly steps: S[],
    private hooks: { beforeEnter?(step: S, index: number): void; onEnd?(): void } = {},
  ) {}

  get current(): S | undefined {
    return this.steps[this.index];
  }

  get running() {
    return this.index >= 0 && this.index < this.steps.length;
  }

  go(i: number) {
    this.index = i;
    this.t = 0;
    const s = this.steps[i];
    if (!s) return this.hooks.onEnd?.();
    this.hooks.beforeEnter?.(s, i);
    s.enter?.();
  }

  /** The index of the first step with this name, for chapter jumps. */
  find(name: string) {
    return this.steps.findIndex((s) => s.name === name);
  }

  update(dt: number) {
    const s = this.current;
    if (!s) return;
    this.t += dt;
    s.update?.(this.t, dt);
    if ((s.d !== undefined && this.t >= s.d) || s.done?.(this.t)) this.go(this.index + 1);
  }
}
