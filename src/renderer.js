// Global variable to hold our data so we can search it instantly
let currentData = [];

// --- 1. CLOCK (DATE & TIME) ---
function updateClock() {
  const now = new Date();
  const options = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  document.getElementById("clock").innerText = now.toLocaleDateString(
    "en-US",
    options,
  );
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. FETCH DATA FROM BACKEND ---
async function loadData() {
  try {
    const data = await window.api.getData();

    // Sort data so the newest modified files are at the top
    // (Comparing timestamps created by parsing the mtime strings)
    currentData = data.sort((a, b) => {
      // We use the raw file modification time if available, or fallback to standard sorting
      let timeA = new Date("1970/01/01 " + a.mtime).getTime();
      let timeB = new Date("1970/01/01 " + b.mtime).getTime();
      return timeB - timeA; // Descending order
    });

    // Re-render the table applying the current search filter
    renderTable();
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

// --- 3. RENDER TABLE WITH SEARCH FILTER ---
function renderTable() {
  const tbody = document.getElementById("tableBody");
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();

  tbody.innerHTML = "";

  // Filter the data based on the search box
  const filteredData = currentData.filter((f) =>
    f.name.toLowerCase().includes(searchTerm),
  );

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No files match your search...</td></tr>`;
    return;
  }

  filteredData.forEach((f) => {
    const tr = document.createElement("tr");

    let badgeClass = "badge-secondary";
    if (f.status === "DONE") badgeClass = "badge-success";
    if (f.status === "FAILED") badgeClass = "badge-danger";

    let actionBtn = f.output
      ? `<button class="btn btn-success btn-sm" onclick="window.api.openFile('${f.output.replace(/\\/g, "\\\\")}')">Open Folder</button>`
      : `<span class="text-muted">N/A</span>`;

    let retryBtn = `<button class="btn btn-primary btn-sm" onclick="window.api.retrigger('${f.name}')">Retry</button>`;

    tr.innerHTML = `
            <td><strong>${f.name}</strong></td>
            <td><span class="${badgeClass}">${f.status}</span></td>
            <td>${f.msg}</td>
            <td>${f.mtime}</td>
            <td>${f.ptime}</td>
            <td>${actionBtn}</td>
            <td>${retryBtn}</td>
        `;
    tbody.appendChild(tr);
  });
}

// --- 4. EVENT LISTENERS ---
// Listen for typing in the search bar and instantly re-render
document.getElementById("searchInput").addEventListener("input", renderTable);

// Refresh the data every 2 seconds
setInterval(loadData, 2000);
loadData();
