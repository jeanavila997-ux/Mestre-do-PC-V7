/**
 * Mestre do PC V8 — Frontend SPA
 * Se comunica com o backend via API REST (/api/status, /api/command, /api/jobs/:id)
 */

const API_BASE = window.location.origin.includes('localhost') ? '' : 'http://localhost:7777';

const ui = {
    serverStatus: document.getElementById('server-status'),
    jobCount: document.getElementById('job-count'),
    cpuVal: document.getElementById('cpu-val'),
    ramVal: document.getElementById('ram-val'),
    diskVal: document.getElementById('disk-val'),
    uptimeVal: document.getElementById('uptime-val'),
    cmdPreset: document.getElementById('cmd-preset'),
    cmdInput: document.getElementById('cmd-input'),
    btnExecutar: document.getElementById('btn-executar'),
    btnLimpar: document.getElementById('btn-limpar'),
    cmdResult: document.getElementById('cmd-result'),
    jobsList: document.getElementById('jobs-list'),
    btnLimparJobs: document.getElementById('btn-limpar-jobs'),
    btnRefreshStatus: document.getElementById('btn-refresh-status'),
};

let activeJobs = new Map();
let pollInterval = null;

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function loadStatus() {
    try {
        const data = await apiGet('/api/status');
        ui.serverStatus.textContent = 'Online';
        ui.serverStatus.className = 'badge online';
        ui.cpuVal.textContent = `${data.cpu?.toFixed ? data.cpu.toFixed(1) : '--'}%`;
        ui.ramVal.textContent = `${data.memory?.percent ?? '--'}%`;
        ui.diskVal.textContent = data.disk?.free ? `${Math.round(data.disk.free / 1e9)}GB livre` : '--';
        ui.uptimeVal.textContent = data.uptime ? `${Math.floor(data.uptime)}h` : '--';
        ui.jobCount.textContent = `Jobs: ${data.activeJobs ?? 0}`;
    } catch (e) {
        ui.serverStatus.textContent = 'Offline';
        ui.serverStatus.className = 'badge offline';
        console.warn('Status load failed:', e.message);
    }
}

async function submitCommand() {
    const cmd = ui.cmdInput.value.trim();
    if (!cmd) return;

    ui.btnExecutar.disabled = true;
    ui.cmdResult.classList.remove('hidden', 'error', 'success');
    ui.cmdResult.textContent = 'Enviando comando...';

    try {
        const data = await apiPost('/api/command', { command: cmd, timeoutSeconds: 900 });
        ui.cmdResult.textContent = `Job aceito: ${data.jobId}\nEstado: ${data.state}`;
        ui.cmdResult.classList.add('success');
        activeJobs.set(data.jobId, { command: cmd, state: data.state });
        renderJobs();
        startPolling();
    } catch (e) {
        ui.cmdResult.textContent = `Erro: ${e.message}`;
        ui.cmdResult.classList.add('error');
    } finally {
        ui.btnExecutar.disabled = false;
    }
}

async function pollJobs() {
    const toRemove = [];
    for (const [jobId, job] of activeJobs) {
        try {
            const data = await apiGet(`/api/jobs/${jobId}`);
            job.state = data.state;
            job.output = data.output;
            if (data.state !== 'running') {
                job.completed = true;
                toRemove.push(jobId);
            }
        } catch (e) {
            console.warn(`Poll failed for ${jobId}:`, e.message);
        }
    }
    renderJobs();

    if (activeJobs.size === 0) {
        stopPolling();
    }
}

function renderJobs() {
    if (activeJobs.size === 0) {
        ui.jobsList.innerHTML = '<p class="empty">Nenhum job ativo.</p>';
        return;
    }
    ui.jobsList.innerHTML = '';
    for (const [jobId, job] of activeJobs) {
        const el = document.createElement('div');
        el.className = 'job-item';
        el.innerHTML = `
            <span class="id" title="${job.command}">${jobId.substring(0, 8)}...</span>
            <span class="state ${job.state}">${job.state}</span>
        `;
        ui.jobsList.appendChild(el);
    }
}

function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(pollJobs, 1500);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function clearCompleted() {
    for (const [jobId, job] of activeJobs) {
        if (job.state !== 'running') {
            activeJobs.delete(jobId);
        }
    }
    renderJobs();
    if (activeJobs.size === 0) stopPolling();
}

// Eventos
ui.btnExecutar.addEventListener('click', submitCommand);
ui.btnLimpar.addEventListener('click', () => {
    ui.cmdInput.value = '';
    ui.cmdResult.classList.add('hidden');
});
ui.btnLimparJobs.addEventListener('click', clearCompleted);
ui.btnRefreshStatus.addEventListener('click', loadStatus);
ui.cmdPreset.addEventListener('change', (e) => {
    if (e.target.value) ui.cmdInput.value = e.target.value;
});

// Inicializacao
loadStatus();
setInterval(loadStatus, 10000);
