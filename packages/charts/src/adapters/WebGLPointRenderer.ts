import type { RendererAdapter } from "@catmap/core";

export interface WebGLPoint {
  x: number;
  y: number;
}

export interface WebGLPointProjector {
  project(points: readonly WebGLPoint[]): Float32Array;
}

export interface WebGLPointRendererOptions {
  points: readonly WebGLPoint[];
  color?: [number, number, number, number];
  pointSize?: number;
  width?: number;
  height?: number;
  offscreen?: boolean;
  projector?: WebGLPointProjector;
}

type WebGLCanvas = HTMLCanvasElement | OffscreenCanvas;

const vertexShader = `
attribute vec2 a_position;
uniform float u_pointSize;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}`;

const fragmentShader = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}`;

export class WebGLPointRenderer implements RendererAdapter {
  private canvas: WebGLCanvas | undefined;
  private gl: WebGLRenderingContext | undefined;
  private program: WebGLProgram | undefined;

  constructor(private options: WebGLPointRendererOptions) {}

  init(container: HTMLElement): void {
    this.canvas = createCanvas(this.options.width ?? widthOf(container), this.options.height ?? heightOf(container), this.options.offscreen);
    if (this.canvas instanceof HTMLCanvasElement) container.appendChild(this.canvas);
    this.gl = (this.canvas.getContext("webgl") as WebGLRenderingContext | null | undefined) ?? undefined;
    this.program = this.gl ? createProgram(this.gl) : undefined;
    this.render();
  }

  update(options: Partial<WebGLPointRendererOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  render(): void {
    if (!this.gl || !this.program) return;
    const gl = this.gl;
    const positions = this.options.projector?.project(this.options.points) ?? normalizeWebGLPoints(this.options.points);
    const buffer = gl.createBuffer();
    if (!buffer) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(1, 1, 1, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_pointSize"), this.options.pointSize ?? 4);
    gl.uniform4fv(gl.getUniformLocation(this.program, "u_color"), this.options.color ?? [0.15, 0.39, 0.92, 0.9]);
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
    gl.deleteBuffer(buffer);
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  destroy(): void {
    if (this.canvas instanceof HTMLCanvasElement) this.canvas.remove();
    this.canvas = undefined;
    this.gl = undefined;
    this.program = undefined;
  }
}

export function normalizeWebGLPoints(points: readonly WebGLPoint[]): Float32Array {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finite.length === 0) return new Float32Array();
  const minX = Math.min(...finite.map((point) => point.x));
  const maxX = Math.max(...finite.map((point) => point.x));
  const minY = Math.min(...finite.map((point) => point.y));
  const maxY = Math.max(...finite.map((point) => point.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const output = new Float32Array(finite.length * 2);

  finite.forEach((point, index) => {
    output[index * 2] = ((point.x - minX) / spanX) * 2 - 1;
    output[index * 2 + 1] = ((point.y - minY) / spanY) * 2 - 1;
  });

  return output;
}

function createCanvas(width: number, height: number, offscreen = false): WebGLCanvas {
  if (offscreen && typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  if (!vertex || !fragment) return undefined;
  const program = gl.createProgram();
  if (!program) return undefined;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : undefined;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined;
}

function widthOf(container: HTMLElement): number {
  return Math.max(container.clientWidth || 320, 320);
}

function heightOf(container: HTMLElement): number {
  return Math.max(container.clientHeight || 240, 240);
}
