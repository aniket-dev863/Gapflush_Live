const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chokidar = require("chokidar");

// --- 1. CONFIGURATION & PATHS ---
const basePath =
  os.platform() === "win32"
    ? "D:\\"
    : path.join(os.homedir(), "Desktop", "GapFlushTest");
const SOURCE_DIR = path.join(basePath, "Source");
const DESIRED_DIR = path.join(basePath, "Desired");
let STATE_FILE;

const MAP_RESULT = { 0: "NO", 1: "OF", "-1": "UF" };

[SOURCE_DIR, DESIRED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- 2. STATE MANAGEMENT ---
let stateDB = {};
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      stateDB = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch (e) {
      stateDB = {};
    }
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateDB, null, 2));
}

// --- 3. THE SMART CONVERSION ENGINE ---
function convertFile(inputPath, outputPath) {
  try {
    const fileContent = fs.readFileSync(inputPath, "utf-8").trim();

    // Situation 2: Fatal Errors
    if (!fileContent)
      return { ok: false, msg: "Error: File is completely empty." };

    const lines = fileContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0)
      return { ok: false, msg: "Error: No valid data rows found." };

    // Header & VIN Extraction (Formatting Date to dd-mm-yyyy)
    // Header & VIN Extraction (Formatting Date to dd-mm-yyyy)
    const firstRow = lines[0].split(",");
    const vin = firstRow[2] ? firstRow[2].trim() : "";

    if (!vin)
      return {
        ok: false,
        msg: "Error: Missing VIN / BSN in header. File rejected.",
      };

    // Regex swaps mm/dd/yyyy to dd-mm-yyyy
    const formattedDate = firstRow[0]
      ? firstRow[0].replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$2-$1-$3")
      : "";

    const header = [
      vin,
      "Final",
      formattedDate,
      firstRow[1] ? firstRow[1].replace(/ /g, ":") : "",
    ].join(",");

    let outputLines = [header];
    let missingFields = [];

    // Data Row Parsing
    lines.forEach((line) => {
      let cols = line.split(",");
      if (cols.length < 4) return;

      const pointName = cols[3] ? cols[3].trim() : "Unknown Joint";

      // Identify specific missing data points
      if (cols.length < 11 || !cols[10] || cols[10].trim() === "") {
        if (!missingFields.includes(`Measurement: ${pointName}`))
          missingFields.push(`Measurement: ${pointName}`);
      }
      if (cols.length < 12 || !cols[11] || cols[11].trim() === "") {
        if (!missingFields.includes(`Status Code: ${pointName}`))
          missingFields.push(`Status Code: ${pointName}`);
      }

      while (cols.length < 12) cols.push("");

      const key = [cols[4], cols[5], cols[6]].filter(Boolean).join("_");
      const lsl = parseFloat(cols[7]);
      const usl = parseFloat(cols[9]);
      const measuredStr = cols[10].trim();
      const measured = parseFloat(measuredStr);

      let pf = "F";
      if (!isNaN(measured) && !isNaN(lsl) && !isNaN(usl)) {
        if (measured >= lsl && measured <= usl) pf = "P";
      }

      const rfCode = cols[11].trim();
      const rf = MAP_RESULT[rfCode] || "NG";

      outputLines.push([key, pf, rf, measuredStr, cols[7], cols[9]].join(","));
    });

    fs.writeFileSync(outputPath, outputLines.join("\n"), "utf-8");

    const finalMsg =
      missingFields.length > 0
        ? "Processed with missing data. Operator review required."
        : "Processed perfectly.";
    return { ok: true, msg: finalMsg, missing: missingFields };
  } catch (error) {
    return { ok: false, msg: `Error: ${error.message}` };
  }
}

// --- 4. THE WATCHER ---
function processFile(filePath, force = false) {
  const fileName = path.basename(filePath);

  // Excel Ghost File Protection
  if (fileName.startsWith("~$") || fileName.startsWith(".")) return;

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".csv" && ext !== ".txt") return;

  const stats = fs.statSync(filePath);
  const mtime = stats.mtimeMs;

  if (force || !stateDB[fileName] || stateDB[fileName].mtime < mtime) {
    const baseName = path.parse(fileName).name;
    const outputPath = path.join(DESIRED_DIR, `${baseName}_converted.txt`);

    const result = convertFile(filePath, outputPath);

    stateDB[fileName] = {
      mtime: mtime,
      status: result.ok
        ? result.missing && result.missing.length > 0
          ? "WARNING"
          : "DONE"
        : "FAILED",
      msg: result.msg,
      missing: result.missing || [],
      output: result.ok ? outputPath : null,
      processed_time: new Date().toLocaleString(),
    };
    saveState();
  }
}

function startWatcher() {
  loadState();
  const watcher = chokidar.watch(SOURCE_DIR, {
    persistent: true,
    ignored: /(^|[\/\\])\~\$.*/, // Ignore Excel lock files
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
  });

  watcher
    .on("add", (p) => processFile(p, false))
    .on("change", (p) => processFile(p, false));
}

// --- 5. ELECTRON APP ---
let mainWindow;
app.whenReady().then(() => {
  STATE_FILE = path.join(app.getPath("userData"), "processed_db.json");
  startWatcher();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "GapFlush Live Dashboard",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
});

ipcMain.handle("get-data", () => {
  try {
    const files = fs.readdirSync(SOURCE_DIR);
    let dashboardData = [];
    files.forEach((file) => {
      const ext = path.extname(file).toLowerCase();
      if ((ext !== ".csv" && ext !== ".txt") || file.startsWith("~$")) return;
      const stats = fs.statSync(path.join(SOURCE_DIR, file));
      const rec = stateDB[file] || {};
      dashboardData.push({
        name: file,
        status: rec.status || "NEW",
        msg: rec.msg || "Waiting in queue...",
        missing: rec.missing || [],
        mtime: new Date(stats.mtimeMs).toLocaleString(),
        ptime: rec.processed_time || "Not processed yet",
        output: rec.output || "",
      });
    });
    return dashboardData;
  } catch (e) {
    return [];
  }
});

ipcMain.handle("open-file", (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});
ipcMain.handle("retrigger-file", (event, fileName) => {
  const filePath = path.join(SOURCE_DIR, fileName);
  if (fs.existsSync(filePath)) processFile(filePath, true);
});
