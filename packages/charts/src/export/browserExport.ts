export interface ExportImageOptions {
  width?: number;
  height?: number;
  background?: string;
  quality?: number;
}

type ExportCanvas = HTMLCanvasElement | OffscreenCanvas;

export async function canvasToPngBlob(canvas: ExportCanvas): Promise<Blob> {
  return canvasToBlob(canvas, "image/png");
}

export async function canvasToPdfBlob(canvas: ExportCanvas, options: ExportImageOptions = {}): Promise<Blob> {
  const jpeg = await canvasToBlob(canvas, "image/jpeg", options.quality ?? 0.92);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const pdf = createJpegPdf(bytes, options.width ?? canvas.width, options.height ?? canvas.height);
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function svgToPngBlob(svg: SVGSVGElement | string, options: ExportImageOptions = {}): Promise<Blob> {
  const canvas = await svgToCanvas(svg, options);
  return canvasToPngBlob(canvas);
}

export async function svgToPdfBlob(svg: SVGSVGElement | string, options: ExportImageOptions = {}): Promise<Blob> {
  const canvas = await svgToCanvas(svg, options);
  return canvasToPdfBlob(canvas, options);
}

export function createJpegPdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`;
  const objects: Uint8Array[][] = [
    [text("<< /Type /Catalog /Pages 2 0 R >>")],
    [text("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")],
    [
      text(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
      )
    ],
    [text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)],
    [
      text(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      text("\nendstream")
    ]
  ];
  return writePdf(objects);
}

async function canvasToBlob(canvas: ExportCanvas, type: string, quality?: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, ...(quality === undefined ? {} : { quality }) });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`Could not export ${type}`))), type, quality);
  });
}

async function svgToCanvas(svg: SVGSVGElement | string, options: ExportImageOptions): Promise<HTMLCanvasElement> {
  const text = typeof svg === "string" ? svg : new XMLSerializer().serializeToString(svg);
  const width = options.width ?? (typeof svg === "string" ? 800 : svg.viewBox.baseVal.width || svg.clientWidth || 800);
  const height = options.height ?? (typeof svg === "string" ? 600 : svg.viewBox.baseVal.height || svg.clientHeight || 600);
  const image = await loadImage(new Blob([text], { type: "image/svg+xml" }));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create canvas context");
  context.fillStyle = options.background ?? "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load SVG image"));
    };
    image.src = url;
  });
}

function writePdf(objects: Uint8Array[][]): Uint8Array {
  const chunks: Uint8Array[] = [text("%PDF-1.4\n")];
  const offsets: number[] = [];
  let offset = chunks[0]!.length;

  objects.forEach((object, index) => {
    offsets.push(offset);
    const header = text(`${index + 1} 0 obj\n`);
    chunks.push(header);
    offset += header.length;
    for (const chunk of object) {
      chunks.push(chunk);
      offset += chunk.length;
    }
    const footer = text("\nendobj\n");
    chunks.push(footer);
    offset += footer.length;
  });

  const xrefOffset = offset;
  const xref = text(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((item) => `${String(item).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );
  chunks.push(xref);

  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
