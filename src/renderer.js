let currentData = [];
let sortColumn = "ptime";
let sortAsc = false;

let mainSearchTerm = "";
let modalSearchTerm = "";
let mainNavIndex = -1;
let modalNavIndex = -1;

// --- DATE FORMATTER ---
function formatExactDate(dateStr) {
  if (!dateStr || dateStr.includes("Not processed")) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

window.setSort = function (column) {
  if (sortColumn === column) sortAsc = !sortAsc;
  else {
    sortColumn = column;
    sortAsc = true;
  }
  renderTable();
};

window.showToast = function (message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast-pill";
  if (type === "error") toast.style.backgroundColor = "#ef4444";
  else if (type === "warning") toast.style.backgroundColor = "#f59e0b";
  else if (type === "info") toast.style.backgroundColor = "#3b82f6";
  else toast.style.backgroundColor = "#10b981";

  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// --- DATA ENGINE ---
async function fetchData() {
  try {
    currentData = await window.api.getData();
    updateStats();
    updateIssueLogButton();
    renderTable();
    renderModalTable();
  } catch (error) {
    console.error("Data sync error:", error);
  }
}

fetchData();
setInterval(fetchData, 2000);
setInterval(
  () =>
    (document.getElementById("clock").innerText = new Date().toLocaleString()),
  1000,
);

// --- STATS UPDATER ---
function updateStats() {
  let done = 0,
    warn = 0,
    fail = 0;
  currentData.forEach((f) => {
    if (f.status === "DONE") done++;
    else if (f.status === "WARNING") warn++;
    else if (f.status === "FAILED") fail++;
  });

  const dEl = document.getElementById("stat-done");
  const wEl = document.getElementById("stat-warn");
  const fEl = document.getElementById("stat-fail");

  if (dEl) dEl.innerText = done;
  if (wEl) wEl.innerText = warn;
  if (fEl) fEl.innerText = fail;
}

window.triggerRetry = function (fileName, btnElement) {
  if (btnElement) {
    btnElement.innerHTML = "⏳ Retrying...";
    btnElement.disabled = true;
    btnElement.classList.add("btn-secondary");
    btnElement.classList.remove("btn-outline-primary", "btn-primary");
  }
  window.api.retrigger(fileName);
  showToast(`🔄 Retry queued for ${fileName}`, "info");
};

// --- MAIN GRID RENDERER (SOFT UI) ---
function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  let filteredData = currentData.filter((f) =>
    f.name.toLowerCase().includes(mainSearchTerm),
  );

  filteredData.sort((a, b) => {
    let valA = a[sortColumn] || "";
    let valB = b[sortColumn] || "";
    if (sortColumn === "mtime" || sortColumn === "ptime") {
      valA = isNaN(Date.parse(valA)) ? 0 : new Date(valA).getTime();
      valB = isNaN(Date.parse(valB)) ? 0 : new Date(valB).getTime();
    } else {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  document.querySelectorAll("thead th .sort-icon").forEach((icon) => {
    icon.innerHTML = "↕";
    icon.parentElement.classList.remove("active");
  });
  const activeIcon = document.getElementById(`icon-${sortColumn}`);
  if (activeIcon) {
    activeIcon.innerHTML = sortAsc ? "▲" : "▼";
    activeIcon.parentElement.classList.add("active");
  }

  if (filteredData.length === 0) {
    // Updated colspan to 7
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h5 class="fw-bold">No Data Found</h5>
        </td></tr>`;
    return;
  }

  filteredData.forEach((f) => {
    const tr = document.createElement("tr");
    tr.className = `row-${f.status}`;

    let badgeHtml = "";
    let elegantMsg = "";

    if (f.status === "DONE") {
      badgeHtml = `<span class="badge-soft-success">SUCCESS</span>`;
      elegantMsg = `<span class="fw-bold" style="color:#10b981;">✓ Valid Scan</span>`;
    } else if (f.status === "WARNING") {
      badgeHtml = `<span class="badge-soft-warning">WARNING</span>`;
      elegantMsg = `<span class="fw-bold" style="color:#f59e0b;">Missing Data</span>`;
    } else if (f.status === "FAILED") {
      badgeHtml = `<span class="badge-soft-danger">FAILED</span>`;
      elegantMsg = `<span class="fw-bold" style="color:#ef4444;">Parse Error</span>`;
    }

    // Restore the Folder Button Action
    let actionBtn = f.output
      ? `<button class="btn btn-outline-secondary btn-sm btn-folder px-3" onclick="window.api.openFile('${f.output.replace(/\\/g, "\\\\")}')">📂 Open</button>`
      : `<span class="text-muted">-</span>`;

    let retryBtn = `<button class="btn btn-outline-primary btn-sm btn-retry px-3" onclick="triggerRetry('${f.name}', this)">Retry</button>`;

    tr.innerHTML = `
            <td class="fw-bold" style="color:#0f172a;">${f.name}</td>
            <td>${badgeHtml}</td>
            <td>${elegantMsg}</td>
            <td class="tabular-data">${formatExactDate(f.mtime)}</td>
            <td class="tabular-data">${formatExactDate(f.ptime)}</td>
            <td class="text-center">${actionBtn}</td>
            <td class="text-center">${retryBtn}</td>
        `;
    tbody.appendChild(tr);
  });
}

function updateIssueLogButton() {
  const issueBtn = document.getElementById("issueLogBtn");
  if (!issueBtn) return;
  const anomalies = currentData.filter(
    (f) => f.status === "WARNING" || f.status === "FAILED",
  );
  if (anomalies.length > 0) {
    issueBtn.className = "btn btn-danger w-100 fw-bold animate-pulse";
    issueBtn.innerHTML = `⚠️ Issue Log Dashboard (${anomalies.length} Faults)`;
  } else {
    issueBtn.className = "btn btn-secondary w-100 fw-bold";
    issueBtn.innerHTML = `✔️ No Issues Detected`;
  }
}

window.openIssueModal = function () {
  document.getElementById("issueModal").style.display = "flex";
  document.getElementById("modalSearchInput").value = "";
  modalSearchTerm = "";
  renderModalTable();
  setTimeout(() => document.getElementById("modalSearchInput").focus(), 100);
};

window.closeIssueModal = function () {
  document.getElementById("issueModal").style.display = "none";
};

function renderModalTable() {
  const modalBody = document.getElementById("modalTableBody");
  if (!modalBody) return;

  modalBody.innerHTML = "";
  let issues = currentData.filter(
    (f) => f.status === "WARNING" || f.status === "FAILED",
  );
  if (modalSearchTerm) {
    issues = issues.filter((f) =>
      f.name.toLowerCase().includes(modalSearchTerm),
    );
  }

  if (issues.length === 0) {
    modalBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 fw-bold text-success">🎉 All shop floor systems clear! No faults detected.</td></tr>`;
    return;
  }

  issues.forEach((f) => {
    const tr = document.createElement("tr");
    let typeBadge =
      f.status === "WARNING"
        ? `<span class="badge-warning">WARNING</span>`
        : `<span class="badge-danger">FAILED</span>`;
    let diagnosticCell =
      f.status === "WARNING"
        ? f.missing
            .map(
              (issue) =>
                `<div class="mb-1"><span class="badge text-dark" style="background-color: #fcd34d; border: 1px solid #d97706;">🩹 ${issue}</span></div>`,
            )
            .join("")
        : `<span class="text-danger fw-bold">${f.msg}</span>`;
    let retryBtn = `<button class="btn btn-primary btn-sm w-100 btn-retry" onclick="triggerRetry('${f.name}', this)">Retry</button>`;

    tr.innerHTML = `
            <td><strong>${f.name}</strong></td>
            <td>${typeBadge}</td>
            <td>${diagnosticCell}</td>
            <td class="tabular-data">${formatExactDate(f.ptime)}</td>
            <td>${retryBtn}</td>
        `;
    modalBody.appendChild(tr);
  });
}

// --- SEARCH & KEYBOARD LOGIC ---
document.addEventListener("DOMContentLoaded", () => {
  const mainInput = document.getElementById("mainSearchInput");
  const mainBox = document.getElementById("mainSuggestionBox");
  if (mainInput) {
    mainInput.addEventListener("input", (e) => {
      mainSearchTerm = e.target.value.toLowerCase().trim();
      mainNavIndex = -1;
      const matches = currentData.filter((f) =>
        f.name.toLowerCase().includes(mainSearchTerm),
      );
      if (!mainSearchTerm || matches.length === 0) {
        mainBox.style.display = "none";
      } else {
        mainBox.innerHTML = "";
        mainBox.style.display = "block";
        matches.slice(0, 8).forEach((match) => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          div.innerHTML = `📄 <strong>${match.name}</strong>`;
          div.addEventListener("click", () => {
            mainInput.value = match.name;
            mainSearchTerm = match.name.toLowerCase();
            mainBox.style.display = "none";
            renderTable();
          });
          mainBox.appendChild(div);
        });
      }
      renderTable();
    });

    mainInput.addEventListener("keydown", (e) => {
      const items = mainBox.querySelectorAll(".suggestion-item");
      if (items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mainNavIndex = (mainNavIndex + 1) % items.length;
        items.forEach((it, i) =>
          it.classList.toggle("active-nav", i === mainNavIndex),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        mainNavIndex = (mainNavIndex - 1 + items.length) % items.length;
        items.forEach((it, i) =>
          it.classList.toggle("active-nav", i === mainNavIndex),
        );
      } else if (e.key === "Enter" && mainNavIndex >= 0) {
        e.preventDefault();
        items[mainNavIndex].click();
      }
    });
  }

  const modalInput = document.getElementById("modalSearchInput");
  const modalBox = document.getElementById("modalSuggestionBox");
  if (modalInput) {
    modalInput.addEventListener("input", (e) => {
      modalSearchTerm = e.target.value.toLowerCase().trim();
      modalNavIndex = -1;
      const issues = currentData.filter(
        (f) => f.status === "WARNING" || f.status === "FAILED",
      );
      const matches = issues.filter((f) =>
        f.name.toLowerCase().includes(modalSearchTerm),
      );
      if (!modalSearchTerm || matches.length === 0) {
        modalBox.style.display = "none";
      } else {
        modalBox.innerHTML = "";
        modalBox.style.display = "block";
        matches.slice(0, 8).forEach((match) => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          div.innerHTML = `⚙️ <strong>${match.name}</strong>`;
          div.addEventListener("click", () => {
            modalInput.value = match.name;
            modalSearchTerm = match.name.toLowerCase();
            modalBox.style.display = "none";
            renderModalTable();
          });
          modalBox.appendChild(div);
        });
      }
      renderModalTable();
    });

    modalInput.addEventListener("keydown", (e) => {
      const items = modalBox.querySelectorAll(".suggestion-item");
      if (items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        modalNavIndex = (modalNavIndex + 1) % items.length;
        items.forEach((it, i) =>
          it.classList.toggle("active-nav", i === modalNavIndex),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        modalNavIndex = (modalNavIndex - 1 + items.length) % items.length;
        items.forEach((it, i) =>
          it.classList.toggle("active-nav", i === modalNavIndex),
        );
      } else if (e.key === "Enter" && modalNavIndex >= 0) {
        e.preventDefault();
        items[modalNavIndex].click();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (
      mainInput &&
      !mainInput.contains(e.target) &&
      !mainBox.contains(e.target)
    )
      mainBox.style.display = "none";
    if (
      modalInput &&
      !modalInput.contains(e.target) &&
      !modalBox.contains(e.target)
    )
      modalBox.style.display = "none";
  });
});

window.exportShiftReport = function () {
  const issues = currentData.filter(
    (f) => f.status === "WARNING" || f.status === "FAILED",
  );
  if (issues.length === 0) {
    showToast("No errors to export.", "warning");
    return;
  }
  let csvContent =
    "File Name,Status Type,Diagnostic Error Message,Missing Data Points,Last Processed Time\n";
  issues.forEach((f) => {
    let missingString =
      f.missing && f.missing.length > 0 ? f.missing.join(" | ") : "N/A";
    let cleanMsg = f.msg.replace(/"/g, '""');
    csvContent += `"${f.name}","${f.status}","${cleanMsg}","${missingString}","${formatExactDate(f.ptime)}"\n`;
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Shift_Error_Report_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`✅ Exported Shift_Error_Report_${timestamp}.csv successfully!`);
};
