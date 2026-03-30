# Google Workspace MCP

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/mercurial.google-workspace-mcp?label=Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=mercurial.google-workspace-mcp)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/mercurial.google-workspace-mcp?color=green)](https://marketplace.visualstudio.com/items?itemName=mercurial.google-workspace-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Gmail, Calendar, Drive, Docs & Sheets tools for every AI agent** -- Claude, Copilot, Cursor, Codex, Gemini, Windsurf, Continue.dev, and Cline. One extension, 8 agents, zero config files to edit.

> Install. Authenticate. Ask your AI to read emails, check your calendar, or edit a spreadsheet. That's it.

## Quick Start

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mercurial.google-workspace-mcp)
2. **Authenticate** -- the setup wizard appears on first launch
3. **Ask your AI agent** anything about your Google Workspace

```
"Show me my unread emails"
"What meetings do I have today?"
"Find the budget spreadsheet in my Drive"
"Append a row to my tracking sheet"
```

---

## Prerequisites

You need **one** of these (the wizard will guide you):

| Method | Best For | What You Need |
|--------|----------|---------------|
| **OAuth** (recommended) | Personal Gmail/Workspace accounts | A Google Cloud project with OAuth credentials |
| **ADC** | Developers with `gcloud` CLI | Run one terminal command |
| **Service Account** | Workspace admin / domain-wide delegation | A JSON key file + domain admin setup |

### Option A: OAuth 2.0 (Browser Login) -- Recommended

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the required APIs:
   - Go to **APIs & Services** > **Library**
   - Enable: **Gmail API**, **Google Calendar API**, **Google Drive API**, **Google Docs API**, **Google Sheets API**
4. Create OAuth credentials:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Application type: **Desktop app**
   - Copy the **Client ID** and **Client Secret**
5. Configure the OAuth consent screen (if prompted):
   - Add yourself as a test user (if External)
6. In the extension wizard, select "OAuth" and paste your Client ID and Secret
7. A browser window opens > sign in with your Google account > authorize

