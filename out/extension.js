"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
let decoration;
function activate(context) {
    decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255,255,0,0.3)'
    });
    let currentPanel = null;
    const disposable = vscode.commands.registerCommand('ampMapper.togglePreview', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        // 🔁 TOGGLE LOGIC
        if (currentPanel) {
            currentPanel.dispose();
            currentPanel = null;
            return;
        }
        currentPanel = vscode.window.createWebviewPanel('ampPreview', 'HTML AMP Preview', vscode.ViewColumn.Two, { enableScripts: true });
        updatePreview(currentPanel, editor.document.getText());
        // 🔥 LIVE UPDATE
        const changeDoc = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document === editor.document && currentPanel) {
                updatePreview(currentPanel, editor.document.getText());
            }
        });
        // 🔹 Preview → Editor
        currentPanel.webview.onDidReceiveMessage(message => {
            if (message.command === 'highlight') {
                const line = message.line;
                const start = new vscode.Position(line, 0);
                const end = new vscode.Position(line, 200);
                const range = new vscode.Range(start, end);
                editor.selection = new vscode.Selection(start, end);
                editor.revealRange(range);
                editor.setDecorations(decoration, [range]);
            }
        });
        // 🔹 Reverse sync
        const changeSelection = vscode.window.onDidChangeTextEditorSelection(e => {
            if (e.textEditor !== editor || !currentPanel)
                return;
            const line = e.selections[0].start.line;
            currentPanel.webview.postMessage({
                command: 'highlightPreview',
                line
            });
        });
        // 🔥 CLEANUP
        currentPanel.onDidDispose(() => {
            currentPanel = null;
            changeDoc.dispose();
            changeSelection.dispose();
        });
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
// 🔥 FIXED TAG DETECTION (KEY CHANGE)
function processAmp(code) {
    const memory = {};
    const lines = code.split('\n');
    // Extract variables
    lines.forEach(line => {
        const match = line.match(/SET @(.*?) = "(.*?)"/i);
        if (match) {
            memory[match[1].trim()] = match[2];
        }
    });
    return lines.map((line, index) => {
        // Replace AMPscript output
        line = line.replace(/%%=v\(@(.*?)\)=%%/gi, (_, varName) => {
            return memory[varName.trim()] || `[${varName}]`;
        });
        // 🔥 PRIORITY: child tags first
        let tag = '';
        if (/<\s*td/i.test(line))
            tag = 'td';
        else if (/<\s*th/i.test(line))
            tag = 'th';
        else if (/<\s*tr/i.test(line))
            tag = 'tr';
        else if (/<\s*table/i.test(line))
            tag = 'table';
        else if (/<\s*div/i.test(line))
            tag = 'div';
        else if (/<\s*p/i.test(line))
            tag = 'p';
        else if (/<\s*h[1-6]/i.test(line))
            tag = 'heading';
        else if (/<\s*button/i.test(line))
            tag = 'button';
        else if (/<\s*span/i.test(line))
            tag = 'span';
        if (tag) {
            return `<div class="node" data-line="${index}" data-tag="${tag}">${line}</div>`;
        }
        return `<div class="node" data-line="${index}">${line}</div>`;
    }).join('');
}
// 🔥 Update Preview
function updatePreview(panel, code) {
    panel.webview.html = getWebviewContent(code);
}
// 🔥 Webview
function getWebviewContent(code) {
    const processed = processAmp(code);
    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">

    <style>
html, body {
    all: unset;               
    display: block;
    background: #ffffff;
    color: #000000;
}
    body {
        padding: 0;
        margin: 0;
    }

    * {
        opacity: 1 !important;
        filter: none !important;
    }

        .node {
            cursor: pointer;
        }

        .active {
            outline: 2px solid red;
            outline-offset: -1px;
        }
    </style>
  </head>

  <body>

    ${processed}

   <script>
    const vscode = acquireVsCodeApi();

    let activeEl = null;

    document.querySelectorAll('.node').forEach(el => {

        el.addEventListener('click', (e) => {
            e.stopPropagation();

            if (activeEl) activeEl.classList.remove('active');

            el.classList.add('active');
            activeEl = el;

            // 🔥 Always send exact clicked line
            vscode.postMessage({
                command: 'highlight',
                line: parseInt(el.dataset.line)
            });
        });

    });

    // 🔹 Reverse sync
    window.addEventListener('message', event => {
        const { line } = event.data;

        document.querySelectorAll('.node').forEach(el => {
            el.classList.remove('active');

            if (parseInt(el.dataset.line) === line) {
                el.classList.add('active');
                activeEl = el;
            }
        });
    });
</script>

  </body>
  </html>
  `;
}
//# sourceMappingURL=extension.js.map