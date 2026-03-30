import * as vscode from 'vscode';

const REGISTRY_KEY = 'gwsMcp.registry';

interface RegistryEntry {
    configPath?: string;
    timestamp: number;
}

export async function recordRegistration(
    context: vscode.ExtensionContext,
    agentId: string,
    serverName: string,
    configPath?: string
): Promise<void> {
    const reg = context.globalState.get<Record<string, RegistryEntry>>(REGISTRY_KEY, {});
    reg[`${agentId}:${serverName}`] = { configPath, timestamp: Date.now() };
    await context.globalState.update(REGISTRY_KEY, reg);
}

export async function wasRegisteredByUs(
    context: vscode.ExtensionContext,
    agentId: string,
    serverName: string
): Promise<boolean> {
    const reg = context.globalState.get<Record<string, RegistryEntry>>(REGISTRY_KEY, {});
    return Boolean(reg[`${agentId}:${serverName}`]);
}

export async function clearRegistration(
    context: vscode.ExtensionContext,
    agentId: string,
    serverName: string
): Promise<void> {
    const reg = context.globalState.get<Record<string, RegistryEntry>>(REGISTRY_KEY, {});
    delete reg[`${agentId}:${serverName}`];
    await context.globalState.update(REGISTRY_KEY, reg);
}