### Option B: Application Default Credentials

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/calendar.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/documents.readonly,https://www.googleapis.com/auth/spreadsheets.readonly
```

### Option C: Service Account Key

1. Create a service account in Google Cloud Console
2. Enable domain-wide delegation (required for Gmail access)
3. Download the JSON key file
4. In the extension wizard, select "Service Account" and pick the file

---

## Available Tools (16)

### Gmail (4 tools)

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| `gmail_list` | List recent emails with metadata | "Show me my last 10 emails" |
| `gmail_read` | Read full email content by ID | "Read that email from John" |
| `gmail_search` | Search emails using Gmail query syntax | "Find emails from boss@company.com this week" |
| `gmail_send` | Send an email | "Send an email to team@company.com about the meeting" |

### Gmail Admin (mega-tool)

| Action | Description |
|--------|-------------|
| `create_draft` | Create a new email draft |
| `update_draft` | Update an existing draft |
| `delete_draft` | Delete a draft (requires confirm) |
| `add_label` / `remove_label` | Manage message labels |
| `create_label` / `delete_label` | Create or delete labels |
| `trash` / `untrash` | Move to/from trash (trash requires confirm) |
| `mark_read` / `mark_unread` | Toggle read status |

### Calendar (2 tools)

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| `calendar_list_events` | List upcoming events | "What meetings do I have today?" |
| `calendar_get_event` | Get full event details | "Show me the details of my 3pm meeting" |

### Calendar Admin (mega-tool)

| Action | Description |
|--------|-------------|
| `create_event` | Create a new calendar event |
| `update_event` | Update event details |
| `delete_event` | Delete an event (requires confirm) |
| `list_calendars` | List all calendars |
| `create_calendar` | Create a new calendar |

### Drive (2 tools)

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| `drive_list` | List files in Drive or folder | "Show me files in my Drive" |
| `drive_search` | Search files by content or name | "Find the Q4 report" |

### Drive Admin (mega-tool)

| Action | Description |
|--------|-------------|
| `create_folder` | Create a new folder |
| `move` / `copy` / `rename` | File operations |
| `delete` | Delete a file (requires confirm) |
| `share` / `unshare` | Manage sharing permissions |
| `get_permissions` | View current permissions |

### Docs (1 tool)

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| `docs_read` | Read full text of a Google Doc | "Read the project proposal doc" |

### Docs Admin (mega-tool)

| Action | Description |
|--------|-------------|
| `create` | Create a new document |
| `append_text` | Add text to end of document |
| `insert_text` | Insert text at a specific position |
| `replace_text` | Find and replace text |
| `delete_content` | Delete content range (requires confirm) |

### Sheets (1 tool)

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| `sheets_read` | Read cell data or sheet metadata | "Show me the data in Sheet1!A1:D10" |

### Sheets Admin (mega-tool)

| Action | Description |
|--------|-------------|
| `create` | Create a new spreadsheet |
| `append_rows` | Add rows to a sheet |
| `update_cells` | Update cell values |
| `add_sheet` | Add a new sheet tab |
| `delete_sheet` | Delete a sheet tab (requires confirm) |
| `clear_range` | Clear a cell range (requires confirm) |

### Safety

Destructive actions (delete, trash, clear) require `confirm: true` to execute. The AI agent will be warned and must explicitly confirm before proceeding.

---

## Supported AI Agents

The extension auto-registers with every AI agent it detects:

| Agent | How It Registers | Config File |
|-------|-----------------|-------------|
| VS Code Copilot | VS Code API (automatic) | -- |
| Claude Code | `~/.claude.json` | JSON |
| Cursor | `~/.cursor/mcp.json` | JSON |
| OpenAI Codex | `~/.codex/config.toml` | TOML |
| Google Gemini | `~/.gemini/settings.json` | JSON |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | JSON |
| Continue.dev | `~/.continue/config.yaml` | YAML |
| Cline | VS Code globalStorage | JSON |

You can toggle individual agents on/off in **Settings** > search `gwsMcp.agents`.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gwsMcp.authMethod` | `"oauth"` | Auth method: oauth, adc, serviceAccount |
| `gwsMcp.agents.*` | `true` | Per-agent registration toggles |
| `gwsMcp.registrationScope` | `"global"` | Global or workspace registration |
| `gwsMcp.autoStart` | `true` | Auto-start server on VS Code launch |
| `gwsMcp.serverLogLevel` | `"info"` | Server log verbosity |

---

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for:

| Command | What It Does |
|---------|-------------|
| `Google Workspace MCP: Setup Authentication` | Run the setup wizard |
| `Google Workspace MCP: Register with AI Agents` | Re-register with all detected agents |
| `Google Workspace MCP: Show Status` | Show auth method and server state |
| `Google Workspace MCP: Restart MCP Server` | Restart the background MCP server |
| `Google Workspace MCP: Check Authentication Status` | Verify credentials are valid |
| `Google Workspace MCP: View Server Logs` | Open the output channel for debugging |
| `Google Workspace MCP: Remove from All Agents` | Clean up all agent registrations |

---

## Troubleshooting

### "GWS MCP: Setup" in status bar
Your credentials aren't configured. Click the status bar item or run `Google Workspace MCP: Setup Authentication`.

### "Permission Denied" errors
Your credentials don't have access to the requested service. Make sure the required APIs are enabled in your Google Cloud project.

### Server keeps crashing
Run `Google Workspace MCP: View Server Logs` to see the error. Common causes:
- Expired credentials > run setup wizard again
- Node.js not found > install Node.js 18+ or the extension uses VS Code's bundled runtime
- API not enabled > enable the relevant API in Google Cloud Console

### Uninstalling cleanly
Before uninstalling: run `Google Workspace MCP: Remove from All Agents` to clean up config files.

---

## Privacy

This extension:
- **Does NOT collect telemetry** or send data to third parties
- Communicates only with Google Workspace APIs using your own credentials
- Stores credentials in VS Code's built-in SecretStorage (encrypted, per-user)
- OAuth refresh tokens never leave your machine

---

## Links

- [Documentation](https://renzojohnson.com/contributions/google-workspace-mcp)
- [Report an Issue](https://github.com/renzojohnson/google-workspace-mcp/issues)

---

**By [Renzo Johnson](https://renzojohnson.com)** | Published by [mercurial](https://marketplace.visualstudio.com/publishers/mercurial)
