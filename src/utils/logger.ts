import * as vscode from 'vscode';
import { RegistrationResult } from '../registration/types';

export class Logger {
    private readonly channel: vscode.OutputChannel;

    constructor() {
        this.channel = vscode.window.createOutputChannel('Google Workspace MCP');
    }

    info(message: string): void {
        this.channel.appendLine(`[INFO] ${new Date().toISOString()} ${message}`);
    }

    warn(message: string): void {
        this.channel.appendLine(`[WARN] ${new Date().toISOString()} ${message}`);
    }

    error(message: string): void {
        this.channel.appendLine(`[ERROR] ${new Date().toISOString()} ${message}`);
    }

    show(): void {
        this.channel.show();
    }

    logRegistrationResults(results: RegistrationResult[]): void {
        this.info('=== Registration Results ===');
        for (const r of results) {
            if (r.skipped) {
                this.info(`  ${r.agent}: SKIPPED (not installed or disabled)`);
            } else if (r.success) {
                this.info(`  ${r.agent}: OK → ${r.configPath ?? 'API'}`);
            } else {
                this.error(`  ${r.agent}: FAILED — ${r.error}`);
            }
        }
        this.info('============================');
    }
}
