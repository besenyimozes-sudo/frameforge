import { useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, Check, ChevronDown,
  CircleHelp, Clapperboard, FileVideo2, Film, Gauge, HardDrive, LockKeyhole,
  Menu, Play, RotateCcw, ShieldCheck, Sparkles, Upload, X, Zap
} from 'lucide-react';
import { fastStartMp4, formatBytes, formatTime, inspectMp4, type Mp4Info } from './mp4';

type Result = { name: string; blob: Blob; info: Mp4Info; changed: boolean; note: string };
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<Mp4Info | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'optimizer'|'guide'|'faq'>('optimizer');

  async function choose(f?: File) {
    if (!f) return;
    setError(''); setResult(null); setInfo(null);
    if (!/\.(mp4|m4v)$/i.test(f.name) && f.type !== 'video/mp4') {
      setFile(null); setError('Please choose an MP4/M4V file. MOV and HEVC-in-MOV are not accepted by this MP4-only patcher.'); return;
    }
    setFile(f); setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const parsed = inspectMp4(buf);
      setInfo(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not inspect this file.');
      setFile(null);
    } finally { setBusy(false); }
  }

  async function optimize() {
    if (!file || !info) return;
    setBusy(true); setError(''); setResult(null);
    // Let React paint the processing state before reading and patching a large file.
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      const buffer = await file.arrayBuffer();
      const patched = fastStartMp4(buffer);
      const validated = inspectMp4(await patched.blob.arrayBuffer());
      setResult({ name: file.name.replace(/\.(mp4|m4v)$/i, '') + '-frameforge.mp4',
        blob: patched.blob, info: validated, changed: patched.changed, note: patched.note });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimization failed.');
    } finally { setBusy(false); }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a'); a.href = url; a.download = result.name;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function reset() { setFile(null); setInfo(null); setResult(null); setError(''); if (inputRef.current) inputRef.current.value = ''; }
  const currentInfo = result?.info ?? info;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setActiveTab('optimizer'); }}>
        <span className="brand-mark"><Clapperboard size={19} strokeWidth={2.5}/></span>
        <span>frame<span className="brand-accent">forge</span></span>
        <span className="beta">BETA</span>
      </a>
      <nav className="nav-links">
        <button className={activeTab === 'optimizer' ? 'nav-active' : ''} onClick={() => setActiveTab('optimizer')}>Optimizer</button>
        <button className={activeTab === 'guide' ? 'nav-active' : ''} onClick={() => setActiveTab('guide')}>How it works</button>
        <button className={activeTab === 'faq' ? 'nav-active' : ''} onClick={() => setActiveTab('faq')}>FAQ</button>
      </nav>
      <div className="header-right"><span className="local-pill"><span className="green-dot"/> 100% local processing</span><a className="github-link" href="https://vercel.com" target="_blank" rel="noreferrer">Deploy <ArrowRight size={14}/></a></div>
    </header>

    <main>
      {activeTab === 'optimizer' && <>
        <section className="hero">
          <div className="eyebrow"><Sparkles size={14}/> YOUR VIDEO, WITHOUT THE EXTRA RE-ENCODE</div>
          <h1>Keep the quality.<br/><span>Skip the busywork.</span></h1>
          <p className="hero-copy">A little MP4 housekeeping can make a big difference to playback startup. Prepare your video right in your browser — no uploads, no re-encoding.</p>
          <div className="trust-row">
            <span><LockKeyhole size={15}/> Files stay on your device</span>
            <i/>
            <span><Zap size={15}/> Stream-copy processing</span>
            <i/>
            <span><ShieldCheck size={15}/> No account required</span>
          </div>
        </section>

        <section className="workspace">
          <div className="workspace-heading">
            <div><span className="step-label">01 / INPUT</span><h2>Prepare your video</h2></div>
            <span className="format-label"><FileVideo2 size={15}/> MP4 only</span>
          </div>
          {!file ? <div className={`dropzone ${dragging ? 'dropzone-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void choose(e.dataTransfer.files[0]); }}>
            <input ref={inputRef} type="file" accept=".mp4,.m4v,video/mp4" hidden onChange={e => void choose(e.target.files?.[0])}/>
            <div className="upload-icon"><Upload size={24}/></div>
            <h3>Drop your video here</h3>
            <p>or browse files from your device</p>
            <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={16}/> Choose a video</button>
            <div className="drop-foot"><span><Check size={13}/> MP4 / M4V containers</span><span><Check size={13}/> Runs locally</span><span><Check size={13}/> Original stays untouched</span></div>
          </div> : <div className="file-panel">
            <div className="file-icon"><Film size={24}/></div>
            <div className="file-main"><strong>{file.name}</strong><span>{formatBytes(file.size)} · Added {fmtDate(new Date())}</span></div>
            <span className="file-status"><BadgeCheck size={15}/> {info ? 'Inspected' : 'Reading file'}</span>
            <button className="icon-button" aria-label="Remove file" onClick={reset}><X size={17}/></button>
          </div>}

          {error && <div className="error-banner"><CircleHelp size={17}/><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}

          {info && <div className="inspection">
            <div className="inspection-title"><span className="step-label">FILE INSPECTION</span><span className="mini-tag"><Check size={12}/> Structure readable</span></div>
            <div className="stat-grid">
              <div className="stat"><span>Resolution</span><strong>{info.width && info.height ? `${info.width} × ${info.height}` : 'Not detected'}</strong></div>
              <div className="stat"><span>Duration</span><strong>{formatTime(info.durationSeconds)}</strong></div>
              <div className="stat"><span>Video codec</span><strong>{info.videoCodecs.join(', ') || 'Not detected'}</strong></div>
              <div className="stat"><span>Audio codec</span><strong>{info.audioCodecs.join(', ') || 'Not detected'}</strong></div>
            </div>
            <div className="box-status"><span className={`status-indicator ${info.moovBeforeMdat ? 'status-good' : 'status-warn'}`}/><div><strong>{info.moovBeforeMdat ? 'Fast-start metadata already in place' : 'Metadata can be moved for fast start'}</strong><p>{info.moovBeforeMdat ? 'The moov box already precedes media data. The optimizer will preserve the file as-is.' : 'The moov box follows media data. We can move it and update media chunk offsets without re-encoding.'}</p></div></div>
            <div className="box-list">{info.topLevelBoxes.map((b, i) => <div key={`${b.type}-${i}`}><code>{b.type}</code><span>{formatBytes(b.size)}</span></div>)}</div>
          </div>}

          {info && !result && <div className="action-row"><button className="text-button" onClick={reset}><RotateCcw size={15}/> Choose another</button><button className="primary-button action-primary" disabled={busy} onClick={() => void optimize()}>{busy ? <><span className="spinner"/> Processing…</> : <><Zap size={16}/> {info.moovBeforeMdat ? 'Validate & prepare file' : 'Optimize MP4'} <ArrowRight size={16}/></>}</button></div>}

          {result && <div className="result-panel">
            <div className="result-heading"><span className="result-check"><Check size={20}/></span><div><h3>Your file is ready</h3><p>{result.changed ? 'Fast-start metadata reordered successfully.' : 'Your file was already fast-start optimized.'}</p></div></div>
            <div className="result-file"><FileVideo2 size={22}/><div><strong>{result.name}</strong><span>{formatBytes(result.blob.size)} · {formatTime(result.info.durationSeconds)}</span></div><span className="mini-tag"><Check size={12}/> Validated</span></div>
            <div className="success-note"><Check size={15}/>{result.note}</div>
            <button className="primary-button download-button" onClick={download}><ArrowDownToLine size={17}/> Download optimized MP4</button>
            <button className="text-button centered" onClick={reset}><RotateCcw size={14}/> Process another video</button>
          </div>}
        </section>
        <section className="disclaimer"><div className="disclaimer-icon"><Activity size={19}/></div><div><strong>What this does — and what it doesn't</strong><p>FrameForge changes MP4 container layout for fast-start playback. It does not sharpen video, increase bitrate, or bypass a platform's transcoding. TikTok and other services may still recompress uploads; any improvement in posted quality is unverified and not guaranteed.</p></div></section>
        <section className="feature-grid">
          <article><div className="feature-icon purple"><LockKeyhole size={19}/></div><h3>Private by design</h3><p>Your selected video is read and processed in this browser tab. There is no video upload endpoint in this app.</p></article>
          <article><div className="feature-icon blue"><Gauge size={19}/></div><h3>No quality re-encode</h3><p>The fast-start patch moves metadata and adjusts chunk offsets. Encoded media samples are copied as-is.</p></article>
          <article><div className="feature-icon orange"><HardDrive size={19}/></div><h3>Original stays safe</h3><p>FrameForge creates a new downloadable file. It never overwrites your source video.</p></article>
        </section>
      </>}

      {activeTab === 'guide' && <section className="content-page"><div className="eyebrow"><Sparkles size={14}/> UNDER THE HOOD</div><h1>How it <span>works.</span></h1><p className="hero-copy">A conservative MP4 container rewrite — not a magic quality filter.</p>
        <div className="guide-list">
          <article><span>01</span><div><h3>Read the container</h3><p>FrameForge parses ISO Base Media File Format box headers and inspects the file's ftyp, moov and mdat boxes. The file is read in your browser.</p></div></article>
          <article><span>02</span><div><h3>Move the movie metadata</h3><p>When moov trails mdat, the optimizer moves moov immediately after ftyp. This layout is commonly called “fast start” and can let compatible players begin playback before downloading the whole file.</p></div></article>
          <article><span>03</span><div><h3>Repair chunk offsets</h3><p>Because the moov box moved, stco (32-bit) and co64 (64-bit) media chunk offsets are adjusted by the exact relocation size. The output is parsed again for structural validation.</p></div></article>
          <article><span>04</span><div><h3>Download a new file</h3><p>Video and audio samples are not decoded or encoded. This is a container-level change; it cannot improve source detail or dictate how a social platform encodes its copy.</p></div></article>
        </div>
        <div className="callout"><ShieldCheck size={19}/><p><strong>Scope and limitations</strong><br/>This first version supports conventional, non-fragmented MP4 files with one ftyp, one moov and one mdat. Fragmented MP4, malformed files, unusual offset layouts and unsupported structures are rejected rather than guessed at.</p></div>
        <button className="primary-button" onClick={() => setActiveTab('optimizer')}>Open optimizer <ArrowRight size={16}/></button>
      </section>}

      {activeTab === 'faq' && <section className="content-page"><div className="eyebrow"><CircleHelp size={14}/> GOOD TO KNOW</div><h1>Frequently asked <span>questions.</span></h1>
        <div className="faq-list">
          <details open><summary>Does this make TikTok videos sharper?<ChevronDown size={17}/></summary><p>No guarantee. This tool changes MP4 container layout only. TikTok may transcode the upload based on its own pipeline, so any posted-quality benefit is unverified.</p></details>
          <details><summary>Is the output lossless?<ChevronDown size={17}/></summary><p>The encoded audio/video sample payloads are copied without re-encoding. The container bytes and chunk-offset metadata may change. “No re-encode” does not mean a social platform will preserve the file unchanged.</p></details>
          <details><summary>Are my files uploaded anywhere?<ChevronDown size={17}/></summary><p>No. This app has no backend upload function. It uses the browser File API, ArrayBuffer, Blob and a temporary download URL to process locally.</p></details>
          <details><summary>Why does it only accept MP4?<ChevronDown size={17}/></summary><p>The patcher operates on ISO BMFF/MP4 boxes. A .mov file can use the same family of container format, but this version deliberately restricts its accepted inputs to common MP4/M4V files and validates the actual boxes.</p></details>
          <details><summary>What if the file is already optimized?<ChevronDown size={17}/></summary><p>It is validated and returned as-is. Rewriting a file that already has moov before mdat would not provide this particular fast-start benefit.</p></details>
          <details><summary>Can it process huge files?<ChevronDown size={17}/></summary><p>The whole file is loaded into browser memory for conservative offset rewriting. Very large files may use substantial RAM. A streaming or worker-based implementation would be better for multi-gigabyte videos.</p></details>
        </div>
        <button className="primary-button" onClick={() => setActiveTab('optimizer')}>Try the optimizer <ArrowRight size={16}/></button>
      </section>}
    </main>
    <footer><a className="brand footer-brand" href="#" onClick={e => { e.preventDefault(); setActiveTab('optimizer'); }}><span className="brand-mark"><Clapperboard size={16}/></span><span>frame<span className="brand-accent">forge</span></span></a><span>Built for creators. Runs on your device.</span><span className="footer-right">No upload. No re-encode. No promises about platform compression.</span></footer>
  </div>;
}