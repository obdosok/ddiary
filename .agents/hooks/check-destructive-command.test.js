"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { inspectCommandLine } = require("./check-destructive-command");

const AGENTS_DIR = path.resolve(__dirname, "..");

function runHookViaConfiguredCommand(stdinPayload) {
  const hooksJson = JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, "hooks.json"), "utf8"));
  const hookCmd = hooksJson["destructive-command-guard"].PreToolUse[0].hooks[0].command;
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd" : "sh";
  const shellArgs = isWindows ? ["/c", hookCmd] : ["-c", hookCmd];

  const res = spawnSync(shell, shellArgs, {
    cwd: AGENTS_DIR,
    input: stdinPayload,
    encoding: "utf8",
  });

  assert.equal(res.status, 0, `Hook exited with ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

describe("inspectCommandLine", () => {
  const destructiveCases = [
    // File & directory deletion (matching .claude/settings.json)
    "rm -rf dist",
    "rm -fr ./tmp",
    "rm -r folder",
    "rm file.txt",
    "Remove-Item -Recurse -Force build",
    "remove-item foo.txt",
    '& "Remove-Item" -Recurse build',
    "del foo.txt",
    "rmdir /s /q build",
    "rd /s /q build",
    "cmd /c rmdir /s /q build",
    // Destructive Git commands
    "git push --force origin main",
    "git push -f origin main",
    "git push --force-with-lease",
    "git push origin +main",
    "git -C c:\\work\\ddiary push --force",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git branch -D feature",
    "git branch -d -f feature",
    "git stash drop",
    "git stash clear",
    // Database / SQL drops & resets
    'psql -c "DROP TABLE users;"',
    'sqlite3 app.db "drop database test"',
    'mysql -e "DROP SCHEMA IF EXISTS public"',
    'psql -c "TRUNCATE TABLE logs;"',
    "dropdb mydb",
    "npx prisma migrate reset --force",
    'mongosh --eval "db.dropDatabase()"',
    // Chained, wrapped, subshell & obfuscated commands
    "cd foo && rm -rf bar",
    'powershell -Command "Remove-Item -Recurse tmp"',
    'bash -c "rm -rf build"',
    "echo $(rm -rf tmp)",
    "powershell -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAaABpACcA",
    "pwsh -enc AAA=",
    // Disk & Docker destructive commands
    "docker system prune -af",
    "docker compose down -v",
    "dd if=/dev/zero of=/dev/sda",
  ];

  for (const cmd of destructiveCases) {
    it(`flags destructive command: ${cmd}`, () => {
      const reason = inspectCommandLine(cmd);
      assert.ok(reason, `Expected destructive match for: ${cmd}`);
    });
  }

  const safeCases = [
    "git status",
    "git push origin main",
    "git push --follow-tags origin main",
    "git branch -d merged-feature",
    "git reset --soft HEAD~1",
    'git commit -m "Add rm -rf and DROP TABLE guard"',
    'echo "rm -rf and DROP TABLE"',
    "npm run format",
    "npm test",
    "Get-ChildItem -Force",
    'psql -c "SELECT * FROM dropdowns;"',
    "docker compose down",
    "",
  ];

  for (const cmd of safeCases) {
    it(`allows safe command: ${cmd || "<empty>"}`, () => {
      const reason = inspectCommandLine(cmd);
      assert.equal(reason, null, `Unexpected destructive match (${reason}) for: ${cmd}`);
    });
  }
});

describe("hooks.json CLI contract", () => {
  it("returns force_ask for destructive command", () => {
    const out = runHookViaConfiguredCommand(
      JSON.stringify({
        hookEventName: "PreToolUse",
        toolCall: { id: "t1", name: "run_command", args: { CommandLine: "rm -rf dist" } },
      })
    );
    assert.equal(out.decision, "force_ask");
    assert.match(out.reason, /Destructive command requires confirmation/);
  });

  it("returns allow for safe command", () => {
    const out = runHookViaConfiguredCommand(
      JSON.stringify({
        hookEventName: "PreToolUse",
        toolCall: { id: "t2", name: "run_command", args: { CommandLine: "git status" } },
      })
    );
    assert.deepEqual(out, { decision: "allow" });
  });

  it("fails safe with force_ask on malformed JSON input", () => {
    const out = runHookViaConfiguredCommand("{not-valid-json");
    assert.equal(out.decision, "force_ask");
    assert.match(out.reason, /Unable to parse hook input/);
  });
});
