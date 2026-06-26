import { escapeSvgText, numberLabel, paddedRange } from "../shared/svg";
import type { CrossSectionInstrument, CrossSectionPoint, CrossSectionSeries, CrossSectionViewOptions } from "./types";

const colors = ["#2563eb", "#16a34a", "#7c3aed", "#dc2626"];

export class CrossSectionView {
  private options: CrossSectionViewOptions;

  constructor(
    private readonly container: HTMLElement,
    options: CrossSectionViewOptions
  ) {
    this.options = options;
    this.render();
  }

  updateOptions(options: Partial<CrossSectionViewOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  updateData(series: CrossSectionSeries[]): void {
    this.updateOptions({ series });
  }

  resize(): void {
    this.render();
  }

  destroy(): void {
    this.container.innerHTML = "";
  }

  private render(): void {
    this.container.innerHTML = toCrossSectionSvg(this.options, widthOf(this.container, this.options), this.options.height ?? 320);
  }
}

export function toCrossSectionSvg(options: CrossSectionViewOptions, width = 720, height = 320): string {
  const title = options.title ?? "Cross-section";
  const series = options.series.map((item) => ({ ...item, points: item.points.filter(isFinitePoint) }));
  const points = series.flatMap((item) => item.points);
  const instruments = (options.instruments ?? []).filter(isFiniteInstrument);
  const xRange = paddedRange([
    ...points.map((point) => point.distance),
    ...instruments.map((instrument) => instrument.distance)
  ]);
  const yRange = paddedRange([
    ...points.map((point) => point.elevation),
    ...instruments.flatMap((instrument) => [
      instrument.elevation ?? Number.NaN,
      instrument.depth === undefined || instrument.elevation === undefined ? Number.NaN : instrument.elevation - instrument.depth
    ])
  ]);

  if (!xRange || !yRange) return emptySvg(width, height, title);

  const left = 56;
  const right = 18;
  const top = 32;
  const bottom = 42;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const x = (distance: number) => left + ((distance - xRange.min) / (xRange.max - xRange.min)) * plotWidth;
  const y = (elevation: number) => top + ((yRange.max - elevation) / (yRange.max - yRange.min)) * plotHeight;
  const xTicks = ticks(xRange.min, xRange.max);
  const yTicks = ticks(yRange.min, yRange.max);

  return `<svg role="img" aria-label="${escapeSvgText(title)}" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${left}" y="20" fill="#111827" font-size="14" font-family="system-ui, sans-serif">${escapeSvgText(title)}</text>
  <g stroke="#e5e7eb" stroke-width="1">
    ${xTicks.map((tick) => `<line x1="${x(tick)}" y1="${top}" x2="${x(tick)}" y2="${top + plotHeight}"/>`).join("")}
    ${yTicks.map((tick) => `<line x1="${left}" y1="${y(tick)}" x2="${left + plotWidth}" y2="${y(tick)}"/>`).join("")}
  </g>
  <rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#9ca3af"/>
  ${series
    .map((item, index) => {
      const path = item.points.map((point) => `${x(point.distance).toFixed(1)},${y(point.elevation).toFixed(1)}`).join(" ");
      if (!path) return "";
      const color = item.color ?? colors[index % colors.length]!;
      return `<polyline points="${path}" fill="none" stroke="${escapeSvgText(color)}" stroke-width="2"/><text x="${left + 8}" y="${top + 18 + index * 16}" fill="${escapeSvgText(color)}" font-size="11" font-family="system-ui, sans-serif">${escapeSvgText(item.label)}</text>`;
    })
    .join("")}
  ${instruments.map((instrument) => renderInstrument(instrument, x, y, top, plotHeight)).join("")}
  ${xTicks
    .map(
      (tick) =>
        `<text x="${x(tick)}" y="${height - 18}" text-anchor="middle" fill="#4b5563" font-size="10" font-family="system-ui, sans-serif">${numberLabel(tick)}</text>`
    )
    .join("")}
  ${yTicks
    .map(
      (tick) =>
        `<text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end" fill="#4b5563" font-size="10" font-family="system-ui, sans-serif">${numberLabel(tick)}</text>`
    )
    .join("")}
  <text x="${left + plotWidth / 2}" y="${height - 4}" text-anchor="middle" fill="#4b5563" font-size="11" font-family="system-ui, sans-serif">${escapeSvgText(options.xLabel ?? "Distance")}</text>
  <text x="14" y="${top + plotHeight / 2}" transform="rotate(-90 14 ${top + plotHeight / 2})" text-anchor="middle" fill="#4b5563" font-size="11" font-family="system-ui, sans-serif">${escapeSvgText(options.yLabel ?? "Elevation")}</text>
</svg>`;
}

function renderInstrument(
  instrument: CrossSectionInstrument,
  x: (distance: number) => number,
  y: (elevation: number) => number,
  top: number,
  plotHeight: number
): string {
  const ix = x(instrument.distance);
  const topElevation = instrument.elevation;
  const iy = topElevation === undefined ? top : y(topElevation);
  const bottomY = topElevation === undefined || instrument.depth === undefined ? top + plotHeight : y(topElevation - instrument.depth);
  return `<g>
    <line x1="${ix}" y1="${iy}" x2="${ix}" y2="${bottomY}" stroke="#111827" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle cx="${ix}" cy="${iy}" r="4" fill="#111827"/>
    <text x="${ix + 6}" y="${Math.max(12, iy - 6)}" fill="#111827" font-size="10" font-family="system-ui, sans-serif">${escapeSvgText(instrument.label)}</text>
  </g>`;
}

function emptySvg(width: number, height: number, title: string): string {
  return `<svg role="img" aria-label="${escapeSvgText(title)}" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#ffffff"/><text x="20" y="32" fill="#6b7280" font-size="13" font-family="system-ui, sans-serif">No data</text></svg>`;
}

function ticks(min: number, max: number): number[] {
  const step = (max - min) / 4;
  return Array.from({ length: 5 }, (_, index) => min + step * index);
}

function isFinitePoint(point: CrossSectionPoint): boolean {
  return Number.isFinite(point.distance) && Number.isFinite(point.elevation);
}

function isFiniteInstrument(instrument: CrossSectionInstrument): boolean {
  return Number.isFinite(instrument.distance);
}

function widthOf(container: HTMLElement, options: CrossSectionViewOptions): number {
  return options.width ?? Math.max(container.clientWidth || 720, 320);
}
