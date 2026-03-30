import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeJsonMcpConfig, removeJsonMcpEntry } from '../configMerger';
import { commandExists } from '../../utils/platform';
import { SERVER_NAME } from '../../constants';

export class ClaudeCodeRegistrar implements AgentRegistrar {
    readonly agentName = 'Claude Code';

    private get claudeDesktopPath(): string {
        return path.join(os.homedir(), '.claude.json');
    }

    private get claudeCodeSettingsPath(): string {
        return path.join(os.homedir(), '.claude', 'settings.json');
    }

    async isInstalled(): Promise<boolean> {
        return commandExists('claude');
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const scope = vscode.workspace.getConfiguration('gwsMcp').get('registrationScope');
        const serverEntry = {
            command: config.command,
            args: config.args,
            env: config.env,
        };

        const paths: string[] = [];

        if (scope === 'workspace') {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                const workspacePath = path.join(folders[0].uri.fsPath, '.mcp.json');
                await mergeJsonMcpConfig(workspacePath, config.serverName, serverEntry);
                paths.push(workspacePath);
            }
        }

        await mergeJsonMcpConfig(this.claudeDesktopPath, config.serverName, serverEntry);
        paths.push(this.claudeDesktopPath);

        await mergeJsonMcpConfig(this.claudeCodeSettingsPath, config.serverName, serverEntry);
        paths.push(this.claudeCodeSettingsPath);

        return { agent: this.agentName, success: true, configPath: paths.join(', ') };
    }

    async deregister(): Promise<RegistrationResult> {
        await removeJsonMcpEntry(this.claudeDesktopPath, SERVER_NAME);
        await removeJsonMcpEntry(this.claudeCodeSettingsPath, SERVER_NAME);

        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            const localPath = path.join(folders[0].uri.fsPath, '.mcp.json');
            await removeJsonMcpEntry(localPath, SERVER_NAME);
        }

        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const fs = await import('fs/promises');
        for (const configPath of [this.claudeCodeSettingsPath, this.claudeDesktopPath]) {
            try {
                const content = await fs.readFile(configPath, 'utf-8');
                const config = JSON.parse(content);
                if (config?.mcpServers?.[SERVER_NAME]) {
                    return true;
                }
            } catch {
                continue;
            }
        }
        return false;
    }
}
