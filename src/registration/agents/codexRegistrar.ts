import * as os from 'os';
import * as path from 'path';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeTomlMcpConfig, atomicWrite } from '../configMerger';
import { commandExists } from '../../utils/platform';
import { SERVER_NAME } from '../../constants';

export class CodexRegistrar implements AgentRegistrar {
    readonly agentName = 'Codex CLI';

    async isInstalled(): Promise<boolean> {
        return commandExists('codex');
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const configPath = path.join(os.homedir(), '.codex', 'config.toml');
        await mergeTomlMcpConfig(configPath, config.serverName, {
            command: config.command, args: config.args, env: config.env,
        });
        return { agent: this.agentName, success: true, configPath };
    }

    async deregister(): Promise<RegistrationResult> {
        const TOML = await import('@iarna/toml');
        const fs = await import('fs/promises');
        const configPath = path.join(os.homedir(), '.codex', 'config.toml');
        const tomlName = SERVER_NAME.replace(/-/g, '_');
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const config = TOML.parse(content) as Record<string, unknown>;
            if (config.mcp_servers && typeof config.mcp_servers === 'object') {
                delete (config.mcp_servers as Record<string, unknown>)[tomlName];
                await atomicWrite(configPath, TOML.stringify(config as any));
            }
        } catch { /* File doesn't exist */ }
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const TOML = await import('@iarna/toml');
        const fs = await import('fs/promises');
        const tomlName = SERVER_NAME.replace(/-/g, '_');
        try {
            const content = await fs.readFile(path.join(os.homedir(), '.codex', 'config.toml'), 'utf-8');
            const config = TOML.parse(content) as Record<string, unknown>;
            return !!(config.mcp_servers as Record<string, unknown> | undefined)?.[tomlName];
        } catch { return false; }
    }
}
