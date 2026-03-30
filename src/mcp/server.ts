const rawStdoutWrite = process.stdout.write.bind(process.stdout);
const rawStderrWrite = process.stderr.write.bind(process.stderr);

console.log = (...args: unknown[]) => { rawStderrWrite(Buffer.from(args.join(' ') + '\n')); };
console.info = console.log;
console.debug = console.log;
console.warn = (...args: unknown[]) => { rawStderrWrite(Buffer.from('[WARN] ' + args.join(' ') + '\n')); };

process.stdout.write = ((chunk: any, encoding?: any, cb?: any) => {
    const text = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
    if (text.includes('"jsonrpc"')) {
        return rawStdoutWrite(chunk, encoding, cb);
    }
    return rawStderrWrite(chunk, encoding, cb);
}) as typeof process.stdout.write;

async function main() {
    const mcpSdk = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const mcpStdio = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const googleAuth = await import('google-auth-library');
    const tools = await import('./tools/index.js');

    const readonlyAuth = new googleAuth.GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/documents.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
    });

    const writeAuth = new googleAuth.GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    const { SERVER_NAME, SERVER_VERSION } = await import('../constants.js');

    const server = new mcpSdk.McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    });

    tools.registerAllTools(server as any, readonlyAuth, writeAuth);

    const transport = new mcpStdio.StdioServerTransport();
    await server.connect(transport);

    console.error('[gws-mcp] Server started, waiting for connections...');

    process.on('SIGTERM', () => {
        console.error('[gws-mcp] Received SIGTERM, shutting down...');
        server.close().then(() => process.exit(0));
    });

    process.on('SIGINT', () => {
        console.error('[gws-mcp] Received SIGINT, shutting down...');
        server.close().then(() => process.exit(0));
    });
}

process.on('uncaughtException', (err) => {
    console.error('[gws-mcp] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[gws-mcp] Unhandled rejection:', reason);
});

main().catch((err) => {
    console.error('[gws-mcp] Fatal error:', err);
    process.exit(1);
});
