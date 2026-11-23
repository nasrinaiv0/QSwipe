/**
 * Camera QR scanner in a dialog. Uses the native BarcodeDetector when available, otherwise lazy-loads jsQR.
 * Also accepts an uploaded photo of a code or a pasted link, so it works on desktops without a camera.
 */
import { $, closeDialog, dialogShell, esc, haptic, icon, openDialog, sound } from '../ui/kit';

/** close: done; continue: success, keep scanning (e.g. a queue of check-in passes); retry: show error, keep scanning. */
export type ScanOutcome = { result: 'close' } | { result: 'continue'; message: string } | { result: 'retry'; message: string };
type Decoder = (source: CanvasImageSource, w: number, h: number) => Promise<string | null>;

interface DetectorLike { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
interface DetectorCtor { new(o: { formats: string[] }): DetectorLike; getSupportedFormats(): Promise<string[]> }

let decoderPromise: Promise<Decoder> | null = null;
function getDecoder(): Promise<Decoder> {
  decoderPromise ??= (async () => {
    const Native = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (Native && (await Native.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) {
      const detector = new Native({ formats: ['qr_code'] });
      return async source => (await detector.detect(source).catch(() => []))[0]?.rawValue ?? null;
    }
    const { default: jsQR } = await import('jsqr');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    return async (source, w, h) => {
      const scale = Math.min(1, 720 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
    };
  })();
  return decoderPromise;
}

export function openScanner(o: { title: string; sub: string; hint?: string; onCode: (text: string) => Promise<ScanOutcome> | ScanOutcome }) {
  let stream: MediaStream | null = null;
  let raf = 0, busy = false, closed = false, facing: 'environment' | 'user' = 'environment';
  let lastText = '', lastAt = 0, lastScan = 0;

  const body = `<div class="scanner">
    <div class="scanner-view" id="scan-view"><div class="scanner-off">${icon('camera')}<span>Starting camera…</span></div></div>
    <div class="scanner-tools">
      <button class="btn sm" type="button" id="scan-flip">${icon('refresh')}Switch camera</button>
      <label class="btn sm" for="scan-file">${icon('image')}Scan a photo</label>
      <input id="scan-file" type="file" accept="image/*" class="sr-only">
    </div>
    <form class="cluster" id="scan-paste" autocomplete="off">
      <input class="input grow" id="scan-text" placeholder="…or paste a QSwipe link or code" aria-label="Paste a QSwipe link or code">
      <button class="btn" type="submit">Use code</button>
    </form>
    ${o.hint ? `<p class="hint">${esc(o.hint)}</p>` : ''}
  </div>`;

  const setMessage = (msg: string, found = false) => {
    const view = $('#scan-view');
    if (!view) return;
    view.classList.toggle('found', found);
    let el = $('.scanner-msg', view);
    if (!msg) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'scanner-msg'; el.setAttribute('role', 'status'); view.append(el); }
    el.textContent = msg;
  };

  async function handle(text: string) {
    if (busy || closed) return;
    const now = Date.now();
    if (text === lastText && now - lastAt < 3000) return;
    lastText = text; lastAt = now; busy = true;
    haptic(20);
    sound.pop();
    setMessage('Code found…', true);
    const out = await o.onCode(text);
    if (closed) return;
    if (out.result === 'close') { closeDialog(true); return; }
    setMessage(out.message, out.result === 'continue');
    if (out.result === 'retry') sound.wrong();
    setTimeout(() => { busy = false; if (!closed) setMessage(''); }, 1600);
  }

  async function loop(now: number) {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    const video = $<HTMLVideoElement>('#scan-video');
    if (busy || !video || video.readyState < 2 || now - lastScan < 140) return;
    lastScan = now;
    const decode = await getDecoder();
    const text = await decode(video, video.videoWidth, video.videoHeight);
    if (text) void handle(text);
  }

  async function start() {
    stop();
    const view = $('#scan-view')!;
    if (!navigator.mediaDevices?.getUserMedia) {
      view.innerHTML = `<div class="scanner-off">${icon('camera')}<span>Camera access needs a secure (HTTPS) connection and a supported browser. Scan a photo or paste the link instead.</span></div>`;
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (closed) return stop();
      view.innerHTML = '<video id="scan-video" playsinline muted></video><div class="finder" aria-hidden="true"></div><div class="scan-line" aria-hidden="true"></div>';
      const video = $<HTMLVideoElement>('#scan-video')!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      void getDecoder();
      raf = requestAnimationFrame(loop);
    } catch (e) {
      const denied = (e as DOMException).name === 'NotAllowedError';
      view.innerHTML = `<div class="scanner-off">${icon('camera')}<span>${denied ? 'Camera permission was denied. Allow camera access in your browser settings, or scan a photo / paste the link instead.' : 'No camera was found. Scan a photo or paste the link instead.'}</span></div>`;
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
  }

  openDialog({
    label: o.title,
    html: dialogShell({ title: o.title, sub: o.sub, body }),
    onOpen: d => {
      void start();
      $('#scan-flip', d)!.addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; void start(); });
      $('#scan-paste', d)!.addEventListener('submit', e => {
        e.preventDefault();
        const text = $<HTMLInputElement>('#scan-text', d)!.value.trim();
        if (text) { lastText = ''; void handle(text); }
      });
      $<HTMLInputElement>('#scan-file', d)!.addEventListener('change', async e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const bmp = await createImageBitmap(file);
          const text = await (await getDecoder())(bmp, bmp.width, bmp.height);
          bmp.close();
          if (text) { lastText = ''; void handle(text); } else setMessage('No QR code found in that photo. Try a sharper, closer shot.');
        } catch { setMessage('That photo could not be read.'); }
      });
    },
    onClose: () => { closed = true; stop(); },
  });
}
