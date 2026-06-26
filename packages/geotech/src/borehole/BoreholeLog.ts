import { escapeSvgText, numberLabel } from "../shared/svg";
import type { BoreholeInterval, BoreholeLogOptions } from "./types";

const palette = ["#d6d3d1", "#facc15", "#a3e635", "#93c5fd", "#fca5a5"];

export class BoreholeLog {
  private options: BoreholeLogOptions;

  constructor(
    private readonly container: HTMLElement,
    options: BoreholeLogOptions
  ) {
    this.options = options;
    this.render();
  }

  updateOptions(options: Partial<BoreholeLogOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  updateData(intervals: BoreholeInterval[]): void {
    this.updateOptions({ intervals });
  }

  resize(): void {
    this.render();
  }

  destroy(): void {
    this.container.innerHTML = "";
  }

  private render(): void {
    this.container.innerHTML = toBoreholeSvg(this.options, widthOf(this.container, this.options), this.options.height ?? 420);
  }
}

export function toBoreholeSvg(options: BoreholeLogOptions, width = 360, height = 420): string {
  const intervals = options.intervals.filter(isFiniteInterval);
  const title = options.title ?? options.boreholeId ?? "Borehole log";
  const maxDepth = Math.max(...intervals.map((interval) => interval.to), options.waterLevel ?? 0);
  if (intervals.length === 0 || !Number.isFinite(maxDepth) || maxDepth <= 0) return emptySvg(width, height, title);

  const top = 34;
  const bottom = 32;
  const left = 64;
  const logWidth = Math.min(150, Math.max(90, width - 190));
  const plotHeight = Math.max(1, height - top - bottom);
  const depthY = (depth: number) => top + (depth / maxDepth) * plotHeight;
  const ticks = depthTicks(maxDepth);

  return `<svg role="img" aria-label="${escapeSvgText(title)}" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${left}" y="20" fill="#111827" font-size="14" font-family="system-ui, sans-serif">${escapeSvgText(title)}</text>
  <g stroke="#e5e7eb">
    ${ticks.map((tick) => `<line x1="${left - 8}" y1="${depthY(tick)}" x2="${left + logWidth}" y2="${depthY(tick)}"/>`).join("")}
  </g>
  <rect x="${left}" y="${top}" width="${logWidth}" height="${plotHeight}" fill="none" stroke="#9ca3af"/>
  ${intervals
    .map((interval, index) => {
      const y = depthY(interval.from);
      const h = Math.max(1, depthY(interval.to) - y);
      const color = interval.color ?? palette[index % palette.length]!;
      return `<g>
        <rect x="${left}" y="${y}" width="${logWidth}" height="${h}" fill="${escapeSvgText(color)}" stroke="#ffffff"/>
        <text x="${left + logWidth + 10}" y="${y + Math.max(10, Math.min(16, h - 3))}" fill="#111827" font-size="11" font-family="system-ui, sans-serif">${escapeSvgText(interval.label)}</text>
      </g>`;
    })
    .join("")}
  ${
    options.waterLevel === undefined || !Number.isFinite(options.waterLevel)
      ? ""
      : `<line x1="${left}" y1="${depthY(options.waterLevel)}" x2="${left + logWidth}" y2="${depthY(options.waterLevel)}" stroke="#2563eb" stroke-width="2"/><text x="${left + logWidth + 10}" y="${depthY(options.waterLevel) - 4}" fill="#2563eb" font-size="11" font-family="system-ui, sans-serif">Water ${numberLabel(options.waterLevel)} ${escapeSvgText(options.depthUnit ?? "m")}</text>`
  }
  ${ticks
    .map(
      (tick) =>
        `<text x="${left - 12}" y="${depthY(tick) + 3}" text-anchor="end" fill="#4b5563" font-size="10" font-family="system-ui, sans-serif">${numberLabel(tick)}</text>`
    )
    .join("")}
  <text x="14" y="${top + plotHeight / 2}" transform="rotate(-90 14 ${top + plotHeight / 2})" text-anchor="middle" fill="#4b5563" font-size="11" font-family="system-ui, sans-serif">Depth (${escapeSvgText(options.depthUnit ?? "m")})</text>
</svg>`;
}

function emptySvg(width: number, height: number, title: string): string {
  return `<svg role="img" aria-label="${escapeSvgText(title)}" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#ffffff"/><text x="20" y="32" fill="#6b7280" font-size="13" font-family="system-ui, sans-serif">No data</text></svg>`;
}

function depthTicks(maxDepth: number): number[] {
  const step = maxDepth / 4;
  return Array.from({ length: 5 }, (_, index) => step * index);
}

function isFiniteInterval(interval: BoreholeInterval): boolean {
  return Number.isFinite(interval.from) && Number.isFinite(interval.to) && interval.to > interval.from;
}

function widthOf(container: HTMLElement, options: BoreholeLogOptions): number {
  return options.width ?? Math.max(container.clientWidth || 360, 260);
}
