import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeJsonMcpConfig, removeJsonMcpEntry } from '../configMerger';
import { getClineConfigPath, fileExists } from '../../utils/platform';
import { SERVER_NAME } from '../../constants';

export class ClineRegistrar implements AgentRegistrar {
    readonly agentName = 'Cline';

    async isInstalled(): Promise<boolean> {
        return fileExists(getClineConfigPath());
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const configPath = getClineConfigPath();
        await mergeJsonMcpConfig(configPath, config.serverName, {
            command: config.command, args: config.args, env: config.env,
        });
        return { agent: this.agentName, success: true, configPath };
    }

    async deregister(): Promise<RegistrationResult> {
        await removeJsonMcpEntry(getClineConfigPath(), SERVER_NAME);
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const fs = await import('fs/promises');
        try {
            const content = await fs.readFile(getClineConfigPath(), 'utf-8');
            return !!JSON.parse(content)?.mcpServers?.[SERVER_NAME];
        } catch { return false; }
    }
}
