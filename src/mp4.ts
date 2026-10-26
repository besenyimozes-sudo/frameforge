/**
 * Browser-only MP4 box reader / fast-start rewriter.
 *
 * This does NOT transcode media. It parses ISO BMFF box boundaries and moves
 * the existing `moov` box before media data, updating chunk offsets (`stco`
 * and `co64`) by the exact relocation delta. Compressed audio/video sample
 * bytes remain unchanged.
 *
 * It intentionally refuses malformed/unsupported layouts rather than guessing.
 */
export type Mp4Info = {
  fileSize: number;
  durationSeconds: number | null;
  brands: string[];
  topLevelBoxes: { type: string; size: number; offset: number }[];
  moovBeforeMdat: boolean;
  videoCodecs: string[];
  audioCodecs: string[];
  width?: number;
  height?: number;
  hasStco: boolean;
  hasCo64: boolean;
};

type Box = { type: string; start: number; size: number; header: number; end: number };

const readU32 = (v: DataView, p: number) => v.getUint32(p, false);
const readU64 = (v: DataView, p: number): number => {
  const hi = v.getUint32(p, false), lo = v.getUint32(p + 4, false);
  const n = hi * 4294967296 + lo;
  if (!Number.isSafeInteger(n)) throw new Error('This MP4 uses a box larger than JavaScript can safely address.');
  return n;
};
const fourcc = (v: DataView, p: number) =>
  String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));

function boxes(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p < end) {
    if (end - p < 8) throw new Error(`Malformed MP4: incomplete box header at byte ${p}.`);
    const n32 = readU32(view, p), type = fourcc(view, p + 4);
    let size = n32, header = 8;
    if (n32 === 1) {
      if (end - p < 16) throw new Error(`Malformed MP4: incomplete extended header for ${type}.`);
      size = readU64(view, p + 8); header = 16;
    } else if (n32 === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) {
      throw new Error(`Malformed MP4: invalid ${type} box size at byte ${p}.`);
    }
    out.push({ type, start: p, size, header, end: p + size });
    p += size;
    if (n32 === 0 && p !== end) throw new Error('Malformed MP4: size-zero box is not the final box.');
  }
  return out;
}

function childBoxes(view: DataView, box: Box): Box[] {
  return boxes(view, box.start + box.header, box.end);
}
function findOne(list: Box[], type: string): Box | undefined {
  return list.find(b => b.type === type);
}
function fullBoxVersion(view: DataView, b: Box): number {
  if (b.start + b.header + 4 > b.end) throw new Error(`Malformed ${b.type} full box.`);
  return view.getUint8(b.start + b.header);
}
function codecFromEntry(type: string): string {
  return type;
}

export function inspectMp4(buffer: ArrayBuffer): Mp4Info {
  const view = new DataView(buffer);
  const top = boxes(view, 0, buffer.byteLength);
  const ftyp = findOne(top, 'ftyp');
  const moov = findOne(top, 'moov');
  const mdat = findOne(top, 'mdat');
  if (!ftyp || !moov || !mdat) throw new Error('This file does not look like a supported MP4: expected ftyp, moov and mdat boxes.');
  const brands: string[] = [];
  for (let p = ftyp.start + ftyp.header; p + 4 <= ftyp.end; p += 4) brands.push(fourcc(view, p));
  const mvhd = findOne(childBoxes(view, moov), 'mvhd');
  let durationSeconds: number | null = null;
  if (mvhd) {
    const p = mvhd.start + mvhd.header, version = fullBoxVersion(view, mvhd);
    if (version === 0 && p + 20 <= mvhd.end) {
      const timescale = readU32(view, p + 12), duration = readU32(view, p + 16);
      if (timescale) durationSeconds = duration / timescale;
    } else if (version === 1 && p + 32 <= mvhd.end) {
      const timescale = readU32(view, p + 20), duration = readU64(view, p + 24);
      if (timescale) durationSeconds = duration / timescale;
    }
  }

  const videoCodecs: string[] = [], audioCodecs: string[] = [];
  let width: number | undefined, height: number | undefined, hasStco = false, hasCo64 = false;
  const walk = (b: Box) => {
    if (b.type === 'stco') hasStco = true;
    if (b.type === 'co64') hasCo64 = true;
    if (['avc1','avc3','hvc1','hev1','av01','vp09','mp4v'].includes(b.type)) videoCodecs.push(codecFromEntry(b.type));
    if (['mp4a','ac-3','ec-3','Opus','fLaC'].includes(b.type)) audioCodecs.push(codecFromEntry(b.type));
    // Visual sample entry fixed fields begin after 8-byte box header + 6 reserved + 2 data ref.
    if (['avc1','avc3','hvc1','hev1','av01','vp09','mp4v'].includes(b.type)) {
      const p = b.start + b.header + 24;
      if (p + 4 <= b.end) { width ??= view.getUint16(p, false); height ??= view.getUint16(p + 2, false); }
    }
    if (['moov','trak','mdia','minf','stbl','edts','dinf','mvex','moof','traf','mfra'].includes(b.type)) {
      for (const c of childBoxes(view, b)) walk(c);
    } else if (['stsd'].includes(b.type)) {
      // stsd is a full box + entry count before sample entries.
      const p = b.start + b.header + 8;
      if (p < b.end) for (const c of boxes(view, p, b.end)) walk(c);
    }
  };
  walk(moov);
  return {
    fileSize: buffer.byteLength, durationSeconds, brands,
    topLevelBoxes: top.map(b => ({ type: b.type, size: b.size, offset: b.start })),
    moovBeforeMdat: moov.start < mdat.start, videoCodecs: [...new Set(videoCodecs)],
    audioCodecs: [...new Set(audioCodecs)], width, height, hasStco, hasCo64
  };
}

