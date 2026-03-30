import * as os from 'os';
import * as path from 'path';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeJsonMcpConfig, removeJsonMcpEntry } from '../configMerger';
import { directoryExists } from '../../utils/platform';
import { SERVER_NAME } from '../../constants';

export class WindsurfRegistrar implements AgentRegistrar {
    readonly agentName = 'Windsurf';

    async isInstalled(): Promise<boolean> {
        return directoryExists(path.join(os.homedir(), '.codeium', 'windsurf'));
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const configPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
        await mergeJsonMcpConfig(configPath, config.serverName, {
            command: config.command, args: config.args, env: config.env,
        });
        return { agent: this.agentName, success: true, configPath };
    }

    async deregister(): Promise<RegistrationResult> {
        await removeJsonMcpEntry(path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'), SERVER_NAME);
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const fs = await import('fs/promises');
        try {
            const content = await fs.readFile(path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'), 'utf-8');
            return !!JSON.parse(content)?.mcpServers?.[SERVER_NAME];
        } catch { return false; }
    }
}
