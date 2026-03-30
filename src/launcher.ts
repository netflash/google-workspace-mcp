export function getLauncherSource(): string {
    return `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const launcherDir = path.dirname(path.resolve(process.argv[1]));
const pointerFile = path.join(launcherDir, 'current-path.txt');

let extensionPath;
try {
    extensionPath = fs.readFileSync(pointerFile, 'utf-8').split('\\n')[0].trim();
} catch (err) {
    process.stderr.write('[gws-mcp] ERROR: Cannot read ' + pointerFile + ': ' + err.message + '\\n');
    process.stderr.write('[gws-mcp] Restart VS Code to regenerate the pointer file.\\n');
    process.exit(1);
}

if (!extensionPath) {
    process.stderr.write('[gws-mcp] ERROR: Pointer file is empty: ' + pointerFile + '\\n');
    process.exit(1);
}

const serverScript = path.join(extensionPath, 'dist', 'mcp', 'server.js');

if (!fs.existsSync(serverScript)) {
    process.stderr.write('[gws-mcp] ERROR: Server not found at ' + serverScript + '\\n');
    process.stderr.write('[gws-mcp] The extension may have been updated. Restart VS Code to fix.\\n');
    process.exit(1);
}

require(serverScript);
`;
}
