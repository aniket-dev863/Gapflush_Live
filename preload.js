const { contextBridge, ipcRenderer } = require("electron");

// We are exposing a safe 'api' object to the frontend window
contextBridge.exposeInMainWorld("api", {
  // Ask the backend for the latest dashboard data
  getData: () => ipcRenderer.invoke("get-data"),

  // Tell the backend to open the file folder
  openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),

  // Tell the backend to re-run a specific file
  retrigger: (fileName) => ipcRenderer.invoke("retrigger-file", fileName),
});
