import * as vscode from 'vscode';

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'gwsMcp.showStatus';
        this.item.text = '$(sync~spin) GWS MCP';
        this.item.show();
    }

    setConnected(): void {
        this.item.text = '$(check) GWS MCP';
        this.item.tooltip = 'Google Workspace MCP Server: Ready — click for status';
        this.item.command = 'gwsMcp.showStatus';
        this.item.backgroundColor = undefined;
    }

    setNotConfigured(): void {
        this.item.text = '$(gear) GWS MCP: Setup';
        this.item.tooltip = 'Google Workspace MCP: Not configured — click to setup';
        this.item.command = 'gwsMcp.setupAuth';
        this.item.backgroundColor = undefined;
    }

    setError(message: string): void {
        this.item.text = '$(error) GWS MCP';
        this.item.tooltip = `GWS MCP Error: ${message}`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    setStarting(): void {
        this.item.text = '$(sync~spin) GWS MCP';
        this.item.tooltip = 'Google Workspace MCP: Starting...';
    }

    async showDetailedStatus(): Promise<void> {
        const config = vscode.workspace.getConfiguration('gwsMcp');
        const authMethod = config.get('authMethod', 'oauth');

        const action = await vscode.window.showInformationMessage(
            `GWS MCP | Auth: ${authMethod}`,
            'Setup Auth',
            'Register Agents',
            'Restart Server',
            'View Logs'
        );

        const commands: Record<string, string> = {
            'Setup Auth': 'gwsMcp.setupAuth',
            'Register Agents': 'gwsMcp.registerAgents',
            'Restart Server': 'gwsMcp.restartServer',
            'View Logs': 'gwsMcp.openLogs',
        };

        if (action && commands[action]) {
            vscode.commands.executeCommand(commands[action]);
        }
    }

    dispose(): void {
        this.item.dispose();
    }
}
