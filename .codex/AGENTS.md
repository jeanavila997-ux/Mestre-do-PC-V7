# ECC for Codex CLI

This supplements the root `AGENTS.md` with a repo-local ECC baseline.

## Repo Skill

- Repo-generated Codex skill: `.agents/skills/Mestre-do-PC-V7/SKILL.md`
- Claude-facing companion skill: `.claude/skills/Mestre-do-PC-V7/SKILL.md`
- Keep user-specific credentials and private MCPs in `~/.codex/config.toml`, not in this repo.

## MCP Baseline

Treat `.codex/config.toml` as the default ECC-safe baseline for work in this repository.
The generated baseline enables Context7, Exa, Memory, Playwright, Sequential Thinking, and **mestre-do-pc** (the project's own MCP server with 33 diagnostic/maintenance tools).
GitHub access should use the connected GitHub app; the old npm GitHub MCP is deprecated.

The `mestre-do-pc` MCP server requires the launcher to be running at `http://127.0.0.1:7777` (start with `node v10/launcher.js` or `start-mestre.bat`). It exposes system tools (disk, RAM, network, cleanup, Defender, Ollama chat) via stdio.

## Multi-Agent Support

- Explorer: read-only evidence gathering
- Reviewer: correctness, security, and regression review
- Docs researcher: API and release-note verification

## Workflow Files

- No dedicated workflow command files were generated for this repo.

Use these workflow files as reusable task scaffolds when the detected repository workflows recur.
