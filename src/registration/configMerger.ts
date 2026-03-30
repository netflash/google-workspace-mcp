import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse as parseJsonc, modify, applyEdits, ParseError } from 'jsonc-parser';

const fileLocks = new Map<string, Promise<void>>();

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const prev = fileLocks.get(filePath) ?? Promise.resolve();
    let release: () => void;
    const current = new Promise<void>(r => (release = r));
    fileLocks.set(filePath, prev.then(() => current));
    await prev;
    try {
        return await fn();
    } finally {
        release!();
        if (fileLocks.get(filePath) === current) fileLocks.delete(filePath);
    }
}

async function withInterprocessLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const lockPath = `${filePath}.gwsmcp.lock`;
    const start = Date.now();
    let fh: fs.FileHandle | undefined;

    while (true) {
        try {
            fh = await fs.open(lockPath, 'wx');
            break;
        } catch (err: any) {
            if (err.code !== 'EEXIST') throw err;
            try {
                const stat = await fs.stat(lockPath);
                if (Date.now() - stat.mtimeMs > 30_000) {
                    await fs.unlink(lockPath).catch(() => {});
                    continue;
                }
            } catch { continue; }
            if (Date.now() - start > 10_000) {
                throw new Error(`Lock timeout on ${filePath}`);
            }
            await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        }
    }

    try {
        return await fn();
    } finally {
        await fh?.close();
        await fs.unlink(lockPath).catch(() => {});
    }
}

async function withFullLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    return withFileLock(filePath, () => withInterprocessLock(filePath, fn));
}

export async function atomicWrite(filePath: string, content: string, mode?: number): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp.${process.pid}`;
    try {
        const writeOpts: { mode?: number } = mode ? { mode } : {};
        await fs.writeFile(tmpPath, content, writeOpts);
        try {
            await fs.rename(tmpPath, filePath);
        } catch (err: any) {
            if (err.code === 'EXDEV') {
                await fs.copyFile(tmpPath, filePath);
                await fs.unlink(tmpPath);
            } else {
                throw err;
            }
        }
    } catch (err) {
        await fs.unlink(tmpPath).catch(() => {});
        throw err;
    }
}

async function backupIfExists(filePath: string): Promise<void> {
    try {
        await fs.access(filePath);
        const backupPath = `${filePath}.gwsmcp.bak`;
        try {
            await fs.access(backupPath);
        } catch {
            await fs.copyFile(filePath, backupPath);
        }
    } catch {
        // File doesn't exist
    }
}

async function cleanupBackup(filePath: string): Promise<void> {
    try {
        await fs.unlink(`${filePath}.gwsmcp.bak`);
    } catch {
        // Backup may not exist
    }
}

export { cleanupBackup };

export async function mergeJsonMcpConfig(
    filePath: string,
    serverName: string,
    serverConfig: { command: string; args: string[]; env?: Record<string, string> }
): Promise<void> {
    return withFullLock(filePath, async () => {
        await backupIfExists(filePath);

        let raw = '';
        try {
            raw = await fs.readFile(filePath, 'utf-8');
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        if (raw) {
            const errors: ParseError[] = [];
            parseJsonc(raw, errors, { allowTrailingComma: true });
            if (errors.length > 0) {
                throw new Error(
                    `Config file ${filePath} contains invalid JSON. ` +
                    `Fix the syntax error before Google Workspace MCP can register. ` +
                    `File left untouched.`
                );
            }
        }

        const source = raw || '{}';
        const edits = modify(source, ['mcpServers', serverName], serverConfig, {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
        });
        const updated = applyEdits(source, edits);

        await atomicWrite(filePath, updated);
    });
}

export async function removeJsonMcpEntry(
    filePath: string,
    serverName: string
): Promise<void> {
    return withFullLock(filePath, async () => {
        let raw: string;
        try {
            raw = await fs.readFile(filePath, 'utf-8');
        } catch {
            return;
        }

        const errors: ParseError[] = [];
        const config = parseJsonc(raw, errors, { allowTrailingComma: true });
        if (errors.length > 0 || !config?.mcpServers?.[serverName]) return;

        const edits = modify(raw, ['mcpServers', serverName], undefined, {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
        });
        const updated = applyEdits(raw, edits);

        const parsed = parseJsonc(updated, []);
        if (parsed && typeof parsed === 'object' &&
            parsed.mcpServers && typeof parsed.mcpServers === 'object' &&
            Object.keys(parsed.mcpServers).length === 0 &&
            Object.keys(parsed).length === 1) {
            await fs.unlink(filePath);
        } else {
            await atomicWrite(filePath, updated);
        }
    });
}

export async function mergeTomlMcpConfig(
    filePath: string,
    serverName: string,
    serverConfig: { command: string; args: string[]; env?: Record<string, string> }
): Promise<void> {
    return withFullLock(filePath, async () => {
        await backupIfExists(filePath);
        const TOML = await import('@iarna/toml');

        let existing: Record<string, unknown> = {};
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            try {
                existing = TOML.parse(content) as Record<string, unknown>;
            } catch (parseErr) {
                throw new Error(
                    `Config file ${filePath} contains invalid TOML. ` +
                    `Parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}`
                );
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        if (!existing.mcp_servers || typeof existing.mcp_servers !== 'object') {
            existing.mcp_servers = {};
        }

        const tomlServerName = serverName.replace(/-/g, '_');
        (existing.mcp_servers as Record<string, unknown>)[tomlServerName] = {
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env ?? {},
        };

        await atomicWrite(filePath, TOML.stringify(existing as any));
    });
}

export async function mergeYamlMcpConfig(
    filePath: string,
    serverName: string,
    serverConfig: { command: string; args: string[]; env?: Record<string, string> }
): Promise<void> {
    return withFullLock(filePath, async () => {
        await backupIfExists(filePath);
        const YAML = await import('yaml');

        let existing: Record<string, unknown> = {};
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            try {
                existing = YAML.parse(content) ?? {};
            } catch (parseErr) {
                throw new Error(
                    `Config file ${filePath} contains invalid YAML. ` +
                    `Parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}`
                );
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        if (!Array.isArray(existing.mcpServers)) {
            existing.mcpServers = [];
        }

        const servers = existing.mcpServers as Array<Record<string, unknown>>;
        const entry = {
            name: serverName,
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env ?? {},
        };

        const idx = servers.findIndex((s) => s.name === serverName);
        if (idx >= 0) {
            servers[idx] = entry;
        } else {
            servers.push(entry);
        }

        await atomicWrite(filePath, YAML.stringify(existing));
    });
}
