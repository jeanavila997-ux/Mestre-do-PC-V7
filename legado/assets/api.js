/* ==========================================================================
   Mestre do PC V8 — Cliente do Launcher (porta 7777)
   --------------------------------------------------------------------------
   Espelha o contrato do MestreDoPC-Launcher.ps1:
     POST /run        -> { id }
     GET  /run-status?id=<id>  -> { state: 'pending'|'running'|'done'|'error', ... }
     GET  /ping       -> { status: 'ok' }
     POST /ai/ask     -> { id } (Frente 5)
   Exporta como modulo ES + como window.MestreAPI para uso no HTML monolitico.
   ========================================================================== */

const BASE = "http://127.0.0.1:7777";

/** Aguarda tempo em ms. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Health-check do launcher. */
export async function ping({ timeoutMs = 2000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(`${BASE}/ping`, { signal: ctrl.signal });
        if (!r.ok) return false;
        const json = await r.json();
        return json?.status === "ok";
    } catch {
        return false;
    } finally {
        clearTimeout(t);
    }
}

/** Dispara um job e devolve o id. */
export async function runCommand(command, extras = {}) {
    const r = await fetch(`${BASE}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, ...extras }),
    });
    if (!r.ok) throw new Error(`POST /run -> HTTP ${r.status}`);
    const { id } = await r.json();
    if (!id) throw new Error("Launcher nao retornou job id.");
    return id;
}

/** Busca o status atual de um job. */
export async function getStatus(id) {
    const r = await fetch(`${BASE}/run-status?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(`GET /run-status -> HTTP ${r.status}`);
    return r.json();
}

/**
 * Polling ate terminal ('done' ou 'error').
 * @param {string} id
 * @param {object} opts
 * @param {(status) => void} opts.onUpdate  callback a cada tick
 * @param {number} opts.intervalMs          (default 800)
 * @param {number} opts.timeoutMs           (default 15 min; alinhado com JobTimeoutSeconds do launcher)
 */
export async function waitForJob(id, {
    onUpdate = () => {},
    intervalMs = 800,
    timeoutMs = 15 * 60 * 1000,
} = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const s = await getStatus(id);
        onUpdate(s);
        if (s.state === "done" || s.state === "error") return s;
        await sleep(intervalMs);
    }
    throw new Error(`Timeout aguardando job ${id}`);
}

/** Atalho ergonomico: run + wait num so passo. */
export async function runAndWait(command, opts = {}) {
    const id = await runCommand(command, opts.extras);
    return waitForJob(id, opts);
}

/**
 * Anexa estado do job a um elemento DOM (via data-job-state).
 * Funciona com os estilos em design-tokens.css.
 */
export function bindJobToElement(el, statePromise) {
    el.dataset.jobState = "pending";
    return statePromise.then((s) => {
        el.dataset.jobState = s.state;
        return s;
    }).catch((err) => {
        el.dataset.jobState = "error";
        throw err;
    });
}

/* ---------- Exposicao global para o HTML monolitico ---------- */
if (typeof window !== "undefined") {
    window.MestreAPI = { ping, runCommand, getStatus, waitForJob, runAndWait, bindJobToElement };
}
