export type Severity = "blocker" | "warning";

export interface Issue {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface ProjectFile {
  path: string;
  file: File;
  issues: Issue[];
  excluded: boolean;
  scanned: boolean;
}

const MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024;

const secretRules: Array<{ code: string; title: string; pattern: RegExp }> = [
  { code: "private-key", title: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { code: "aws-key", title: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { code: "github-token", title: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/ },
  { code: "openai-key", title: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { code: "stripe-live", title: "Live Stripe secret", pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { code: "slack-token", title: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { code: "discord-webhook", title: "Discord webhook", pattern: /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/ },
  { code: "generic-secret", title: "Hard-coded credential", pattern: /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+\-=]{16,}/i }
];

const textExtensions = new Set([
  "c", "cc", "conf", "cpp", "cs", "css", "csv", "env", "go", "graphql", "h", "hpp",
  "html", "ini", "java", "js", "json", "jsx", "kt", "md", "mjs", "php", "properties",
  "py", "rb", "rs", "sh", "sql", "svelte", "swift", "toml", "ts", "tsx", "txt", "vue",
  "xml", "yaml", "yml"
]);

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function safeArchivePath(inputPath: string): string {
  const normalized = normalizePath(inputPath).replace(/^[A-Za-z]:/, "").replace(/^\/+/, "");
  const parts = normalized.split("/").filter((part) => part && part !== "." && part !== "..");
  const output = parts.join("/") || "unnamed-file";
  // fflate also uses ordinary objects internally; a null-prototype input alone
  // cannot preserve this exact root name. Show the rewritten name in review.
  return output === "__proto__" ? "__proto__-file" : output;
}

function basename(path: string): string {
  return normalizePath(path).split("/").pop() ?? path;
}

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function pathIssues(inputPath: string): Issue[] {
  const path = normalizePath(inputPath);
  const lower = path.toLowerCase();
  const name = basename(lower);
  const issues: Issue[] = [];

  if (/^(?:[A-Za-z]:[\\/]|[\\/])/.test(inputPath) || normalizePath(inputPath).split("/").includes("..")) {
    issues.push({ code: "unsafe-path", severity: "blocker", title: "Unsafe archive path", detail: "This path tries to escape the project folder and is rewritten during export." });
  }

  if (/(^|\/)\.env(?:\.|$)/.test(lower) && !/\.env\.(?:example|sample|template)$/.test(lower)) {
    issues.push({ code: "env-file", severity: "blocker", title: "Environment file", detail: "Often contains live API keys or passwords." });
  }
  if (/(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(lower) || /\.(?:pem|p12|pfx|key)$/.test(lower)) {
    issues.push({ code: "key-file", severity: "blocker", title: "Key or certificate file", detail: "Private key material should not be included in a shared project." });
  }
  if (/(^|\/)(?:credentials|service-account|service_account)(?:\.[^/]*)?\.json$/.test(lower)) {
    issues.push({ code: "credentials-file", severity: "blocker", title: "Credentials file", detail: "This filename commonly contains account credentials." });
  }
  if (/(^|\/)(?:\.git|node_modules|\.next\/cache|\.cache|__pycache__|\.venv|venv)(\/|$)/.test(lower)) {
    issues.push({ code: "generated-junk", severity: "warning", title: "Generated or local-only files", detail: "Usually makes a ZIP huge and should be recreated after download." });
  }
  if (/\.(?:sqlite|sqlite3|db)$/.test(lower)) {
    issues.push({ code: "local-database", severity: "warning", title: "Local database", detail: "May contain accounts, messages, test users, or other private data." });
  }
  if (/\.(?:bak|backup|old|orig|swp)$/.test(lower) || /(?:^|\/)(?:backup|copy of )/i.test(path)) {
    issues.push({ code: "backup-file", severity: "warning", title: "Backup or editor file", detail: "Old copies can contain information removed from the current version." });
  }
  if ([".ds_store", "thumbs.db", "desktop.ini"].includes(name)) {
    issues.push({ code: "os-junk", severity: "warning", title: "Operating-system junk", detail: "Not dangerous, but unnecessary in a shared project." });
  }
  return issues;
}

function looksLikeText(path: string, bytes: Uint8Array): boolean {
  if (textExtensions.has(extension(path)) || basename(path).startsWith(".")) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.includes(0)) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128) printable++;
  }
  return sample.length === 0 || printable / sample.length > 0.9;
}

export function contentIssues(text: string): Issue[] {
  const issues: Issue[] = [];
  for (const rule of secretRules) {
    if (rule.pattern.test(text)) {
      issues.push({
        code: rule.code,
        severity: "blocker",
        title: rule.title,
        detail: "A value matching this credential type was found. Its contents are intentionally hidden."
      });
    }
  }
  if (/(?:[A-Z]:(?:\\+|\/+)(?:Users)(?:\\+|\/+)[^\\/\r\n]+|\/(?:Users|home)\/[^/\r\n]+)/.test(text)) {
    issues.push({ code: "personal-path", severity: "warning", title: "Personal computer path", detail: "Contains a local username or home-folder path." });
  }
  return issues;
}

export async function scanFile(file: File, path = file.name): Promise<ProjectFile> {
  const inputPath = path || file.name;
  const normalized = safeArchivePath(inputPath);
  const issues = pathIssues(inputPath);
  let scanned = false;

  if (file.size <= MAX_TEXT_SCAN_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (looksLikeText(normalized, bytes)) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      issues.push(...contentIssues(text));
      scanned = true;
    }
  }

  const unique = [...new Map(issues.map((issue) => [issue.code, issue])).values()];
  return {
    path: normalized,
    file,
    issues: unique,
    excluded: unique.length > 0,
    scanned
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; value >= 1024 && i < units.length; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}
