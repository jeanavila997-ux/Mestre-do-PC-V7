import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, resolve as pathResolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MPC_PORT || 18791);
const HOST = '127.0.0.1';
const VERSION = '8.0.0';
const OLLAMA_BASE = 'http://127.0.0.1:11434';

const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /format\b/i,
  /del\s+\/f\s+\/s\s+\/q\s+c:/i,
  /diskpart/i,
  /shutdown\b/i,
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const jobs = new Map();
const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 100;

function rateLimit(ip) {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateMap.set(ip, arr);
  return arr.length <= RATE_MAX;
}

function send(res, status, body, headers = {}) {
  const isObj = body && typeof body === 'object' && !Buffer.isBuffer(body);
  const payload = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': isObj ? 'application/json; charset=utf-8' : (headers['Content-Type'] || 'text/plain; charset=utf-8'),
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5_000_000) req.destroy(), reject(new Error('payload too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isBlocked(cmd) {
  return BLOCKED_PATTERNS.some(p => p.test(cmd));
}

function startJob(cmd) {
  const jobId = randomUUID();
  const job = { id: jobId, state: 'running', output: '', exitCode: null, startedAt: new Date().toISOString(), completedAt: null };
  jobs.set(jobId, job);

  const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
    windowsHide: true,
  });
  let out = '';
  ps.stdout.on('data', d => { out += d.toString(); });
  ps.stderr.on('data', d => { out += d.toString(); });
  ps.on('close', code => {
    job.state = 'completed';
    job.exitCode = code;
    job.output = out;
    job.completedAt = new Date().toISOString();
  });
  ps.on('error', err => {
    job.state = 'completed';
    job.exitCode = -1;
    job.output = String(err);
    job.completedAt = new Date().toISOString();
  });
  return job;
}

async function proxyOllama(req, res, path) {
  const body = await readBody(req);
  try {
    const upstream = await fetch(OLLAMA_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
    });
    res.writeHead(upstream.status, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    send(res, 502, { error: 'ollama indisponivel', detail: String(e.message || e) });
  }
}

async function getStatusMetrics() {
  const cmd = `$os=Get-CimInstance Win32_OperatingSystem; $d=Get-PSDrive C; $cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; [pscustomobject]@{cpu=$cpu; ramTotal=[math]::Round($os.TotalVisibleMemorySize/1MB,2); ramFree=[math]::Round($os.FreePhysicalMemory/1MB,2); diskFree=[math]::Round($d.Free/1GB,2); diskUsed=[math]::Round($d.Used/1GB,2)} | ConvertTo-Json -Compress`;
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', d => out += d.toString());
    ps.stderr.on('data', d => out += d.toString());
    ps.on('close', () => {
      try { resolve(JSON.parse(out.trim())); } catch { resolve(null); }
    });
    ps.on('error', () => resolve(null));
  });
}

async function serveStatic(res, urlPath) {
  const staticRoot = pathResolve(__dirname, 'static');
  let rel = urlPath.replace(/^\/static\//, '');
  if (rel === '' || rel === '/') rel = 'index.html';
  const safe = normalize(join(staticRoot, rel));
  if (!safe.startsWith(staticRoot)) return send(res, 403, { error: 'forbidden' });
  if (!existsSync(safe)) return send(res, 404, { error: 'not found' });
  const data = await readFile(safe);
  send(res, 200, data, { 'Content-Type': MIME[extname(safe).toLowerCase()] || 'application/octet-stream' });
}

async function serveFile(res, fileName) {
  const fp = join(__dirname, fileName);
  if (!existsSync(fp)) return send(res, 404, { error: 'not found' });
  const data = await readFile(fp);
  send(res, 200, data, { 'Content-Type': MIME[extname(fp).toLowerCase()] || 'application/octet-stream' });
}

const server = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (!rateLimit(ip)) return send(res, 429, { error: 'rate limit exceeded' });

  const url = new URL(req.url, `http://${HOST}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') return send(res, 204, '', { 'Content-Length': '0' });

  try {
    if (pathname === '/ping' && method === 'GET') {
      const activeJobs = [...jobs.values()].filter(j => j.state === 'running').length;
      return send(res, 200, { status: 'ok', state: activeJobs > 0 ? 'busy' : 'idle', activeJobs, version: VERSION });
    }

    if (pathname === '/mcp-status' && method === 'GET') {
      return send(res, 200, { available: true, version: VERSION });
    }

    if (pathname === '/status' && method === 'GET') {
      const m = await getStatusMetrics();
      if (!m) return send(res, 200, { cpu: null, ramTotal: null, ramFree: null, diskFree: null, diskUsed: null, activeJobs: [...jobs.values()].filter(j => j.state === 'running').length });
      return send(res, 200, { ...m, activeJobs: [...jobs.values()].filter(j => j.state === 'running').length });
    }

    if (pathname === '/run' && method === 'POST') {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch { return send(res, 400, { error: 'invalid json' }); }
      const cmd = parsed && parsed.cmd;
      if (typeof cmd !== 'string' || !cmd.trim()) return send(res, 400, { success: false, error: 'missing cmd' });
      if (isBlocked(cmd)) return send(res, 403, { success: false, error: 'comando bloqueado por seguranca' });
      const job = startJob(cmd);
      return send(res, 202, { success: true, accepted: true, jobId: job.id, message: 'Command accepted and queued' });
    }

    if (pathname === '/run-status' && method === 'GET') {
      const id = url.searchParams.get('id');
      const job = jobs.get(id);
      if (!job) return send(res, 404, { success: false, error: 'job not found' });
      return send(res, 200, {
        success: true,
        done: job.state === 'completed',
        running: job.state === 'running',
        state: job.state,
        exitCode: job.exitCode,
        output: job.output,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }

    if (pathname === '/ollama/tags' && method === 'GET') {
      try {
        const r = await fetch(OLLAMA_BASE + '/api/tags', { signal: AbortSignal.timeout(5000) });
        const j = await r.json();
        return send(res, 200, j);
      } catch (e) {
        return send(res, 502, { error: 'ollama indisponivel', available: false });
      }
    }

    if (pathname === '/ollama/chat' && method === 'POST') return proxyOllama(req, res, '/api/chat');
    if (pathname === '/ollama/pull' && method === 'POST') return proxyOllama(req, res, '/api/pull');

    if (pathname === '/' && method === 'GET') return serveFile(res, 'index.html');
    if (pathname === '/logo.png' && method === 'GET') return serveFile(res, 'favicon.png');
    if (pathname === '/favicon.png' && method === 'GET') return serveFile(res, 'favicon.png');
    if (pathname.startsWith('/static/') && method === 'GET') return serveStatic(res, pathname);

    send(res, 404, { error: 'not found', path: pathname });
  } catch (e) {
    send(res, 500, { error: 'internal', detail: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mestre do PC V8 rodando em http://${HOST}:${PORT}`);
});

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.state === 'completed' && now - new Date(job.completedAt).getTime() > 30 * 60_000) jobs.delete(id);
  }
  for (const [ip, arr] of rateMap) {
    rateMap.set(ip, arr.filter(t => now - t < RATE_WINDOW_MS));
    if (rateMap.get(ip).length === 0) rateMap.delete(ip);
  }
}, 60_000).unref();