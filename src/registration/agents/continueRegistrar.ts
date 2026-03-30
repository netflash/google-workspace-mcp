import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeYamlMcpConfig, atomicWrite } from '../configMerger';
import { SERVER_NAME } from '../../constants';

export class ContinueRegistrar implements AgentRegistrar {
    readonly agentName = 'Continue.dev';

    async isInstalled(): Promise<boolean> {
        try { await fs.access(path.join(os.homedir(), '.continue')); return true; }
        catch { return false; }
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const configPath = path.join(os.homedir(), '.continue', 'config.yaml');
        await mergeYamlMcpConfig(configPath, config.serverName, {
            command: config.command, args: config.args, env: config.env,
        });
        return { agent: this.agentName, success: true, configPath };
    }

    async deregister(): Promise<RegistrationResult> {
        const YAML = await import('yaml');
        const configPath = path.join(os.homedir(), '.continue', 'config.yaml');
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const config = YAML.parse(content) ?? {};
            if (Array.isArray(config.mcpServers)) {
                config.mcpServers = config.mcpServers.filter(
                    (s: { name: string }) => s.name !== SERVER_NAME
                );
                await atomicWrite(configPath, YAML.stringify(config));
            }
        } catch { /* File doesn't exist */ }
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const YAML = await import('yaml');
        try {
            const content = await fs.readFile(path.join(os.homedir(), '.continue', 'config.yaml'), 'utf-8');
            const config = YAML.parse(content) ?? {};
            return Array.isArray(config.mcpServers) &&
                config.mcpServers.some((s: { name: string }) => s.name === SERVER_NAME);
        } catch { return false; }
    }
}
