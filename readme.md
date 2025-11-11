# Granola to Apple Notes Sync

A Node.js application that syncs your [Granola AI](https://granola.ai) meeting notes to Apple Notes on macOS. Features a modern web UI for easy control and monitoring.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

## 🚀 Features

- **🌐 Web UI**: Beautiful, modern web interface for controlling sync operations
- **🔄 Bulk Sync**: Efficient bulk import with proper line break handling
- **🧪 Test Mode**: Toggle test mode with configurable limit (default: 10 notes)
- **📊 Real-time Status**: Live sync progress and status monitoring
- **🗑️ Delete All Notes**: One-click deletion of all synced notes
- **📁 Apple Notes Folder Support**: Organize notes into specific folders
- **🔗 Granola URL Links**: Optional links back to original Granola notes
- **📋 Content Conversion**: Converts ProseMirror content to clean Markdown
- **🔄 Full Resync**: Deletes and re-imports all notes for consistency
- **⚙️ Configurable Settings**: Extensive configuration options via web UI and config file

## 📋 Requirements

- **macOS** (Apple Notes is macOS-only)
- **Node.js** v12.0.0 or higher
- **Active Granola AI account**
- **Granola desktop app** installed and authenticated

## 📦 Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/amduck/Granola-to-AppleNotes.git
   cd Granola-to-AppleNotes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy the example config file**
   ```bash
   cp config.json.example config.json
   ```

4. **Edit `config.json`** with your settings (see Configuration section below)

## 🎯 Usage

### Web UI (Recommended)

Start the web server:

```bash
npm start
# or
npm run ui
# or
node ui-server.js
```

Then open your browser to:
```
http://localhost:3000
```

The web UI provides:
- **Start Sync**: Begin syncing notes from Granola to Apple Notes
- **Stop Sync**: Cancel an ongoing sync operation
- **Delete All Notes**: Remove all notes from the Apple Notes folder
- **Test Mode Toggle**: Enable/disable test mode (limits sync to N notes)
- **Test Mode Limit**: Configure how many notes to sync in test mode
- **Real-time Status**: View sync progress, last sync time, and errors
- **Configuration Display**: See all current settings

### Command Line (Alternative)

You can also run sync directly from the command line:

```bash
# Single sync
npm run sync
# or
node main.js --sync

# Auto-sync (runs continuously)
npm run auto-sync
# or
node main.js --auto-sync
```

## ⚙️ Configuration

Edit `config.json` to customize your sync settings:

### Apple Notes Settings

- **`appleNotesAccount`**: The Apple Notes account to use (default: `"iCloud"`)
  - Common values: `"iCloud"`, `"On My Mac"`, or your email address
  - To find your account name, open Apple Notes and check the sidebar

- **`appleNotesFolder`**: The folder name within the account (default: `"Granola"`)
  - Leave empty to sync to the root of the account
  - Specify a folder name to organize notes (folder will be created if it doesn't exist)
  - Example: `"Granola"` or `"Meetings"`

### Test Mode

- **`testMode`**: Enable test mode to sync only a limited number of notes (default: `false`)
  - When enabled, only syncs the number of notes specified in `testModeLimit`
  - Useful for testing before syncing all notes
  - Can be toggled in the web UI

- **`testModeLimit`**: Number of notes to sync when test mode is enabled (default: `10`)
  - Can be configured in the web UI
  - Minimum value: 1

### Granola Authentication

- **`authKeyPath`**: Path to your Granola authentication file (relative to home directory)
  - **macOS default**: `Library/Application Support/Granola/supabase.json`
  - The script automatically checks common locations

### Note Formatting

- **`notePrefix`**: Optional prefix to add to all synced note titles (e.g., `"Meeting: "`)

- **`filenameTemplate`**: Template for note titles
  - Variables: `{title}`, `{id}`, `{created_date}`, `{updated_date}`, `{created_time}`, `{updated_time}`, `{created_datetime}`, `{updated_datetime}`
  - Example: `"{created_date} - {title}"`

- **`dateFormat`**: Date formatting tokens
  - `YYYY` - 4-digit year, `YY` - 2-digit year
  - `MM` - 2-digit month, `DD` - 2-digit day
  - `HH` - 2-digit hours, `mm` - 2-digit minutes, `ss` - 2-digit seconds
  - Example: `"YYYY-MM-DD"` → `2025-06-06`

### Sync Behavior

- **`autoSyncFrequency`**: Auto-sync interval in milliseconds
  - `0` = disabled (manual sync only)
  - `60000` = every 1 minute
  - `300000` = every 5 minutes (default)
  - `3600000` = every 1 hour
  - `86400000` = every 24 hours

- **`skipExistingNotes`**: If `true`, existing notes won't be updated (preserves your manual edits)
  - Note: Current implementation uses full resync (delete and re-import), so this setting may not apply

- **`includeFullTranscript`**: If `true`, includes the full meeting transcript in each note

### Metadata & Tags

- **`includeAttendeeTags`**: If `true`, adds meeting attendees as tags in the note
- **`excludeMyNameFromTags`**: If `true`, excludes your name from attendee tags
- **`myName`**: Your name as it appears in Granola meetings (for filtering)
- **`attendeeTagTemplate`**: Template for attendee tags (use `{name}` placeholder)
  - Example: `"person/{name}"` → `person/john-smith`
- **`includeFolderTags`**: If `true`, adds Granola folder names as tags
- **`folderTagTemplate`**: Template for folder tags (use `{name}` placeholder)
- **`includeGranolaUrl`**: If `true`, adds a link back to the original Granola note

## 🔧 How It Works

1. **Authentication**: Reads your Granola authentication token from the local Granola app data
2. **API Integration**: Fetches your notes from the Granola API (with pagination support)
3. **Content Conversion**: Converts ProseMirror format to Markdown
4. **Bulk Import Process**:
   - Deletes all existing notes in the target Apple Notes folder
   - Downloads and saves all notes as temporary markdown files
   - Bulk imports all markdown files into Apple Notes with proper line breaks
5. **Apple Notes Integration**: Uses AppleScript to create notes directly in Apple Notes
6. **Line Break Handling**: Properly converts Unix newlines to AppleScript return characters for correct formatting

## 📄 Note Format

Synced notes include metadata at the top:

```
--- Granola Note ---
granola_id: abc123def456
title: "Team Standup Meeting"
granola_url: https://notes.granola.ai/d/abc123def456
created_at: 2025-06-06T14:30:00.000Z
updated_at: 2025-06-06T15:45:00.000Z
tags: person/john-smith, person/sarah-jones
---

# Team Standup Meeting

Your converted meeting content appears here in clean Markdown format.

- Action items are preserved
- Headings maintain their structure
- Line breaks are properly formatted
- All formatting is converted appropriately
```

## 🐛 Troubleshooting

### Web UI Won't Start

- **Port already in use**: Another process may be using port 3000
  - Kill the existing process: `lsof -ti:3000 | xargs kill -9`
  - Or use a different port: `PORT=3001 node ui-server.js`
- **Check Node.js version**: Run `node --version` (needs v12+)

### Script Won't Run

- **Check file permissions**: Ensure `main.js` and `ui-server.js` are executable
- **Check macOS version**: Apple Notes scripting requires macOS
- **Check dependencies**: Run `npm install` to ensure all dependencies are installed

### No Notes Syncing

- **Verify Granola auth**: Check that `config.json` has the correct `authKeyPath`
- **Check Granola app**: Ensure Granola desktop app is logged in
- **Check API access**: Verify you have meeting notes in your Granola account
- **Check console output**: Look for error messages in the terminal
- **Try test mode**: Enable test mode in the UI to sync just a few notes first

### Authentication Issues

- **Verify auth file location**: Default is `~/Library/Application Support/Granola/supabase.json`
- **Check file exists**: Make sure the Granola app has created the auth file
- **Try logging out/in**: Log out and back into the Granola desktop app
- **Update config**: If the file is elsewhere, update `authKeyPath` in `config.json`

### Apple Notes Issues

- **Check account name**: Verify `appleNotesAccount` matches exactly (case-sensitive)
  - Open Apple Notes and check the sidebar for exact account names
  - Common: `"iCloud"`, `"On My Mac"`, or your email address
- **Check permissions**: First run may prompt for AppleScript permissions
  - Go to System Preferences → Security & Privacy → Privacy → Automation
  - Allow Terminal/iTerm/your terminal app to control Notes
- **Folder creation**: If folder doesn't exist, the script will create it automatically
- **Line breaks not working**: Ensure you're using the latest version with improved line break handling

### Content Issues

- **Missing content**: Some notes may not have content if they're empty in Granola
- **Formatting issues**: Markdown conversion preserves most formatting, but some complex structures may be simplified
- **Transcript missing**: Ensure `includeFullTranscript` is `true` if you want transcripts
- **Title lost on resync**: The current implementation uses full resync, so titles should be preserved correctly

## 🔒 Security & Privacy

- **Local only**: All processing happens on your Mac
- **No cloud upload**: Your notes never leave your computer
- **Uses existing auth**: Reads Granola credentials already stored locally
- **AppleScript permissions**: First run may require granting terminal app permission to control Notes
- **Web UI**: The web server runs locally on `localhost:3000` and is not accessible from other machines

## 📝 Project Structure

```
Granola-to-AppleNotes/
├── main.js              # Core sync functionality
├── ui-server.js         # Web server for the UI
├── ui.html              # Web UI frontend
├── config.json          # Your configuration (create from config.json.example)
├── config.json.example  # Example configuration file
├── package.json         # Node.js dependencies and scripts
├── create-note.applescript  # AppleScript helper (legacy, kept for reference)
└── readme.md            # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- With thanks to [Joseph Thacker](https://josephthacker.com/) for first discovering that it's possible to query the Granola [API using locally stored auth keys](https://josephthacker.com/hacking/2025/05/08/reverse-engineering-granola-notes.html)!
- [Granola AI](https://granola.ai) for creating an amazing meeting assistant
- Based on the original [Granola to Obsidian](https://github.com/dannymcc/Granola-to-Obsidian) plugin by Danny McClelland

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/amduck/Granola-to-AppleNotes/issues)
- **Documentation**: This README

---

**Made with ❤️ for the Granola and Apple Notes community**

*Not officially affiliated with Granola AI or Apple.*
