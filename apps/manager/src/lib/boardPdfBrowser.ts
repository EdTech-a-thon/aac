import { jsPDF } from 'jspdf';
import { symbolUrl } from './auth';
import { pdfFilename, pdfPageLayout, type PdfBoard } from './boardPdf';
import { contrastingTextColor } from './fitzgeraldColors';

function loadSymbol(digest: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		const timeout = setTimeout(() => finish(new Error('A picture timed out. Please try exporting again.')), 15000);
		function finish(error?: Error) {
			clearTimeout(timeout);
			image.onload = null;
			image.onerror = null;
			if (error) reject(error);
			else resolve(image);
		}
		image.crossOrigin = 'anonymous';
		image.onload = () => finish();
		image.onerror = () => finish(new Error('A picture could not be loaded. Please try exporting again.'));
		image.src = symbolUrl(digest);
	});
}

function labelLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/\s+/)) {
			const candidate = line ? `${line} ${word}` : word;
			if (ctx.measureText(candidate).width <= width) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = '';
			for (const char of word) {
				if (line && ctx.measureText(line + char).width > width) {
					lines.push(line);
					line = '';
				}
				line += char;
			}
		}
		lines.push(line);
	}
	return lines;
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, fontSize: number) {
	let size = fontSize;
	let lines: string[];
	do {
		ctx.font = `500 ${size}px system-ui, sans-serif`;
		lines = labelLines(ctx, text, width);
		if (lines.length * size * 1.2 <= height || size <= fontSize / 3) break;
		size *= 0.9;
	} while (true);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, width, height);
	ctx.clip();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	lines.forEach((line, index) => ctx.fillText(line, x + width / 2, y + height / 2 + (index - (lines.length - 1) / 2) * size * 1.2));
	ctx.restore();
}

/** Render one page at a time so a vocabulary does not retain a canvas per board. */
export async function downloadBoardPdf(boards: PdfBoard[], name: string): Promise<void> {
	if (!boards.length) throw new Error('There are no boards to export.');
	await document.fonts.ready;
	let pdf: jsPDF | undefined;
	for (const board of boards) {
		const layout = pdfPageLayout(board);
		const images = new Map<string, HTMLImageElement>();
		for (const cell of board.cells) {
			if (cell.symbol && !images.has(cell.symbol)) images.set(cell.symbol, await loadSymbol(cell.symbol));
		}
		const canvas = document.createElement('canvas');
		canvas.width = layout.width;
		canvas.height = layout.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Your browser could not create the PDF image.');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#0f172a';
		drawLabel(ctx, board.name, 80, 40, canvas.width - 160, 80, 40);
		const cells = new Map(board.cells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
		const size = layout.pitch - layout.gap;
		for (let row = 0; row < board.height; row++) {
			for (let col = 0; col < board.width; col++) {
				const cell = cells.get(`${row}:${col}`);
				const x = layout.left + col * layout.pitch + layout.gap / 2;
				const y = layout.top + row * layout.pitch + layout.gap / 2;
				ctx.beginPath();
				ctx.roundRect(x, y, size, size, size * 0.08);
				ctx.fillStyle = cell?.color ?? '#f1f5f9';
				ctx.fill();
				if (!cell) continue;
				ctx.strokeStyle = '#cbd5e1';
				ctx.lineWidth = Math.max(1, size * 0.006);
				ctx.stroke();
				ctx.fillStyle = contrastingTextColor(cell.color);
				const image = cell.symbol ? images.get(cell.symbol) : null;
				const inset = size * 0.04;
				drawLabel(ctx, cell.label, x + inset, y + inset, size - inset * 2, image ? size * 0.2 : size - inset * 2, size * (image ? 0.12 : 0.14));
				if (image) {
					const availableWidth = size - inset * 2;
					const availableHeight = size * 0.72;
					const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
					const width = image.naturalWidth * scale;
					const height = image.naturalHeight * scale;
					ctx.drawImage(image, x + (size - width) / 2, y + size * 0.24 + (availableHeight - height) / 2, width, height);
				}
			}
		}
		const orientation = layout.landscape ? 'landscape' : 'portrait';
		if (!pdf) pdf = new jsPDF({ orientation, unit: 'in', format: 'letter', compress: true });
		else pdf.addPage('letter', orientation);
		pdf.addImage(canvas, 'PNG', 0, 0, layout.width / 200, layout.height / 200);
		canvas.width = 0;
		canvas.height = 0;
	}
	pdf!.setProperties({ title: name });
	pdf!.save(pdfFilename(name));
}
