import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';
import { AuthWizard } from './authWizard';
import type { RegistrationEngine } from '../registration/registrationEngine';

type AuthMethod = 'adc' | 'serviceAccount' | 'oauth';

export class AuthManager {
    private readonly secretKey = 'gwsMcp.credentials';
    private _registrationEngine?: RegistrationEngine;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly logger: Logger
    ) {}

    setRegistrationEngine(engine: RegistrationEngine): void {
        this._registrationEngine = engine;
    }

    async checkAuth(): Promise<boolean> {
        const method = this.getAuthMethod();
        switch (method) {
            case 'adc': return this.checkAdc();
            case 'serviceAccount': return this.checkServiceAccount();
            case 'oauth': return this.checkOAuth();
            default: return this.checkAdc();
        }
    }

    async getAuthEnv(): Promise<Record<string, string>> {
        const method = this.getAuthMethod();
        const env: Record<string, string> = {};

        switch (method) {
            case 'adc':
                break;

            case 'serviceAccount': {
                const keyPath = await this.getServiceAccountPath();
                if (keyPath) {
                    try {
                        await fs.access(keyPath);
                        env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
                    } catch {
                        this.logger.warn(`Service account key file not found: ${keyPath}`);
                    }
                }
                break;
            }

            case 'oauth': {
                const credPath = await this.writeOAuthAsAdc();
                if (credPath) {
                    env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
                }
                break;
            }
        }

        return env;
    }

    async runSetupWizard(): Promise<void> {
        const wizard = new AuthWizard(this.context, this, this._registrationEngine!, this.logger);
        await wizard.run();
    }

    async checkAndReport(): Promise<void> {
        const valid = await this.checkAuth();
        const method = this.getAuthMethod();
        if (valid) {
            vscode.window.showInformationMessage(`Google Workspace MCP: Authentication OK (method: ${method})`);
        } else {
            const action = await vscode.window.showWarningMessage(
                `Google Workspace MCP: Authentication not configured (method: ${method}).`,
                'Setup Now'
            );
            if (action === 'Setup Now') this.runSetupWizard();
        }
    }

    async storeCredentials(credentials: string): Promise<void> {
        await this.context.secrets.store(this.secretKey, credentials);
    }

    private getAuthMethod(): AuthMethod {
        return vscode.workspace.getConfiguration('gwsMcp').get<AuthMethod>('authMethod', 'oauth');
    }

    private async checkAdc(): Promise<boolean> {
        const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
        const adcPath = process.platform === 'win32'
            ? path.join(appData, 'gcloud', 'application_default_credentials.json')
            : path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

        try {
            await fs.access(adcPath);
            return true;
        } catch {
            const envCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (envCreds) {
                try { await fs.access(envCreds); return true; }
                catch { /* */ }
            }
            return false;
        }
    }

    private async checkServiceAccount(): Promise<boolean> {
        const keyPath = await this.getServiceAccountPath();
        if (!keyPath) return false;
        try { await fs.access(keyPath); return true; }
        catch { return false; }
    }

    private async checkOAuth(): Promise<boolean> {
        const stored = await this.context.secrets.get(this.secretKey);
        if (!stored) return false;
        try {
            const tokens = JSON.parse(stored);
            if (!tokens.refresh_token) return false;
            const { OAuth2Client } = await import('google-auth-library');
            const oauth2 = new OAuth2Client(tokens.client_id, tokens.client_secret);
            oauth2.setCredentials({ refresh_token: tokens.refresh_token });
            await oauth2.getAccessToken();
            return true;
        } catch (err) {
            this.logger.warn('OAuth refresh token validation failed, clearing stale credentials');
            await this.context.secrets.delete(this.secretKey);
            return false;
        }
    }

    private async getServiceAccountPath(): Promise<string | undefined> {
        return this.context.secrets.get('gwsMcp.serviceAccountPath');
    }

    private async writeOAuthAsAdc(): Promise<string | undefined> {
        const stored = await this.context.secrets.get(this.secretKey);
        if (!stored) return undefined;

        let tokens: { client_id: string; client_secret: string; refresh_token: string };
        try { tokens = JSON.parse(stored); }
        catch { return undefined; }

        const adcContent = {
            type: 'authorized_user',
            client_id: tokens.client_id,
            client_secret: tokens.client_secret,
            refresh_token: tokens.refresh_token,
        };

        const credDir = path.join(this.context.globalStorageUri.fsPath, 'credentials');
        await fs.mkdir(credDir, { recursive: true, mode: 0o700 });
        const credPath = path.join(credDir, 'adc.json');
        await fs.writeFile(credPath, JSON.stringify(adcContent, null, 2), { mode: 0o600 });
        return credPath;
    }
}
