#!/usr/bin/env node
"use strict";

/**
 * Antigravity PreToolUse hook for `run_command`.
 * Prompts (`force_ask`) on destructive shell, git, database, and system commands.
 * Returns `allow` otherwise so Antigravity applies its normal permission policy.
 */

const fs = require("fs");

const GIT_PREFIX =
  /^git(?:\.exe)?\b(?:\s+(?:-[Cc]\s+\S+|--[a-z-]+(?:=\S+|\s+\S+)))*\s+/i;

const SEGMENT_RE = /(?:"(?:\\.|[^"\\])*"|'[^']*'|[^;&|\r\n]|&(?!&))+/g;
const WRAPPER_RE =
  /\b(?:bash|sh|zsh|dash|powershell(?:\.exe)?|pwsh(?:\.exe)?|cmd(?:\.exe)?)\b[^\r\n;|&]*?\s(?:-c|-Command|\/c)\s+(?:"((?:\\.|[^"\\])*)"|'([^']*)')/gi;
const SUBSHELL_RE = /\$\(([^)]+)\)|`([^`]+)`/g;

// Rules matched against unquoted command segments (avoids false positives in commit messages/echo).
const COMMAND_RULES = [
  [/^(?:rm|remove-item|ri|del|erase|rmdir|rd|unlink|shred)(?:\.exe)?(?:\s|$)/i, "file/directory deletion"],
  [/^(?:dropdb|dropuser)(?:\.exe)?(?:\s|$)/i, "database drop CLI"],
  [
    /\b(?:prisma\s+migrate\s+reset|prisma\s+db\s+push\b.*--force-reset|(?:db|schema):(?:drop|reset|wipe)|migrate:fresh|manage\.py\s+flush|alembic\s+downgrade\s+base)\b/i,
    "database migration/reset",
  ],
  [/^truncate(?:\.exe)?(?:\s|$)/i, "file truncate"],
  [/^(?:powershell|pwsh)(?:\.exe)?\b[^\r\n;|&]*?\s-(?:encodedcommand|enc|ec)(?:\s|$)/i, "PowerShell encoded command"],
  [/^(?:format-volume|clear-disk|remove-partition|mkfs(?:\.\w+)?)(?:\.exe)?(?:\s|$)/i, "disk/volume format"],
  [/^dd(?:\.exe)?\s+.*\bof=/i, "raw disk write (dd)"],
  [
    /^docker(?:\.exe)?\s+(?:(?:system|volume|image|container)\s+prune\b|volume\s+rm\b|compose\s+down\b.*\s(?:-v|--volumes)\b)/i,
    "Docker cleanup/volume removal",
  ],
];

// Rules matched against the git subcommand (after stripping `git` and global flags).
const GIT_RULES = [
  [/^push\b.*(?:\s(?:--force(?:-(?:with-lease|if-includes)(?:=\S+)?)?|-[a-zA-Z]*f[a-zA-Z]*)(?:\s|$)|\s\+[^\s]+)/, "git push --force"],
  [/^reset\b.*\s--hard(?:\s|$)/i, "git reset --hard"],
  [/^clean\b/i, "git clean"],
  [/^branch\b.*(?:\s-[a-zA-Z]*D[a-zA-Z]*|\s-(?:df|fd))(?:\s|$)/, "git branch -D"],
  [/^branch\b(?=.*\s(?:--delete|-d)(?:\s|$))(?=.*\s(?:--force|-f)(?:\s|$))/i, "git branch --delete --force"],
  [/^stash\s+(?:drop|clear)\b/i, "git stash drop/clear"],
];

// Rules matched against full segment (including quoted SQL), skipped for echo/git-commit-style commands.
const SQL_RULES = [
  [
    /\bDROP\s+(?:IF\s+EXISTS\s+)?(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW|MATERIALIZED\s+VIEW|FUNCTION|PROCEDURE|TRIGGER|TYPE|ROLE|USER|SEQUENCE|EXTENSION|DOMAIN|POLICY|RULE|TABLESPACE|COLLECTION)\b/i,
    "SQL DROP statement",
  ],
  [/\bTRUNCATE\s+TABLE\b/i, "SQL TRUNCATE TABLE"],
  [/\.dropDatabase\s*\(/i, "database drop (.dropDatabase())"],
];

const MESSAGE_ONLY_RE = /^(?:echo|printf|write-output|write-host)\b/i;

function normalizeSegment(segment) {
  let s = segment.trim();
  let prev;
  do {
    prev = s;
    s = s
      .replace(/^[\s(&]+/, "")
      .replace(/^(?:sudo|command|nohup|time)\b(?:\s+-\S+)*\s+/i, "")
      .replace(/^cmd(?:\.exe)?\s+\/c\s+/i, "")
      .replace(/^env\b(?:\s+[A-Za-z_][A-Za-z0-9_]*=\S*)*\s+/i, "")
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+/, "")
      .replace(/^"([^"\s]+)"(?=\s|$)/, "$1");
  } while (s !== prev);
  return s;
}

function matchRules(text, rules) {
  for (const [re, label] of rules) {
    if (re.test(text)) return label;
  }
  return null;
}

function checkSegment(rawSegment) {
  const seg = normalizeSegment(rawSegment);
  if (!seg) return null;

  const unquoted = seg.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');
  const cmdHit = matchRules(unquoted, COMMAND_RULES);
  if (cmdHit) return cmdHit;

  const gitMatch = unquoted.match(GIT_PREFIX);
  if (gitMatch) {
    const gitSub = unquoted.slice(gitMatch[0].length);
    const gitHit = matchRules(gitSub, GIT_RULES);
    if (gitHit) return gitHit;
    if (/^(?:commit|tag|notes|log|grep)\b/i.test(gitSub)) return null;
  }

  return MESSAGE_ONLY_RE.test(unquoted) ? null : matchRules(seg, SQL_RULES);
}

function inspectCommandLine(commandLine) {
  if (!commandLine || typeof commandLine !== "string") return null;

  const texts = [commandLine];
  for (const m of commandLine.matchAll(WRAPPER_RE)) {
    texts.push(m[1] ?? m[2]);
  }
  for (const t of [...texts]) {
    for (const m of t.matchAll(SUBSHELL_RE)) {
      texts.push(m[1] ?? m[2]);
    }
  }

  for (const text of texts) {
    for (const segment of text.match(SEGMENT_RE) || []) {
      const reason = checkSegment(segment);
      if (reason) return reason;
    }
  }
  return null;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        decision: "force_ask",
        reason: `Unable to parse hook input (${err.message}); requesting confirmation for safety.`,
      })
    );
    return;
  }

  const args = payload?.toolCall?.args || {};
  const cmd = args.CommandLine || args.commandLine || args.command || "";
  const reason = inspectCommandLine(cmd);

  process.stdout.write(
    JSON.stringify(
      reason
        ? { decision: "force_ask", reason: `Destructive command requires confirmation: ${reason}.` }
        : { decision: "allow" }
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = { inspectCommandLine };
