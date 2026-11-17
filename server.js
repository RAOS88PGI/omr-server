// Server OMR sederhana: menerima PDF, menjalankan Audiveris, mengembalikan MusicXML (.mxl/.xml).
// Tanpa dependensi. Butuh Node 18+ dan Audiveris terpasang.
//   AUDIVERIS_BIN  path/perintah Audiveris (default: Audiveris)
//   OMR_TOKEN      (opsional) token yang harus dikirim di header x-token
//   PORT           (default 8080)
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const PORT = +process.env.PORT || 8080, TOKEN = process.env.OMR_TOKEN || '';
const BIN = process.env.AUDIVERIS_BIN || 'Audiveris';
const ARGS = (process.env.AUDIVERIS_ARGS || '-batch -export').split(/\s+/).filter(Boolean);
const MAX = 25 * 1024 * 1024, TIMEOUT = +process.env.OMR_TIMEOUT_MS || 180000;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
let queue = Promise.resolve(); // satu konversi sekali jalan (Audiveris berat)

const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { ...CORS, 'Content-Type': type }); res.end(body); };
function findOut(dir) {
  const out = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(mxl|musicxml|xml)$/i.test(f.name) && !/^input\.omr$/i.test(f.name)) out.push(p); } })(dir);
  return out.sort()[0];
}
function convert(pdf) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omr-')), inp = path.join(dir, 'input.pdf'), outDir = path.join(dir, 'out');
    fs.mkdirSync(outDir); fs.writeFileSync(inp, pdf);
    const clean = () => fs.rm(dir, { recursive: true, force: true }, () => {});
    const p = spawn(BIN, [...ARGS, '-output', outDir, inp], { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('[omr] mulai pdf=' + pdf.length + ' bytes args=' + ARGS.join(' ')); let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
    const t = setTimeout(() => { p.kill('SIGKILL'); clean(); reject({ code: 504, msg: 'Konversi terlalu lama (batas ' + TIMEOUT / 1000 + ' detik)' }); }, TIMEOUT);
    p.on('error', e => { clearTimeout(t); clean(); reject({ code: 500, msg: 'Audiveris tidak bisa dijalankan: ' + e.message }); });
    p.on('close', code => {
      clearTimeout(t);
      const f = fs.existsSync(outDir) && findOut(outDir);
      if (!f) { clean(); return reject({ code: 422, msg: 'Audiveris tidak menghasilkan MusicXML (kode ' + code + '). PDF mungkin hasil scan buram atau bukan not balok.\n' + log.slice(-300) }); }
      const data = fs.readFileSync(f); const warn = log.split('\n').filter(l => /WARN|ERROR|Exception|tesseract|tessdata|OCR|language/i.test(l)).slice(0, 80).join('\n');
      console.log('[omr] selesai kode=' + code + ' file=' + path.basename(f) + ' bytes=' + data.length + '\n--- WARN/ERROR ---\n' + warn + '\n--- AKHIR ---\n' + log.slice(-2000)); clean(); resolve(data);
    });
  });
}
// Diagnosis saat start: pastikan Tesseract dan data bahasa 'eng' terbaca.
try {
  const { execSync } = require('child_process');
  const sh = c => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return 'GAGAL: ' + (e.stderr || e.message).toString().trim(); } };
  console.log('[diag] TESSDATA_PREFIX=' + process.env.TESSDATA_PREFIX);
  console.log('[diag] tesseract --list-langs: ' + sh('tesseract --list-langs'));
  console.log('[diag] cari eng.traineddata: ' + sh('find / -name "eng.traineddata" 2>/dev/null'));
} catch (e) { console.log('[diag] ' + e.message); }
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, 'ok');
  if (req.method !== 'POST' || req.url.split('?')[0] !== '/convert') return send(res, 404, 'Tidak ditemukan');
  if (TOKEN && req.headers['x-token'] !== TOKEN) return send(res, 401, 'Token salah atau kosong');
  const chunks = []; let size = 0, dead = false;
  req.on('data', c => { size += c.length; if (size > MAX) { dead = true; send(res, 413, 'PDF terlalu besar (maks 25 MB)'); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (dead) return;
    const buf = Buffer.concat(chunks);
    if (buf.slice(0, 4).toString() !== '%PDF') return send(res, 400, 'File bukan PDF');
    queue = queue.then(() => convert(buf)).then(
      d => send(res, 200, d, 'application/octet-stream'),
      e => send(res, e.code || 500, e.msg || String(e)));
  });
}).listen(PORT, () => console.log('Server OMR siap di port ' + PORT));
