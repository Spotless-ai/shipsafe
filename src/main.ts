import "./style.css";
import { unzipSync, zip, type AsyncZippable } from "fflate";
import { formatBytes, safeArchivePath, scanFile, type ProjectFile } from "./scanner";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#">SPOTLESS<span>/</span>SHIPSAFE</a>
    <div class="trust"><i></i> LOCAL-ONLY · OPEN SOURCE</div>
  </header>
  <main>
    <section class="hero" id="hero">
      <p class="eyebrow">PRE-SHARE PROJECT CHECK</p>
      <h1>Don’t ship<br><em>your secrets.</em></h1>
      <p class="lead">Built something with AI? Check the project before it goes to GitHub, Discord, a client, or a collaborator.</p>
      <div class="actions">
        <label class="primary">Choose project folder<input id="folder-input" type="file" webkitdirectory multiple /></label>
        <label class="secondary">Open a ZIP<input id="zip-input" type="file" accept=".zip,application/zip" /></label>
      </div>
      <div class="promise">
        <span>01 · SCANS LOCALLY</span><span>02 · NEVER SHOWS SECRET VALUES</span><span>03 · NEVER CHANGES ORIGINALS</span>
      </div>
    </section>
    <section class="scanning hidden" id="scanning" aria-live="polite">
      <div class="scan-mark"><span></span></div>
      <p class="eyebrow">CHECKING PROJECT</p>
      <h2 id="scan-title">Reading files…</h2>
      <div class="progress"><i id="progress-bar"></i></div>
      <p id="scan-count">0 files checked</p>
    </section>
    <section class="results hidden" id="results">
      <div class="result-head">
        <div><p class="eyebrow">SCAN COMPLETE</p><h2 id="result-title">Review before you share.</h2></div>
        <button class="text-button" id="start-over">Scan another project</button>
      </div>
      <div class="stats">
        <article><strong id="blocker-count">0</strong><span>BLOCKERS</span></article>
        <article><strong id="warning-count">0</strong><span>WARNINGS</span></article>
        <article><strong id="safe-count">0</strong><span>SAFE FILES</span></article>
        <article><strong id="saved-size">0 B</strong><span>REMOVED</span></article>
      </div>
      <div class="review-head"><div><h3>Review exclusions</h3><p>Risky files are excluded by default. You stay in control.</p></div><span id="review-total"></span></div>
      <div class="findings" id="findings"></div>
      <div class="safe-strip" id="safe-strip"></div>
      <div class="export-bar">
        <div><span>READY TO EXPORT</span><strong id="export-summary"></strong></div>
        <button class="primary" id="export-button">Create safe ZIP <b>↗</b></button>
      </div>
    </section>
  </main>
  <footer><span>SHIPSAFE v1.0 · BY SPOTLESS</span><span>No account. No analytics. No uploads.</span></footer>