function writeU32(view: DataView, p: number, n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Chunk offset exceeds the stco 32-bit limit.');
  view.setUint32(p, n, false);
}
function writeU64(view: DataView, p: number, n: number) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Chunk offset exceeds safe 64-bit JavaScript range.');
  view.setUint32(p, Math.floor(n / 4294967296), false);
  view.setUint32(p + 4, n >>> 0, false);
}

function adjustOffsets(moovBytes: Uint8Array, delta: number): void {
  const view = new DataView(moovBytes.buffer, moovBytes.byteOffset, moovBytes.byteLength);
  const root = boxes(view, 0, moovBytes.byteLength);
  const walk = (b: Box) => {
    if (b.type === 'stco' || b.type === 'co64') {
      const p = b.start + b.header;
      if (p + 8 > b.end) throw new Error(`Malformed ${b.type} box.`);
      const count = readU32(view, p + 4);
      const width = b.type === 'stco' ? 4 : 8;
      if (p + 8 + count * width > b.end) throw new Error(`Malformed ${b.type}: entry count exceeds box size.`);
      for (let i = 0; i < count; i++) {
        const at = p + 8 + i * width;
        if (b.type === 'stco') writeU32(view, at, readU32(view, at) + delta);
        else writeU64(view, at, readU64(view, at) + delta);
      }
      return;
    }
    if (['moov','trak','mdia','minf','stbl','edts','dinf','mvex'].includes(b.type)) {
      for (const c of childBoxes(view, b)) walk(c);
    } else if (b.type === 'stsd') {
      const p = b.start + b.header + 8;
      if (p < b.end) for (const c of boxes(view, p, b.end)) walk(c);
    }
  };
  for (const b of root) walk(b);
}

/**
 * Reorders the `moov` box ahead of `mdat`. Relocating moov changes absolute
 * media chunk offsets, so the function patches all stco/co64 entries inside it.
 * This implementation requires the common layout ftyp + other boxes + moov + mdat
 * and refuses fragmented MP4 (`moof`) because its offset semantics differ.
 */
export function fastStartMp4(buffer: ArrayBuffer): { blob: Blob; changed: boolean; note: string } {
  const view = new DataView(buffer);
  const top = boxes(view, 0, buffer.byteLength);
  if (top.some(b => b.type === 'moof')) throw new Error('Fragmented MP4 (moof) is not supported by this fast-start patcher.');
  const moov = findOne(top, 'moov'), mdat = findOne(top, 'mdat'), ftyp = findOne(top, 'ftyp');
  if (!moov || !mdat || !ftyp) throw new Error('Unsupported MP4 layout: expected ftyp, moov and mdat boxes.');
  if (moov.start < mdat.start) {
    return { blob: new Blob([buffer], { type: 'video/mp4' }), changed: false, note: 'The moov box is already before mdat. No rewrite was needed.' };
  }
  if (top.filter(b => b.type === 'moov').length !== 1 || top.filter(b => b.type === 'mdat').length !== 1) {
    throw new Error('Multiple moov/mdat boxes are not supported by this conservative patcher.');
  }
  // In the supported layout, moov moves to immediately after ftyp. Boxes between
  // ftyp and moov are preserved byte-for-byte and shift right by moov.size.
  const ftypEnd = ftyp.end;
  const mdatBeforeMoov = mdat.start < moov.start;
  if (!mdatBeforeMoov) throw new Error('Unsupported box ordering.');
  const moovBytes = new Uint8Array(buffer.slice(moov.start, moov.end));
  const delta = moov.size;
  adjustOffsets(moovBytes, delta);
  const before = new Uint8Array(buffer.slice(0, ftypEnd));
  const middle = new Uint8Array(buffer.slice(ftypEnd, moov.start));
  const after = new Uint8Array(buffer.slice(moov.end));
  const result = new Uint8Array(buffer.byteLength);
  let p = 0;
  result.set(before, p); p += before.length;
  result.set(moovBytes, p); p += moovBytes.length;
  result.set(middle, p); p += middle.length;
  result.set(after, p);
  // Reparse the output to validate structural boundaries and fast-start ordering.
  const check = inspectMp4(result.buffer);
  if (!check.moovBeforeMdat) throw new Error('Internal validation failed: moov was not moved before mdat.');
  return { blob: new Blob([result], { type: 'video/mp4' }), changed: true,
    note: 'Moved moov before mdat and adjusted stco/co64 chunk offsets. Encoded audio/video sample payloads were not re-encoded.' };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB','MB','GB','TB']; let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}
export function formatTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return 'Unknown';
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}