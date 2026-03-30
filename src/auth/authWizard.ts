import * as vscode from 'vscode';
import * as http from 'http';
import { AuthManager } from './authManager';
import { RegistrationEngine } from '../registration/registrationEngine';
import { Logger } from '../utils/logger';

const WORKSPACE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
];

export class AuthWizard {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly authManager: AuthManager,
        private readonly registrationEngine: RegistrationEngine,
        private readonly logger: Logger
    ) {}

    async run(): Promise<void> {
        const method = await this.step1ChooseMethod();
        if (!method) return;

        const authConfigured = await this.step2ConfigureAuth(method);
        if (!authConfigured) return;

        await this.step3SelectAgents();
        await this.step4Finalize();
    }

    private async step1ChooseMethod(): Promise<string | undefined> {
        const method = await vscode.window.showQuickPick([
            {
                label: '$(globe) OAuth 2.0 (Browser Login) — Recommended',
                description: 'For personal Gmail, Calendar, Drive access',
                detail: 'Signs in via your browser. Required for personal Google accounts.',
                method: 'oauth',
            },
            {
                label: '$(key) Application Default Credentials',
                description: 'Fastest setup — requires gcloud CLI',
                detail: 'Best if you already have gcloud installed with the right scopes.',
                method: 'adc',
            },
            {
                label: '$(file) Service Account Key File',
                description: 'For Workspace admin / domain-wide delegation',
                detail: 'Download a JSON key file from Google Cloud Console. Requires domain admin setup.',
                method: 'serviceAccount',
            },
        ], {
            placeHolder: 'How do you want to authenticate with Google Workspace?',
            title: 'Google Workspace MCP Setup (Step 1/4): Authentication Method',
        });

        if (method) {
            await vscode.workspace.getConfiguration('gwsMcp')
                .update('authMethod', method.method, vscode.ConfigurationTarget.Global);
        }

        return method?.method;
    }

    private async step2ConfigureAuth(method: string): Promise<boolean> {
        switch (method) {
            case 'adc': return this.setupAdc();
            case 'serviceAccount': return this.setupServiceAccount();
            case 'oauth': return this.setupOAuth();
            default: return false;
        }
    }

    private async step3SelectAgents(): Promise<void> {
        const registrars = this.registrationEngine.getRegistrars();
        const agents = [
            { label: 'VS Code Copilot', setting: 'agents.copilot', alwaysAvailable: true, registrarName: 'VS Code Copilot' },
            { label: 'Claude Code CLI', setting: 'agents.claudeCode', registrarName: 'Claude Code' },
            { label: 'Cursor', setting: 'agents.cursor', registrarName: 'Cursor' },
            { label: 'Codex CLI', setting: 'agents.codex', registrarName: 'Codex CLI' },
            { label: 'Gemini CLI', setting: 'agents.gemini', registrarName: 'Gemini CLI' },
            { label: 'Windsurf', setting: 'agents.windsurf', registrarName: 'Windsurf' },
            { label: 'Continue.dev', setting: 'agents.continue', registrarName: 'Continue.dev' },
            { label: 'Cline', setting: 'agents.cline', registrarName: 'Cline' },
        ];

        const items = await Promise.all(agents.map(async (a) => {
            let detected = false;
            if (a.alwaysAvailable) {
                detected = true;
            } else {
                const registrar = registrars.find(r => r.agentName === a.registrarName);
                detected = registrar ? await registrar.isInstalled().catch(() => false) : false;
            }
            return {
                label: a.label,
                picked: detected,
                description: a.alwaysAvailable ? '(built-in)' : detected ? '(detected)' : '(not detected)',
                setting: a.setting,
            };
        }));

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select which AI agents to register with',
            title: 'Google Workspace MCP Setup (Step 3/4): Agent Registration',
        });

        if (selected) {
            const config = vscode.workspace.getConfiguration('gwsMcp');
            for (const item of items) {
                const enabled = selected.some(s => s.label === item.label);
                await config.update(item.setting, enabled, vscode.ConfigurationTarget.Global);
            }
        }
    }

    private async step4Finalize(): Promise<void> {
        const verifyProgress = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Google Workspace MCP: Verifying connection...' },
            async () => {
                try { return await this.authManager.checkAuth(); }
                catch { return false; }
            }
        );

        if (verifyProgress) {
            vscode.window.showInformationMessage(
                'Google Workspace MCP: Setup complete! Connection verified. Your AI agents can now access Gmail, Calendar, Drive, Docs & Sheets. ' +
                'Try asking: "Show me my recent emails" or "What meetings do I have today?"'
            );
        } else {
            const retry = await vscode.window.showWarningMessage(
                'Google Workspace MCP: Setup saved, but connection could not be verified.',
                'Re-run Setup',
                'Continue Anyway'
            );
            if (retry === 'Re-run Setup') {
                return this.run();
            }
        }

        vscode.commands.executeCommand('gwsMcp.registerAgents');
    }

    private async setupAdc(): Promise<boolean> {
        if (await this.authManager.checkAuth()) {
            vscode.window.showInformationMessage('Google Workspace MCP: ADC credentials detected.');
            return true;
        }

        const { commandExists } = await import('../utils/platform.js');
        const hasGcloud = await commandExists('gcloud');

        if (!hasGcloud) {
            const fallback = await vscode.window.showWarningMessage(
                'gcloud CLI is not installed. ADC requires the Google Cloud SDK.',
                'Install gcloud (opens browser)',
                'Use OAuth Instead',
                'Cancel'
            );
            if (fallback === 'Install gcloud (opens browser)') {
                await vscode.env.openExternal(vscode.Uri.parse('https://cloud.google.com/sdk/docs/install'));
                return false;
            } else if (fallback === 'Use OAuth Instead') {
                return this.setupOAuth();
            }
            return false;
        }

        const action = await vscode.window.showWarningMessage(
            'ADC credentials not found. Run gcloud auth to create them.',
            'Copy Command',
            'I\'ve Already Done This',
            'Cancel'
        );

        if (action === 'Copy Command') {
            await vscode.env.clipboard.writeText(
                'gcloud auth application-default login --scopes=' + WORKSPACE_SCOPES.join(',')
            );
            vscode.window.showInformationMessage('Command copied! Run it in your terminal, then come back.');
            const done = await vscode.window.showInformationMessage(
                'Have you completed the gcloud auth command?',
                'Yes, Continue', 'Cancel'
            );
            return done === 'Yes, Continue';
        }

        return action === 'I\'ve Already Done This';
    }

    private async setupServiceAccount(): Promise<boolean> {
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'JSON files': ['json'] },
            title: 'Google Workspace MCP Setup (Step 2/4): Select Service Account Key File',
        });

        if (!fileUris || fileUris.length === 0) return false;

        const fileContent = await vscode.workspace.fs.readFile(fileUris[0]);
        const keyJson = Buffer.from(fileContent).toString('utf-8');

        let key: { type?: string; client_email?: string };
        try { key = JSON.parse(keyJson); }
        catch {
            vscode.window.showErrorMessage('Invalid file: could not parse JSON.');
            return false;
        }

        if (key.type !== 'service_account') {
            vscode.window.showErrorMessage('Invalid file: not a Google Cloud service account key.');
            return false;
        }

        await this.context.secrets.store('gwsMcp.serviceAccountPath', fileUris[0].fsPath);
        vscode.window.showInformationMessage(`Google Workspace MCP: Service account "${key.client_email}" configured.`);
        return true;
    }

    private async setupOAuth(): Promise<boolean> {
        const ready = await vscode.window.showInformationMessage(
            'OAuth setup requires a Google Cloud project with OAuth credentials. ' +
            'You\'ll need a Client ID and Client Secret from the Google Cloud Console. ' +
            'Enable the Gmail, Calendar, Drive, Docs, and Sheets APIs.',
            'I Have These Ready',
            'Show Me How',
            'Cancel'
        );

        if (ready === 'Show Me How') {
            await vscode.env.openExternal(vscode.Uri.parse('https://console.cloud.google.com/apis/credentials'));
            const afterGuide = await vscode.window.showInformationMessage(
                'Create an OAuth 2.0 Client ID (type: Desktop App), enable Gmail/Calendar/Drive/Docs/Sheets APIs, then come back.',
                'I\'m Ready Now', 'Cancel'
            );
            if (afterGuide !== 'I\'m Ready Now') return false;
        } else if (ready !== 'I Have These Ready') {
            return false;
        }

        const clientId = await vscode.window.showInputBox({
            prompt: 'Enter your Google OAuth Client ID',
            placeHolder: 'xxxxxx.apps.googleusercontent.com',
            title: 'Google Workspace MCP Setup (Step 2/4): OAuth Client ID',
        });
        if (!clientId) return false;

        const clientSecret = await vscode.window.showInputBox({
            prompt: 'Enter your Google OAuth Client Secret',
            password: true,
            title: 'Google Workspace MCP Setup (Step 2/4): OAuth Client Secret',
        });
        if (!clientSecret) return false;

        const { randomBytes, createHash } = await import('crypto');
        const state = randomBytes(32).toString('hex');
        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

        return new Promise<boolean>((resolve) => {
            let resolved = false;
            let port: number;

            const server = http.createServer(async (req, res) => {
                const url = new URL(req.url!, `http://127.0.0.1`);
                const code = url.searchParams.get('code');
                const returnedState = url.searchParams.get('state');

                if (returnedState !== state) {
                    res.writeHead(403, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication failed</h1><p>Invalid state parameter.</p>');
                    return;
                }

                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication successful!</h1><p>You can close this tab and return to VS Code.</p>');
                    server.close();

                    try {
                        const { OAuth2Client } = await import('google-auth-library');
                        const oauth2 = new OAuth2Client(clientId, clientSecret, `http://127.0.0.1:${port}`);
                        const { tokens } = await oauth2.getToken({ code, codeVerifier });

                        await this.authManager.storeCredentials(JSON.stringify({
                            client_id: clientId,
                            client_secret: clientSecret,
                            refresh_token: tokens.refresh_token,
                        }));

                        vscode.window.showInformationMessage('Google Workspace MCP: OAuth authentication configured.');
                        resolved = true;
                        resolve(true);
                    } catch (err: any) {
                        const safeMsg = err?.message?.replace(/client_secret[^\s]*/gi, '***') ?? 'Unknown error';
                        vscode.window.showErrorMessage(`Google Workspace MCP: OAuth token exchange failed. ${safeMsg}`);
                        resolved = true;
                        resolve(false);
                    }
                } else {
                    res.writeHead(400);
                    res.end('Missing authorization code.');
                }
            });

            server.on('error', (err: NodeJS.ErrnoException) => {
                if (!resolved) {
                    const msg = err.code === 'EADDRINUSE' ? 'OAuth port conflict.' :
                        err.code === 'EACCES' ? 'Permission denied binding to localhost.' :
                        `OAuth server failed: ${err.message}`;
                    vscode.window.showErrorMessage(`Google Workspace MCP: ${msg}`);
                    resolved = true;
                    resolve(false);
                }
            });

            server.listen(0, '127.0.0.1', async () => {
                port = (server.address() as any).port;

                const { OAuth2Client } = await import('google-auth-library');
                const oauth2 = new OAuth2Client(clientId, clientSecret, `http://127.0.0.1:${port}`);

                const { CodeChallengeMethod } = await import('google-auth-library');
                const authorizeUrl = oauth2.generateAuthUrl({
                    access_type: 'offline',
                    scope: WORKSPACE_SCOPES,
                    state,
                    code_challenge: codeChallenge,
                    code_challenge_method: CodeChallengeMethod.S256,
                });

                await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));
            });

            setTimeout(() => {
                if (!resolved) {
                    server.close();
                    vscode.window.showWarningMessage(
                        'Google Workspace MCP: OAuth timed out after 5 minutes.',
                        'Try Again', 'Cancel'
                    ).then(action => {
                        if (action === 'Try Again') this.setupOAuth().then(resolve);
                        else resolve(false);
                    });
                }
            }, 5 * 60 * 1000);
        });
    }
}
