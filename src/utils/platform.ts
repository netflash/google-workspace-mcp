import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { NodeResolution } from '../registration/types';
import { LAUNCHER_DIR_NAME } from '../constants';
import { atomicWrite } from '../registration/configMerger';
import { getLauncherSource } from '../launcher';

const execFileAsync = promisify(execFile);

export async function commandExists(command: string): Promise<boolean> {
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        await execFileAsync(which, [command]);
        return true;
    } catch {
        return false;
    }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function resolveNodePath(): Promise<NodeResolution> {
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execFileAsync(which, ['node']);
        const nodePath = stdout.trim().split(/\r?\n/)[0];

        if (nodePath) {
            const { stdout: ver } = await execFileAsync(nodePath, ['-v']);
            const major = parseInt(ver.trim().replace('v', '').split('.')[0], 10);
            if (major >= 18) {
                return { command: nodePath };
            }
        }
    } catch {
        // Not found or version check failed
    }

    return {
        command: process.execPath,
        args: [],
        env: { ELECTRON_RUN_AS_NODE: '1' },
    };
}

export function getClineConfigPath(): string {
    const home = os.homedir();
    const platform = process.platform;
    const productName = getVSCodeProductDir();

    const subPath = path.join(productName, 'User', 'globalStorage',
        'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');

    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');

    if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', subPath);
    } else if (platform === 'win32') {
        return path.join(appData, subPath);
    } else {
        return path.join(home, '.config', subPath);
    }
}

function getVSCodeProductDir(): string {
    const appName = vscode.env.appName;
    if (appName.includes('Insiders')) return 'Code - Insiders';
    if (appName.includes('VSCodium')) return 'VSCodium';
    if (appName.includes('Cursor')) return 'Cursor';
    return 'Code';
}

export function normalizeForPlatform(p: string): string {
    const resolved = path.resolve(p);
    if (process.platform !== 'win32') return resolved;
    if (resolved.startsWith('\\\\?\\')) return resolved;
    if (resolved.startsWith('\\\\')) return `\\\\?\\UNC\\${resolved.slice(2)}`;
    return resolved.length >= 240 ? `\\\\?\\${resolved}` : resolved;
}

export function getLauncherDir(): string {
    return path.join(os.homedir(), LAUNCHER_DIR_NAME);
}

export function getLauncherPath(): string {
    return path.join(getLauncherDir(), 'launcher.js');
}

export function getPointerPath(): string {
    return path.join(getLauncherDir(), 'current-path.txt');
}

export async function provisionLauncher(extensionPath: string): Promise<void> {
    const launcherDir = getLauncherDir();
    const launcherPath = getLauncherPath();
    const pointerPath = getPointerPath();

    await fs.mkdir(launcherDir, { recursive: true });

    const launcherSource = getLauncherSource();
    await atomicWrite(launcherPath, launcherSource, process.platform === 'win32' ? undefined : 0o755);

    const pointerContent = [
        extensionPath,
        `# Written by gws-mcp at ${new Date().toISOString()}`,
        '',
    ].join('\n');
    await atomicWrite(pointerPath, pointerContent);
}
