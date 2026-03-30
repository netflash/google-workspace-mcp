import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { McpServerConfig } from '../registration/types';
import { Logger } from '../utils/logger';

export class ServerLifecycle {
    private process: ChildProcess | null = null;
    private currentConfig: McpServerConfig | null = null;
    private crashCount = 0;
    private lastCrashTime = 0;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private context: vscode.ExtensionContext, private logger: Logger) {}

    async start(config: McpServerConfig): Promise<void> {
        if (this.process) return;
        this.currentConfig = config;

        this.process = spawn(config.command, config.args, {
            env: { ...process.env, ...config.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.stderr?.on('data', (data) => {
            this.logger.info(`[server] ${data.toString().trim()}`);
        });

        this.process.on('exit', (code) => {
            this.process = null;
            if (code !== 0 && code !== null) this.handleCrash(code);
        });

        this.process.on('error', (err) => {
            this.logger.error(`Server process error: ${err.message}`);
            this.process = null;
        });
    }

    stop(): void {
        if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
        if (this.process) {
            this.process.kill('SIGTERM');
            const proc = this.process;
            setTimeout(() => { if (proc && !proc.killed) proc.kill('SIGKILL'); }, 2000);
            this.process = null;
        }
    }

    async restart(): Promise<void> {
        if (!this.currentConfig) {
            vscode.window.showWarningMessage('Google Workspace MCP: No server config available for restart.');
            return;
        }
        this.stop();
        await new Promise(resolve => setTimeout(resolve, 500));
        this.crashCount = 0;
        await this.start(this.currentConfig);
        vscode.window.showInformationMessage('Google Workspace MCP: Server restarted.');
    }

    private handleCrash(code: number): void {
        const now = Date.now();
        if (now - this.lastCrashTime > 5 * 60 * 1000) this.crashCount = 0;
        this.crashCount++;
        this.lastCrashTime = now;

        if (this.crashCount <= 3 && this.currentConfig) {
            const delay = Math.pow(2, this.crashCount - 1) * 1000;
            this.logger.warn(`Server crashed (code ${code}). Restarting in ${delay}ms...`);
            this.restartTimer = setTimeout(() => {
                this.restartTimer = null;
                if (this.currentConfig) this.start(this.currentConfig);
            }, delay);
        } else {
            this.logger.error(`Server crashed ${this.crashCount} times. Stopping auto-restart.`);
            vscode.window.showErrorMessage(
                'Google Workspace MCP server has crashed repeatedly.',
                'View Logs', 'Restart Server'
            ).then(action => {
                if (action === 'View Logs') this.logger.show();
                if (action === 'Restart Server') {
                    this.crashCount = 0;
                    if (this.currentConfig) this.start(this.currentConfig);
                }
            });
        }
    }
}
