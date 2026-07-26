#!/usr/bin/env node
// Mestre do PC V9 — Launcher (Node.js, ES modules)
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MPC_PORT) || 18792;
const HOST = '127.0.0.1';
const VERSION = '9.0.0';
const OLLAMA_BASE = 'http://127.0.0.1:11434';

const jobs = new Map();
const rateMap = new Map();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

const BLOCKED = [
  /rm\s+-rf/i,
  /\bformat\b/i,
  /del\s+\/f\s+\/s\s+\/q\s+c:/i,
];

function isBlocked(cmd) {
  return BLOCKED.some(re => re.test(cmd));
}

function rateCheck(ip) {
  const now = Date.now();
  const arr = rateMap.get(ip) || [];
  const fresh = arr.filter(t => now - t < RATE_WINDOW_MS);
  fresh.push(now);
  rateMap.set(ip, fresh);
  return fresh.length <= RATE_LIMIT;
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 1_000_000) req.destroy(); });
    req.on('end', () => resolve(buf));
    req.on('error', () => resolve(''));
  });
}

function startJob(cmd) {
  const id = randomUUID();
  const job = { id, state: 'running', output: '', code: null, started: Date.now(), ended: null };
  jobs.set(id, job);
  const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd]);
  ps.stdout.on('data', d => { job.output += d.toString(); });
  ps.stderr.on('data', d => { job.output += d.toString(); });
  ps.on('close', code => {
    job.code = code;
    job.state = code === 0 ? 'done' : 'error';
    job.ended = Date.now();
  });
  ps.on('error', err => {
    job.output += '\n[launcher] erro: ' + err.message;
    job.code = 1;
    job.state = 'error';
    job.ended = Date.now();
  });
  return id;
}

async function getSystemStatus() {
  const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `
$os = Get-CimInstance Win32_OperatingSystem
$ramTotal = [math]::Round($os.TotalVisibleMemorySize/1MB,2)
$ramFree = [math]::Round($os.FreePhysicalMemory/1MB,2)
$ramUsedPct = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/$os.TotalVisibleMemorySize)*100,1)
$drv = Get-PSDrive C
$diskFree = [math]::Round($drv.Free/1GB,1)
$diskUsed = [math]::Round($drv.Used/1GB,1)
$diskTotal = $diskFree + $diskUsed
$boot = (Get-Process).StartTime
$uptime = (Get-Date) - $os.LastBootUpTime
$cpu = (Get-Counter '\\\\Processor(_Total)\\\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples.CookedValue
if (-not $cpu) { $cpu = 0 }
$cpu = [math]::Round($cpu,1)
$uptimeSec = [math]::Round($uptime.TotalSeconds,0)
[pscustomobject]@{
  cpu=$cpu
  ramTotalGB=$ramTotal
  ramFreeGB=$ramFree
  ramUsedPct=$ramUsedPct
  diskTotalGB=$diskTotal
  diskFreeGB=$diskFree
  diskUsedGB=$diskUsed
  uptimeSec=$uptimeSec
} | ConvertTo-Json -Compress
`]);
  return new Promise((resolve) => {
    let out = '';
    ps.stdout.on('data', d => { out += d.toString(); });
    ps.stderr.on('data', d => { out += d.toString(); });
    ps.on('close', () => {
      try { resolve(JSON.parse(out.trim())); } catch { resolve({ error: 'parse', raw: out }); }
    });
    ps.on('error', () => resolve({ error: 'spawn' }));
  });
}

async function proxyOllama(req, res, path, method) {
  const body = method === 'POST' ? await readBody(req) : null;
  const headers = { 'Content-Type': 'application/json' };
  try {
    const upstream = await fetch(OLLAMA_BASE + path, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    });
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      pump().catch(() => { try { res.end(); } catch {} });
    } else {
      res.end();
    }
  } catch (e) {
    json(res, 502, { error: 'ollama-unreachable', detail: e.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const ip = req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (!rateCheck(ip)) return json(res, 429, { error: 'rate-limit' });

  if (path === '/ping' && req.method === 'GET') {
    let busy = false;
    for (const j of jobs.values()) if (j.state === 'running') { busy = true; break; }
    return json(res, 200, { status: 'ok', state: busy ? 'busy' : 'idle', activeJobs: jobs.size, version: VERSION });
  }

  if (path === '/mcp-status' && req.method === 'GET') {
    return json(res, 200, { available: true, version: VERSION });
  }

  if (path === '/status' && req.method === 'GET') {
    const s = await getSystemStatus();
    return json(res, 200, s);
  }

  if (path === '/run' && req.method === 'POST') {
    const body = await readBody(req);
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json(res, 400, { success: false, error: 'invalid-json' }); }
    const cmd = parsed && parsed.cmd;
    if (typeof cmd !== 'string' || cmd.trim() === '') return json(res, 400, { success: false, error: 'empty-cmd' });
    if (isBlocked(cmd)) return json(res, 403, { success: false, error: 'blocked' });
    const jobId = startJob(cmd);
    return json(res, 200, { success: true, accepted: true, jobId });
  }

  if (path === '/run-status' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    const job = jobs.get(id);
    if (!job) return json(res, 404, { success: false, error: 'not-found' });
    return json(res, 200, {
      success: job.state === 'done',
      jobId: job.id,
      state: job.state,
      output: job.output,
      code: job.code,
      started: job.started,
      ended: job.ended,
    });
  }

  if (path === '/ollama/tags' && req.method === 'GET') {
    return proxyOllama(req, res, '/api/tags', 'GET');
  }
  if (path === '/ollama/chat' && req.method === 'POST') {
    return proxyOllama(req, res, '/api/chat', 'POST');
  }
  if (path === '/ollama/pull' && req.method === 'POST') {
    return proxyOllama(req, res, '/api/pull', 'POST');
  }

  if (path === '/' && req.method === 'GET') {
    try {
      const html = await readFile(join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch {
      return json(res, 500, { error: 'no-index-html' });
    }
  }

  if (path === '/favicon.png' && req.method === 'GET') {
    try {
      const fav = await readFile(join(__dirname, 'favicon.png'));
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(fav);
    } catch {
      res.writeHead(404); return res.end();
    }
  }

  json(res, 404, { error: 'not-found', path });
});

server.listen(PORT, HOST, () => {
  console.log(`[Mestre V9] ouvindo em http://${HOST}:${PORT} (v${VERSION})`);
});