import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("script inline da V10 compila e inicializa regras antes da renderizacao", async () => {
  const html = await readFile(join(root, "v10", "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));

  const declaration = html.indexOf("const DANGER_PATTERNS");
  const firstUse = html.indexOf("const danger = isDangerous");
  assert.ok(declaration >= 0 && firstUse >= 0 && declaration < firstUse);
  assert.match(html, /Stop-Computer\|Restart-Computer\|logoff/);
  assert.match(html, /SetSuspendState/);
  assert.match(html, /shutdown\\s\+\\\/\[rshl\]/);
});

test("V10 usa caminho de projeto do ambiente e cabeçalho privilegiado", async () => {
  const html = await readFile(join(root, "v10", "index.html"), "utf8");
  assert.match(html, /\$env:MESTRE_PROJETO_PATH/);
  assert.match(html, /"X-Mestre-Client": "v10-web"/);
  assert.doesNotMatch(html, /C:\\\\MestreDoPC_V7/);
  assert.doesNotMatch(html, /C:\\\\Users\\\\Jeanc\\\\MestreDoPC_V7/);
});

test("V10 expõe funções e UI para importar documento no chat IA", async () => {
  const html = await readFile(join(root, "v10", "index.html"), "utf8");

  // Elementos de UI
  assert.match(html, /id="iaFileInput"/);
  assert.match(html, /id="iaAttachBtn"/);
  assert.match(html, /id="iaDocContext"/);
  assert.match(html, /onclick="importDocumentToIA\(\)"/);
  assert.match(html, /onchange="handleIAFileSelect\(event\)"/);
  assert.match(html, /onclick="clearIADocument\(\)"/);

  // Funções JS
  assert.match(html, /function importDocumentToIA\(\)/);
  assert.match(html, /function handleIAFileSelect\(event\)/);
  assert.match(html, /function clearIADocument\(\)/);
  assert.match(html, /function buildSystemPrompt\(\)/);
  assert.match(html, /function updateIADocContextUI\(\)/);
  assert.match(html, /function truncateText\(text, max\)/);
  assert.match(html, /function extractTextFromPDF\(arrayBuffer\)/);
  assert.match(html, /function processIAFile\(file\)/);
  assert.match(html, /function initIADragDrop\(\)/);

  // Constante de limite, variável de contexto, tamanho de arquivo e PDF no accept
  assert.match(html, /IA_DOC_MAX_CHARS\s*=\s*8000/);
  assert.match(html, /let iaDocumentContext/);
  assert.match(html, /5 \* 1024 \* 1024/);
  assert.match(html, /accept=\"\.txt,\.md,\.json,\.log,\.csv,\.ps1,\.js,\.html,\.css,\.bat,\.cmd,\.xml,\.yml,\.yaml,\.ini,\.conf,\.pdf\"/);

  // O system prompt deve ser construído dinamicamente e o documento deve ir por lá
  assert.doesNotMatch(html, /messages:\s*\[\{\s*role:\s*"system",\s*content:\s*SYSTEM_PROMPT\s*\},/);
  assert.match(html, /content:\s*buildSystemPrompt\(\)/);
});

test("V10 expõe botões de ativação para Launcher, MCP e Ollama", async () => {
  const html = await readFile(join(root, "v10", "index.html"), "utf8");

  // Botões no dashboard
  assert.match(html, /id="launcherActivateBtn"/);
  assert.match(html, /id="mcpActivateBtn"/);
  assert.match(html, /id="ollamaActivateBtn"/);
  assert.match(html, /onclick="activateLauncher\(\)"/);
  assert.match(html, /onclick="activateMCP\(\)"/);
  assert.match(html, /onclick="activateOllama\(\)"/);

  // Funções de ativação
  assert.match(html, /function activateLauncher\(\)/);
  assert.match(html, /function activateMCP\(\)/);
  assert.match(html, /function activateOllama\(\)/);
  assert.match(html, /function pollJobUntilDone\(jobId, onOutput\)/);

  // Deve usar o launcher elevado para executar os comandos de ativação
  assert.match(html, /fetch\(API \+ "\/run"/);
});
