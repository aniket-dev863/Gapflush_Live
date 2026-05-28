# 🚀 GapFlush Live Engine

GapFlush Live is a real-time, offline desktop application designed for automated file conversion and inspection monitoring on the factory floor.

It actively monitors incoming inspection files, processes the data against required limits, and generates clean, formatted output files instantly—all while providing a live dashboard for the operator.

---

## 🛠️ How to Use (For Operators)

This application is 100% self-contained and requires **no internet connection** or special software installations.

1. **Start the App:** Simply double-click the `gapflush-live Setup 1.0.0.exe` file.
2. **The Folders:** Upon opening, the app will automatically ensure two folders exist on your `D:\` drive:
   - `D:\Source\`
   - `D:\Desired\`
3. **Process Files:** Drag and drop your raw inspection `.txt` or `.csv` files directly into the `D:\Source\` folder.
4. **View Results:** The dashboard will update instantly. Your converted, fully formatted files will automatically appear in the `D:\Desired\` folder.

---

## 📊 Dashboard Features

- **Live Search:** Use the search bar in the top right to instantly filter files by name without interrupting the background processing.
- **Auto-Sorting:** The newest processed files will always appear at the very top of the table.
- **Direct Access:** Click the green **"Open Folder"** button next to any successful file to immediately view the output file.
- **Retry Button:** If a file fails to process (e.g., if it was currently in use by another program), click the blue **"Retry"** button to attempt processing again.

### Understanding Status Messages

| Status Badge  | Message                             | Meaning                                                                                        |
| :------------ | :---------------------------------- | :--------------------------------------------------------------------------------------------- |
| 🟢 **DONE**   | _Success_                           | The file was converted perfectly with all data intact.                                         |
| 🟢 **DONE**   | _Processed (Missing source fields)_ | The file was converted, but the original source file had missing measurements or status codes. |
| 🔴 **FAILED** | _Empty file / No valid rows_        | The system could not read the file, or the file contained no actual inspection data.           |

---

## 💻 Technical Details (For IT / Maintenance)

- **Architecture:** Built on Node.js and Electron.
- **Environment:** Compatible with Windows 10 and Windows 11 (64-bit & 32-bit via Win32 API).
- **Security:** Operates entirely offline. Content Security Policy (CSP) restricts all outbound network traffic.
- **Dependencies:** None. Chromium browser and Node runtime are bundled directly into the executable.
