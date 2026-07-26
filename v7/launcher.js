#!/usr/bin/env node
// Mestre do PC V7 - Launcher Node.js (autonomo)
// Porta 7777. Executa PowerShell localmente com jobs e expoe proxy Ollama.

import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const PORT = process.env.MPC_PORT ? Number(process.env.MPC_PORT) : 7777;
const HOST = process.env.MPC_HOST || "127.0.0.1";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const jobs = new Map();

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try { resolve(JSON.parse(buf || "{}")); }
      catch { resolve({}); }
    });
  });
}

function runPowerShell(cmd) {
  const id = randomUUID();
  const job = { id, state: "running", output: "", startedAt: Date.now() };
  jobs.set(id, job);
  const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
    windowsHide: true,
  });
  ps.stdout.on("data", (d) => (job.output += d.toString()));
  ps.stderr.on("data", (d) => (job.output += d.toString()));
  ps.on("close", (code) => {
    job.state = "completed";
    job.exitCode = code;
    job.success = code === 0;
    job.completedAt = Date.now();
  });
  ps.on("error", (e) => {
    job.state = "completed";
    job.success = false;
    job.output += `\n[ERRO] ${e.message}`;
    job.completedAt = Date.now();
  });
  return id;
}

async function proxyOllama(path, req, res) {
  const body = await readBody(req);
  const upstream = await fetch(OLLAMA_URL + path, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body: req.method === "POST" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { output: text }; }
  sendJson(res, upstream.status || 200, data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }

  try {
    if (path === "/ping") {
      const activeJobs = [...jobs.values()].filter((j) => j.state === "running").length;
      return sendJson(res, 200, {
        status: "ok",
        state: activeJobs > 0 ? "busy" : "idle",
        activeJobs,
        version: "7.0.0",
      });
    }

    if (path === "/mcp-status") {
      return sendJson(res, 200, { available: true, version: "7.0.0" });
    }

    if (path === "/run" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.cmd) return sendJson(res, 400, { success: false, output: "Missing 'cmd'" });
      const id = runPowerShell(body.cmd);
      return sendJson(res, 202, { success: true, accepted: true, jobId: id });
    }

    if (path === "/run-status") {
      const id = url.searchParams.get("id");
      const job = jobs.get(id);
      if (!job) return sendJson(res, 404, { success: false, output: "Job not found" });
      return sendJson(res, 200, {
        jobId: job.id,
        state: job.state,
        success: job.state === "completed" ? job.success : null,
        running: job.state === "running",
        done: job.state !== "running",
        exitCode: job.exitCode,
        output: job.state === "running" ? "Executando..." : job.output,
      });
    }

    // Proxy Ollama
    if (path === "/ollama/tags") return proxyOllama("/api/tags", req, res);
    if (path === "/ollama/chat" && req.method === "POST") return proxyOllama("/api/chat", req, res);
    if (path === "/ollama/pull" && req.method === "POST") return proxyOllama("/api/pull", req, res);

    // Servir frontend estatico (index.html, logo, favicon)
    if (path === "/" || path === "/index.html") {
      const fs = await import("node:fs/promises");
      const html = await fs.readFile("./index.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    if (path === "/logo-mestre-v7-transparent.png" || path === "/favicon.png") {
      const fs = await import("node:fs/promises");
      try {
        const buf = await fs.readFile("." + path);
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(buf);
      } catch { return sendJson(res, 404, { error: "not found" }); }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mestre do PC V7 - Launcher ativo em http://${HOST}:${PORT}`);
  console.log(`Ollama proxy -> ${OLLAMA_URL}`);
});