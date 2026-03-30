export interface NodeResolution {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface McpServerConfig {
    command: string;
    args: string[];
    env: Record<string, string>;
    serverName: string;
}

export interface RegistrationResult {
    agent: string;
    success: boolean;
    configPath?: string;
    error?: string;
    skipped?: boolean;
}

export interface AgentRegistrar {
    readonly agentName: string;
    isInstalled(): Promise<boolean>;
    register(config: McpServerConfig): Promise<RegistrationResult>;
    deregister(context: import('vscode').ExtensionContext): Promise<RegistrationResult>;
    isRegistered(): Promise<boolean>;
}
