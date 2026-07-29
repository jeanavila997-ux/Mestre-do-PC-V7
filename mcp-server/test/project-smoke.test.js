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

test("novos comandos de auditoria de segurança estão presentes e classificados", async () => {
  const html = await readFile(join(root, "v10", "index.html"), "utf8");
  assert.match(html, /Get-LocalUser/);
  assert.match(html, /Get-NetNeighbor/);
  assert.match(html, /Get-SmbShare/);
  assert.match(html, /Get-FileHash/);
  assert.match(html, /LogName=\\"Security\\";Id=4624,4625/);
  assert.match(html, /Get-NetConnectionProfile/);
  assert.match(html, /Get-NetIPConfiguration/);

  // CHKDSK com /f ou /r deve ser tratado como perigoso (agenda ação disruptiva no próximo boot).
  const declaration = html.indexOf("const DANGER_PATTERNS");
  const dangerBlockEnd = html.indexOf("];", declaration);
  const dangerBlock = html.slice(declaration, dangerBlockEnd);
  assert.match(dangerBlock, /chkdsk/i);

  // Novo parâmetro de arquivo deve seguir o mesmo esquema de validação de caminho local seguro do CAMINHO.inf.
  assert.match(html, /CAMINHO_ARQUIVO/);
  assert.match(html, /_pendingToken === "CAMINHO_ARQUIVO"/);
});
