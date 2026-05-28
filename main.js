const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chokidar = require("chokidar");

// --- 1. CONFIGURATION & PATHS ---
// Dynamically use D:\ on Windows, and the Desktop on Mac for easy testing
const basePath =
  os.platform() === "win32"
    ? "D:\\"
    : path.join(os.homedir(), "Desktop", "GapFlushTest");
const SOURCE_DIR = path.join(basePath, "Source");
const DESIRED_DIR = path.join(basePath, "Desired");
const STATE_FILE = path.join(basePath, ".processed_db.json");

const MAP_RESULT = { 0: "NO", 1: "OF", "-1": "UF" };

// Ensure directories exist
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

// --- 3. DATA CONVERSION ENGINE ---
// --- 3. DATA CONVERSION ENGINE ---
function convertFile(inputPath, outputPath) {
  try {
    const fileContent = fs.readFileSync(inputPath, "utf-8").trim();
    if (!fileContent) return { ok: false, msg: "Empty file" };

    const lines = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) return { ok: false, msg: "No valid rows" };

    // Process header from the first row
    const firstRow = lines[0].split(",");
    const header = [
      firstRow[2],
      "Final",
      firstRow[0],
      firstRow[1] ? firstRow[1].replace(/ /g, ":") : "",
    ].join(",");

    let outputLines = [header];
    let hasMissingFields = false; // <-- NEW: Flag to track missing data

    // Process each data row
    lines.forEach((line) => {
      let cols = line.split(",");

      // NEW: Check if the measured value (index 10) or status (index 11) is blank or missing
      if (
        cols.length < 12 ||
        !cols[10] ||
        cols[10].trim() === "" ||
        !cols[11] ||
        cols[11].trim() === ""
      ) {
        hasMissingFields = true;
      }

      // Pad columns to prevent out-of-bounds errors
      while (cols.length < 12) cols.push("");

      const key = [cols[4], cols[5], cols[6]].filter(Boolean).join("_");

      const lsl = parseFloat(cols[7]);
      const usl = parseFloat(cols[9]);
      const measuredStr = cols[10].trim();
      const measured = parseFloat(measuredStr);

      // Pass/Fail Logic
      let pf = "F";
      if (!isNaN(measured) && !isNaN(lsl) && !isNaN(usl)) {
        if (measured >= lsl && measured <= usl) pf = "P";
      }

      // Reason Code Mapping
      const rfCode = cols[11].trim();
      const rf = MAP_RESULT[rfCode] || "NG";

      // Construct Output Row
      const outRow = [key, pf, rf, measuredStr, cols[7], cols[9]].join(",");
      outputLines.push(outRow);
    });

    // Write to Desired folder
    fs.writeFileSync(outputPath, outputLines.join("\n"), "utf-8");

    // NEW: Return a warning message if blanks were detected, otherwise standard Success
    const finalMsg = hasMissingFields
      ? "Processed (Missing source fields)"
      : "Success";
    return { ok: true, msg: finalMsg };
  } catch (error) {
    return { ok: false, msg: error.message };
  }
}

// --- 4. THE WATCHER ---
function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".csv" && ext !== ".txt") return;

  const stats = fs.statSync(filePath);
  const mtime = stats.mtimeMs;
  const fileName = path.basename(filePath);

  // Only process if it's new or has been modified
  if (!stateDB[fileName] || stateDB[fileName].mtime < mtime) {
    const baseName = path.parse(fileName).name;
    const outputPath = path.join(DESIRED_DIR, `${baseName}_converted.txt`);

    const result = convertFile(filePath, outputPath);

    stateDB[fileName] = {
      mtime: mtime,
      status: result.ok ? "DONE" : "FAILED",
      msg: result.msg,
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
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
  });

  watcher.on("add", processFile).on("change", processFile);
}

// --- 5. ELECTRON APP & IPC BRIDGE ---
let mainWindow;

app.whenReady().then(() => {
  startWatcher();

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: "GapFlush Live Dashboard",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
});

// IPC: Provide data to the frontend Dashboard
ipcMain.handle("get-data", () => {
  try {
    const files = fs.readdirSync(SOURCE_DIR);
    let dashboardData = [];

    files.forEach((file) => {
      const ext = path.extname(file).toLowerCase();
      if (ext !== ".csv" && ext !== ".txt") return;

      const filePath = path.join(SOURCE_DIR, file);
      const stats = fs.statSync(filePath);
      const rec = stateDB[file] || {};

      dashboardData.push({
        name: file,
        status: rec.status || "NEW",
        msg: rec.msg || "",
        mtime: new Date(stats.mtimeMs).toLocaleTimeString(),
        ptime: rec.processed_time || "",
        output: rec.output || "",
      });
    });

    return dashboardData;
  } catch (e) {
    return [];
  }
});

// IPC: Open the converted file locally
ipcMain.handle("open-file", (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// IPC: Retrigger processing
ipcMain.handle("retrigger-file", (event, fileName) => {
  const filePath = path.join(SOURCE_DIR, fileName);
  if (fs.existsSync(filePath)) {
    processFile(filePath);
  }
});
