import * as vscode from 'vscode';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from './types';
import { CopilotRegistrar } from './agents/copilotRegistrar';
import { ClaudeCodeRegistrar } from './agents/claudeCodeRegistrar';
import { CursorRegistrar } from './agents/cursorRegistrar';
import { CodexRegistrar } from './agents/codexRegistrar';
import { GeminiRegistrar } from './agents/geminiRegistrar';
import { WindsurfRegistrar } from './agents/windsurfRegistrar';
import { ContinueRegistrar } from './agents/continueRegistrar';
import { ClineRegistrar } from './agents/clineRegistrar';
import { recordRegistration, wasRegisteredByUs, clearRegistration } from './registryStore';
import { Logger } from '../utils/logger';
import { SERVER_NAME } from '../constants';

export class RegistrationEngine {
    private registrars: AgentRegistrar[];

    constructor(private context: vscode.ExtensionContext, private logger: Logger) {
        this.registrars = [
            new CopilotRegistrar(context),
            new ClaudeCodeRegistrar(),
            new CursorRegistrar(),
            new CodexRegistrar(),
            new GeminiRegistrar(),
            new WindsurfRegistrar(),
            new ContinueRegistrar(),
            new ClineRegistrar(),
        ];
    }

    getRegistrars(): readonly AgentRegistrar[] {
        return this.registrars;
    }

    async registerAll(config: McpServerConfig): Promise<RegistrationResult[]> {
        const settings = vscode.workspace.getConfiguration('gwsMcp');

        const detectionResults = await Promise.all(
            this.registrars.map(async (r) => ({
                registrar: r,
                installed: await r.isInstalled().catch(() => false),
            }))
        );

        const results: RegistrationResult[] = [];

        for (const { registrar, installed } of detectionResults) {
            const settingKey = this.getSettingKey(registrar.agentName);
            if (settingKey && !settings.get<boolean>(settingKey, true)) {
                results.push({ agent: registrar.agentName, success: true, skipped: true });
                continue;
            }

            if (!installed) {
                results.push({ agent: registrar.agentName, success: true, skipped: true });
                continue;
            }

            try {
                const result = await registrar.register(config);
                results.push(result);
                await recordRegistration(
                    this.context, registrar.agentName, config.serverName, result.configPath
                );
                this.logger.info(`Registered with ${registrar.agentName}: ${result.configPath ?? 'API'}`);
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                results.push({ agent: registrar.agentName, success: false, error });
                this.logger.error(`Failed to register with ${registrar.agentName}: ${error}`);
            }
        }

        return results;
    }

    async deregisterAll(context: vscode.ExtensionContext): Promise<RegistrationResult[]> {
        const results: RegistrationResult[] = [];

        for (const registrar of this.registrars) {
            const ours = await wasRegisteredByUs(context, registrar.agentName, SERVER_NAME);
            if (!ours) {
                results.push({ agent: registrar.agentName, success: true, skipped: true });
                continue;
            }

            try {
                const result = await registrar.deregister(context);
                await clearRegistration(context, registrar.agentName, SERVER_NAME);
                results.push(result);
            } catch (err) {
                results.push({
                    agent: registrar.agentName,
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return results;
    }

    private getSettingKey(agentName: string): string | undefined {
        const map: Record<string, string> = {
            'VS Code Copilot': 'agents.copilot',
            'Claude Code': 'agents.claudeCode',
            'Cursor': 'agents.cursor',
            'Codex CLI': 'agents.codex',
            'Gemini CLI': 'agents.gemini',
            'Windsurf': 'agents.windsurf',
            'Continue.dev': 'agents.continue',
            'Cline': 'agents.cline',
        };
        return map[agentName];
    }
}
