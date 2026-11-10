import type { Candle } from '../game/types';

/** Canvas candlestick chart: one draw call, no DOM node per candle. */
export class CandleChart {
  private candles: Candle[] = [];
  private live: Candle | null = null;
  private zoom = 1;
  private offset = 0;
  private drag: { x: number; offset: number } | null = null;
  private pointer: { x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const down = (event: PointerEvent): void => {
      this.drag = { x: event.clientX, offset: this.offset };
      this.canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      this.pointer = { x: event.offsetX, y: event.offsetY };
      if (this.drag) {
        const count = this.visibleCount();
        this.offset = Math.max(0, Math.min(Math.max(0, this.candles.length - count), this.drag.offset + Math.round((event.clientX - this.drag.x) / 7)));
      }
      this.draw();
    };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerleave', () => { this.pointer = null; this.drag = null; this.draw(); });
    this.canvas.addEventListener('pointerup', () => { this.drag = null; });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const before = this.visibleCount();
      this.zoom = Math.max(0.35, Math.min(8, this.zoom * (event.deltaY > 0 ? 1.15 : 0.87)));
      const after = this.visibleCount();
      this.offset = Math.max(0, this.offset + Math.round((before - after) / 2));
      this.draw();
    }, { passive: false });
  }

  setData(candles: Candle[], live: Candle | null): void {
    this.candles = candles;
    this.live = live;
    this.offset = Math.min(this.offset, Math.max(0, this.candles.length - this.visibleCount()));
    this.draw();
  }

  reset(): void {
    this.zoom = 1;
    this.offset = 0;
    this.draw();
  }

  private visibleCount(): number {
    return Math.max(20, Math.round(90 / this.zoom));
  }

  draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.max(300, rect.width || 640);
    const height = Math.max(220, rect.height || 360);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const gutter = 72;
    const top = 16;
    const bottom = 26;
    const plotW = width - gutter;
    const plotH = height - top - bottom;
    const all = this.live ? [...this.candles.filter((c) => c.t !== this.live?.t), this.live] : this.candles;
    const count = this.visibleCount();
    const start = Math.max(0, all.length - count - this.offset);
    const view = all.slice(start, start + count);
    if (!view.length) {
      ctx.fillStyle = 'rgba(120,120,128,.7)';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText('Waiting for server candles…', 18, height / 2);
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const c of view) { min = Math.min(min, c.l); max = Math.max(max, c.h); }
    const pad = Math.max((max - min) * 0.1, max * 0.002, 0.5);
    min -= pad;
    max += pad;
    const xFor = (i: number): number => (i + 0.5) * (plotW / view.length);
    const yFor = (v: number): number => top + (1 - (v - min) / Math.max(0.0001, max - min)) * plotH;
    ctx.strokeStyle = 'rgba(120,120,128,.14)';
    ctx.fillStyle = 'rgba(120,120,128,.78)';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = top + (plotH / 5) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
      const price = max - ((max - min) / 5) * i;
      ctx.fillText(`$${price.toFixed(price < 10 ? 2 : 0)}`, plotW + 8, y + 3);
    }
    const step = Math.max(1, Math.ceil(8 / (plotW / Math.max(1, view.length * 0.8))));
    view.forEach((c, i) => {
      const x = xFor(i);
      const bw = Math.max(2, (plotW / view.length) * 0.66);
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? '#2F9E6F' : '#C0392B';
      ctx.fillStyle = up ? '#2F9E6F' : '#C0392B';
      ctx.beginPath();
      ctx.moveTo(x, yFor(c.h));
      ctx.lineTo(x, yFor(c.l));
      ctx.stroke();
      const y = yFor(Math.max(c.o, c.c));
      const h = Math.max(1, Math.abs(yFor(c.o) - yFor(c.c)));
      ctx.fillRect(x - bw / 2, y, bw, h);
      if (i % step === 0) {
        ctx.fillStyle = 'rgba(120,120,128,.82)';
        ctx.fillText(new Date(c.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x - 12, height - 8);
      }
    });
    const last = view[view.length - 1]!;
    const lastY = yFor(last.c);
    ctx.strokeStyle = 'rgba(242,185,59,.9)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, lastY); ctx.lineTo(plotW, lastY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#F2B93B';
    ctx.fillRect(plotW + 2, lastY - 8, gutter - 4, 16);
    ctx.fillStyle = '#241d14';
    ctx.fillText(`$${last.c.toFixed(last.c < 10 ? 2 : 0)}`, plotW + 7, lastY + 3);
    if (this.pointer && this.pointer.x < plotW) {
      const index = Math.max(0, Math.min(view.length - 1, Math.floor((this.pointer.x / plotW) * view.length)));
      const c = view[index]!;
      ctx.strokeStyle = 'rgba(120,120,128,.6)';
      ctx.beginPath(); ctx.moveTo(xFor(index), 0); ctx.lineTo(xFor(index), plotH + top); ctx.stroke();
      const box = `O ${c.o.toFixed(2)}  H ${c.h.toFixed(2)}  L ${c.l.toFixed(2)}  C ${c.c.toFixed(2)}`;
      ctx.fillStyle = 'rgba(28,24,20,.86)';
      const w = ctx.measureText(box).width + 16;
      ctx.fillRect(Math.min(plotW - w, Math.max(0, xFor(index) + 8)), top + 6, w, 20);
      ctx.fillStyle = '#fff6e4';
      ctx.fillText(box, Math.min(plotW - w + 8, Math.max(8, xFor(index) + 16)), top + 20);
    }
  }
}
