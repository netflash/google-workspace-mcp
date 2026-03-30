import * as vscode from 'vscode';
import { AuthManager } from './auth/authManager';
import { RegistrationEngine } from './registration/registrationEngine';
import { ServerLifecycle } from './mcp/serverLifecycle';
import { StatusBar } from './ui/statusBar';
import { Logger } from './utils/logger';

let statusBar: StatusBar;
let serverLifecycle: ServerLifecycle;
let registrationEngine: RegistrationEngine;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const logger = new Logger();
    const authManager = new AuthManager(context, logger);
    statusBar = new StatusBar();
    serverLifecycle = new ServerLifecycle(context, logger);
    registrationEngine = new RegistrationEngine(context, logger);
    authManager.setRegistrationEngine(registrationEngine);

    context.subscriptions.push(
        vscode.commands.registerCommand('gwsMcp.setupAuth', () => authManager.runSetupWizard()),
        vscode.commands.registerCommand('gwsMcp.registerAgents', () => registerWithAgents(context, authManager, logger)),
        vscode.commands.registerCommand('gwsMcp.showStatus', () => statusBar.showDetailedStatus()),
        vscode.commands.registerCommand('gwsMcp.restartServer', () => serverLifecycle.restart()),
        vscode.commands.registerCommand('gwsMcp.deregisterAll', () => deregisterAll(context)),
        vscode.commands.registerCommand('gwsMcp.checkAuth', () => authManager.checkAndReport()),
        vscode.commands.registerCommand('gwsMcp.openLogs', () => logger.show()),
        statusBar
    );

    if (vscode.env.remoteName) {
        logger.warn(`Running in remote context: ${vscode.env.remoteName}`);
        vscode.window.showWarningMessage(
            `Google Workspace MCP: Running in a remote environment (${vscode.env.remoteName}). ` +
            'Authentication must be configured on the remote machine.',
            'Setup Auth'
        ).then(action => {
            if (action === 'Setup Auth') authManager.runSetupWizard();
        });
    }

    const hasAuth = await authManager.checkAuth();
    if (hasAuth) {
        statusBar.setStarting();

        const serverConfig = await buildServerConfig(context, authManager);

        if (context.globalState.get('gwsMcp.lastExtensionPath')) {
            await context.globalState.update('gwsMcp.lastExtensionPath', undefined);
        }

        const results = await registrationEngine.registerAll(serverConfig);
        logger.logRegistrationResults(results);

        await serverLifecycle.start(serverConfig);
        statusBar.setConnected();
    } else {
        statusBar.setNotConfigured();
        const action = await vscode.window.showInformationMessage(
            'Google Workspace MCP: Connect your Google account to start using Gmail, Calendar, Drive, Docs & Sheets tools with AI agents.',
            'Setup Now',
            'Later'
        );
        if (action === 'Setup Now') {
            await authManager.runSetupWizard();
        }
    }
}

export function deactivate(): void {
    serverLifecycle?.stop();
    statusBar?.dispose();
}

async function buildServerConfig(
    context: vscode.ExtensionContext,
    authManager: AuthManager
): Promise<import('./registration/types').McpServerConfig> {
    const path = await import('node:path');
    const { resolveNodePath, normalizeForPlatform, provisionLauncher, getLauncherPath } = await import('./utils/platform.js');

    const nodeResolution = await resolveNodePath();

    await provisionLauncher(context.extensionPath);
    const launcherScript = normalizeForPlatform(getLauncherPath());

    return {
        command: nodeResolution.command,
        args: [
            ...(nodeResolution.args ?? []),
            launcherScript,
        ],
        env: {
            ...(nodeResolution.env ?? {}),
            ...(await authManager.getAuthEnv()),
        },
        serverName: 'google-workspace',
    };
}

async function registerWithAgents(
    context: vscode.ExtensionContext,
    authManager: AuthManager,
    logger: Logger
): Promise<void> {
    const serverConfig = await buildServerConfig(context, authManager);
    const results = await registrationEngine.registerAll(serverConfig);

    const registered = results.filter(r => r.success && !r.skipped);
    const failed = results.filter(r => !r.success);

    let message = `Google Workspace MCP: Registered with ${registered.length} agents.`;
    if (failed.length > 0) message += ` ${failed.length} failed.`;

    const action = await vscode.window.showInformationMessage(
        message,
        ...(failed.length > 0 ? ['Show Errors'] : [])
    );

    if (action === 'Show Errors') logger.show();
}

async function deregisterAll(context: vscode.ExtensionContext): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'Remove Google Workspace MCP from all AI agents?',
        'Yes, Remove All',
        'Cancel'
    );
    if (confirm === 'Yes, Remove All') {
        await registrationEngine.deregisterAll(context);
        vscode.window.showInformationMessage('Google Workspace MCP: Removed from all agents.');
    }
}
