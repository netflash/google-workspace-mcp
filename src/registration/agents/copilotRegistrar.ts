import * as vscode from 'vscode';
import { AgentRegistrar, McpServerConfig, RegistrationResult } from '../types';
import { MCP_PROVIDER_ID } from '../../constants';

export class CopilotRegistrar implements AgentRegistrar {
    readonly agentName = 'VS Code Copilot';
    private disposable?: vscode.Disposable;

    constructor(private context: vscode.ExtensionContext) {}

    async isInstalled(): Promise<boolean> {
        return true;
    }

    async register(config: McpServerConfig): Promise<RegistrationResult> {
        const emitter = new vscode.EventEmitter<void>();

        this.disposable = vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
            onDidChangeMcpServerDefinitions: emitter.event,
            provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
                return [
                    new vscode.McpStdioServerDefinition(
                        'Google Workspace',
                        config.command,
                        config.args,
                        config.env,
                    ),
                ];
            },
        });

        this.context.subscriptions.push(this.disposable);
        return { agent: this.agentName, success: true };
    }

    async deregister(): Promise<RegistrationResult> {
        this.disposable?.dispose();
        this.disposable = undefined;
        return { agent: this.agentName, success: true };
    }

    async isRegistered(): Promise<boolean> {
        return this.disposable !== undefined;
    }
}