`;

const folderInput = document.querySelector<HTMLInputElement>("#folder-input")!;
const zipInput = document.querySelector<HTMLInputElement>("#zip-input")!;
const hero = document.querySelector<HTMLElement>("#hero")!;
const scanning = document.querySelector<HTMLElement>("#scanning")!;
const results = document.querySelector<HTMLElement>("#results")!;
const findings = document.querySelector<HTMLElement>("#findings")!;
const exportButton = document.querySelector<HTMLButtonElement>("#export-button")!;

let projectFiles: ProjectFile[] = [];
let projectName = "project";

folderInput.addEventListener("change", async () => {
  const files = [...(folderInput.files ?? [])];
  if (!files.length) return;
  const firstPath = files[0].webkitRelativePath || files[0].name;
  projectName = cleanName(firstPath.split("/")[0] || "project");
  await scan(files.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
});

zipInput.addEventListener("change", async () => {
  const input = zipInput.files?.[0];
  if (!input) return;
  projectName = cleanName(input.name.replace(/\.zip$/i, ""));
  showScanning(`Opening ${input.name}…`);
  try {
    const entries = unzipSync(new Uint8Array(await input.arrayBuffer()), { filter: (entry) => !entry.name.endsWith("/") });
    const files = Object.entries(entries).map(([path, bytes]) => ({ file: new File([bytes], path.split("/").pop() || "file"), path }));
    await scan(files);
  } catch {
    reset();
    alert("ShipSafe couldn’t open that ZIP. It may be encrypted, damaged, or use an unsupported compression method.");
  }
});

document.querySelector("#start-over")!.addEventListener("click", reset);
exportButton.addEventListener("click", exportSafeZip);

function cleanName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "project";
}

function showScanning(title: string): void {
  hero.classList.add("hidden");
  results.classList.add("hidden");
  scanning.classList.remove("hidden");
  document.querySelector("#scan-title")!.textContent = title;
}

async function scan(entries: Array<{ file: File; path: string }>): Promise<void> {
  showScanning("Looking for accidental leaks…");
  projectFiles = [];
  const progress = document.querySelector<HTMLElement>("#progress-bar")!;
  const count = document.querySelector<HTMLElement>("#scan-count")!;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    projectFiles.push(await scanFile(entry.file, entry.path));
    progress.style.width = `${((i + 1) / entries.length) * 100}%`;
    count.textContent = `${i + 1} of ${entries.length} files checked`;
    if (i % 25 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  renderResults();
}

function renderResults(): void {
  scanning.classList.add("hidden");
  results.classList.remove("hidden");
  findings.replaceChildren();

  const risky = projectFiles.filter((file) => file.issues.length);
  const blockers = risky.filter((file) => file.issues.some((issue) => issue.severity === "blocker")).length;
  const warnings = risky.length - blockers;
  const safe = projectFiles.length - risky.length;

  text("blocker-count", String(blockers));
  text("warning-count", String(warnings));
  text("safe-count", String(safe));
  text("review-total", `${risky.length} FILE${risky.length === 1 ? "" : "S"} NEED REVIEW`);
  text("result-title", blockers ? "Good catch. Review before you share." : warnings ? "A few things deserve a look." : "Clean scan. Ready to ship.");

  for (const projectFile of risky) findings.append(createFinding(projectFile));
  document.querySelector("#safe-strip")!.textContent = `${safe} files passed · Text files up to 2 MB were inspected · Binary contents were not interpreted`;
  updateSummary();
}

function createFinding(projectFile: ProjectFile): HTMLElement {
  const blocker = projectFile.issues.some((issue) => issue.severity === "blocker");
  const row = document.createElement("article");
  row.className = `finding ${blocker ? "blocker" : "warning"}`;

  const marker = document.createElement("span");
  marker.className = "severity";
  marker.textContent = blocker ? "BLOCK" : "CHECK";

  const info = document.createElement("div");
  const path = document.createElement("strong");
  path.textContent = projectFile.path;
  const details = document.createElement("p");
  details.textContent = projectFile.issues.map((issue) => issue.title).join(" · ");
  const reason = document.createElement("small");
  reason.textContent = projectFile.issues.map((issue) => issue.detail).join(" ");
  info.append(path, details, reason);

  const toggle = document.createElement("label");
  toggle.className = "exclude-toggle";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = projectFile.excluded;
  const label = document.createElement("span");
  label.textContent = "EXCLUDE";
  checkbox.addEventListener("change", () => {
    projectFile.excluded = checkbox.checked;
    row.classList.toggle("included", !checkbox.checked);
    updateSummary();
  });
  toggle.append(checkbox, label);
  row.append(marker, info, toggle);
  return row;
}

function updateSummary(): void {
  const included = projectFiles.filter((file) => !file.excluded);
  const excluded = projectFiles.filter((file) => file.excluded);
  const removedBytes = excluded.reduce((sum, file) => sum + file.file.size, 0);
  text("saved-size", formatBytes(removedBytes));
  text("export-summary", `${included.length} files included · ${excluded.length} excluded`);
  exportButton.disabled = included.length === 0;
}

async function exportSafeZip(): Promise<void> {
  const included = projectFiles.filter((file) => !file.excluded);
  if (!included.length) return;
  exportButton.disabled = true;
  exportButton.textContent = "Building ZIP…";
  try {
    const archive: AsyncZippable = {};
    for (let i = 0; i < included.length; i++) {
      const item = included[i];
      let outputPath = safeArchivePath(item.path);
      let copy = 2;
      while (Object.hasOwn(archive, outputPath)) {
        const dot = outputPath.lastIndexOf(".");
        outputPath = dot > 0
          ? `${outputPath.slice(0, dot)}-${copy}${outputPath.slice(dot)}`
          : `${outputPath}-${copy}`;
        copy++;
      }
      archive[outputPath] = new Uint8Array(await item.file.arrayBuffer());
      exportButton.textContent = `Reading ${i + 1}/${included.length}…`;
      if (i % 10 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      zip(archive, { level: 6 }, (error, data) => error ? reject(error) : resolve(data));
    });
    const output = new Uint8Array(bytes.byteLength);
    output.set(bytes);
    const blob = new Blob([output.buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}-shipsafe.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    exportButton.textContent = "Safe ZIP downloaded ✓";
  } catch {
    alert("ShipSafe ran out of memory while building this ZIP. Try removing very large files and run it again.");
    exportButton.textContent = "Create safe ZIP ↗";
  } finally {
    exportButton.disabled = false;
  }
}

function text(id: string, value: string): void {
  document.querySelector(`#${id}`)!.textContent = value;
}

function reset(): void {
  projectFiles = [];
  folderInput.value = "";
  zipInput.value = "";
  results.classList.add("hidden");
  scanning.classList.add("hidden");
  hero.classList.remove("hidden");
}
