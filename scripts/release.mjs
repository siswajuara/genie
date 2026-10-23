import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { bumpVersion, root, versionFiles, versionState } from "./version.mjs";
const args = process.argv.slice(2),
  level = args.find(arg=>!arg.startsWith('--')) || "patch",
  tag = args.includes("--tag"),
  push = args.includes("--push");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
try {
  if(args.filter(arg=>!arg.startsWith('--')).length>1||args.some(arg=>arg.startsWith('--')&&!['--tag','--push','--dry-run'].includes(arg)))throw Error('Usage: release [patch|minor|major|VERSION] [--dry-run] [--tag] [--push]');
  if (push && !tag)
    throw Error(
      "Use --tag --push together to explicitly publish a release tag.",
    );
  if (tag && git("status", "--porcelain"))
    throw Error(
      "Commit or stash existing work before creating a release commit/tag. No files were changed.",
    );
  const branch=push?git('branch','--show-current'):'';
  if(push&&!branch)throw Error('Cannot push a release from detached HEAD.');
  const preview = await bumpVersion(level, { dryRun: true });
  if (args.includes("--dry-run")) {
    console.log(
      `Would prepare ${preview.tag}${tag ? ", commit version files and create annotated tag" : ""}${push ? ", then push HEAD and tag" : ""}.`,
    );
    process.exit(0);
  }
  if (tag) {
    try {
      git("rev-parse", "--verify", `refs/tags/${preview.tag}`);
      throw Error(`Tag ${preview.tag} already exists.`);
    } catch (error) {
      if (error.message?.includes("already exists")) throw error;
    }
  }
  const result = await bumpVersion(level);
  let previousTag;
  try {
    previousTag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  } catch {}
  const notes = git(
    "log",
    "--format=- %s",
    ...(previousTag ? [`${previousTag}..HEAD`] : ["-20"]),
  );
  const old = await fs
    .readFile(`${root}/CHANGELOG.md`, "utf8")
    .catch(() => "# Changelog\n");
  const entry = `\n## ${result.tag} — ${new Date().toISOString().slice(0, 10)}\n\n${notes || "- Maintenance release."}\n`;
  await fs.writeFile(
    `${root}/CHANGELOG.md`,
    old.replace(/^# Changelog\n/, "# Changelog\n" + entry),
  );
  if (tag) {
    git("add", "--", ...versionFiles, "CHANGELOG.md");
    git("commit", "-m", `Release ${result.tag}`);
    git("tag", "-a", result.tag, "-m", `Genie ${result.tag}`);
  }
  if (push) {
    git(
      "push",
      "--atomic",
      "origin",
      `HEAD:refs/heads/${branch}`,
      `refs/tags/${result.tag}`,
    );
  }
  await versionState();
  console.log(
    `Prepared ${result.tag}. ${push ? "GitHub Actions will build and publish the release." : tag ? "Annotated tag created locally; nothing was pushed." : "Review the version files and CHANGELOG.md; nothing was committed or pushed."}`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
