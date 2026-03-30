import * as os from 'os';
import * as path from 'path';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { mergeJsonMcpConfig, removeJsonMcpEntry } from '../configMerger';
import { commandExists } from '../../utils/platform';
import { SERVER_NAME } from '../../constants';

export class GeminiRegistrar implements AgentRegistrar {
    readonly agentName = 'Gemini CLI';

    async isInstalled(): Promise<boolean> { return commandExists('gemini'); }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const configPath = path.join(os.homedir(), '.gemini', 'settings.json');
        await mergeJsonMcpConfig(configPath, config.serverName, {
            command: config.command, args: config.args, env: config.env,
        });
        return { agent: this.agentName, success: true, configPath };
    }

    async deregister(): Promise<RegistrationResult> {
        await removeJsonMcpEntry(path.join(os.homedir(), '.gemini', 'settings.json'), SERVER_NAME);
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        const fs = await import('fs/promises');
        try {
            const content = await fs.readFile(path.join(os.homedir(), '.gemini', 'settings.json'), 'utf-8');
            return !!JSON.parse(content)?.mcpServers?.[SERVER_NAME];
        } catch { return false; }
    }
}
