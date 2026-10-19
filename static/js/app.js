const terminal = document.getElementById("terminal");
const commandInput = document.getElementById("commandInput");
const editor = document.getElementById("editor");
const statusText = document.getElementById("statusText");
const fileList = document.getElementById("fileList");
const activeFileLabel = document.getElementById("activeFileLabel");

const history = [];
let historyIndex = -1;
let activeFile = "app.py";

function appendLine(text, className = "output") {
  const div = document.createElement("div");
  div.className = `terminal-line ${className}`;
  div.textContent = text;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

function setStatus(text) {
  statusText.textContent = text;
}

function setActiveFile(path) {
  activeFile = path;
  activeFileLabel.textContent = path;
  Array.from(fileList.children).forEach((item) => {
    item.classList.toggle("active", item.dataset.path === path);
  });
}

function printIntro() {
  appendLine("Welcome to the Kali-style local terminal.", "output");
  appendLine("Type 'help' to view available commands.", "output");
  appendLine("", "output");
}

function refreshFileList() {
  fetch("/api/files")
    .then((res) => res.json())
    .then((data) => {
      fileList.innerHTML = "";
      for (const item of data.items || []) {
        const row = document.createElement("div");
        row.className = "file-item" + (item.path === activeFile ? " active" : "");
        row.dataset.path = item.path;
        row.innerHTML = `
          <div class="file-name">${item.name}</div>
          <div class="file-kind">${item.type}</div>
        `;
        row.addEventListener("click", () => {
          const path = item.path;
          setActiveFile(path);
          fetch("/api/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path })
          })
            .then((response) => response.json())
            .then((payload) => {
              if (payload.ok) {
                editor.value = payload.content;
                setStatus("Loaded: " + payload.path);
              } else {
                appendLine("Failed to open file: " + payload.error, "error");
              }
            })
            .catch((error) => {
              appendLine("Read error: " + error, "error");
            });
        });
        fileList.appendChild(row);
      }
    })
    .catch(() => {
      fileList.innerHTML = '<div class="file-item"><div class="file-name">Unable to load files</div></div>';
    });
}

function runCommand(command) {
  if (!command.trim()) return;

  appendLine(`root@kali:~$ ${command}`, "command");
  history.push(command);
  historyIndex = history.length;

  fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.output) {
        appendLine(data.output, data.ok ? "output" : "error");
      }
      if (!data.ok) {
        appendLine(`Command exited with code ${data.rc}`, "error");
      }
      setStatus("Ready");
    })
    .catch((err) => {
      appendLine("Error contacting backend: " + err, "error");
      setStatus("Error");
    });
}

function saveCurrentFile() {
  const payload = {
    path: activeFile,
    content: editor.value
  };

  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        setStatus("Saved");
        appendLine(`Saved ${data.path}`, "output");
      } else {
        appendLine(`Save failed: ${data.error || "Unknown error"}`, "error");
      }
    })
    .catch((err) => {
      appendLine("Save error: " + err, "error");
    });
}

function loadDefaultFile() {
  fetch("/api/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: activeFile })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        editor.value = data.content;
      }
    });
}

document.getElementById("runCommandBtn").addEventListener("click", () => {
  const cmd = commandInput.value.trim();
  if (cmd) {
    runCommand(cmd);
    commandInput.value = "";
  } else {
    appendLine("No command entered.", "error");
  }
});

document.getElementById("saveFileBtn").addEventListener("click", saveCurrentFile);

document.getElementById("clearTerminalBtn").addEventListener("click", () => {
  terminal.innerHTML = "";
  setStatus("Cleared");
  printIntro();
});

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const command = commandInput.value;
    runCommand(command);
    commandInput.value = "";
  } else if (event.key === "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      commandInput.value = history[historyIndex];
    }
  } else if (event.key === "ArrowDown") {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      commandInput.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      commandInput.value = "";
    }
  }
});

printIntro();
setActiveFile(activeFile);
loadDefaultFile();
refreshFileList();
commandInput.focus();
