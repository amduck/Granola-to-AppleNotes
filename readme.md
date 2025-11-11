# Granola to Apple Notes Sync

A Node.js script that automatically syncs your [Granola AI](https://granola.ai) meeting notes to Apple Notes on macOS with full customization options.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

## 🚀 Features

- **🔄 Automatic Sync**: Configurable auto-sync from every minute to daily, or manual-only
- **📅 Custom Date Formats**: Support for multiple date formats (YYYY-MM-DD, DD-MM-YYYY, etc.)
- **📝 Flexible Filename Templates**: Customize how notes are named with variables like date, time, and title
- **📁 Apple Notes Folder Support**: Organize notes into specific folders in Apple Notes
- **🏷️ Note Prefixes**: Add custom prefixes to all synced notes
- **🔧 Custom Auth Path**: Override the default Granola credentials location
- **🏷️ Attendee Tagging**: Automatically extract meeting attendees and add them as organized tags
- **🔗 Granola URL Links**: Add direct links back to original Granola notes for easy access
- **🔧 Smart Filtering**: Exclude your own name from attendee tags with configurable settings
- **🛡️ Preserve Manual Additions**: Option to skip updating existing notes, preserving your edits
- **✨ Rich Metadata**: Includes metadata with creation/update dates and Granola IDs
- **📋 Content Conversion**: Converts ProseMirror content to clean Markdown
- **🔄 Update Handling**: Intelligently updates existing notes instead of creating duplicates
- **📁 Granola Folder Organization**: Mirror your Granola folder structure in Apple Notes

## 📋 Requirements

- **macOS** (Apple Notes is macOS-only)
- **Node.js** v12.0.0 or higher
- **Active Granola AI account**
- **Granola desktop app** installed and authenticated

## 📦 Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd Granola-to-AppleNotes
   ```

2. **Copy the example config file**
   ```bash
   cp config.json.example config.json
   ```

3. **Edit `config.json`** with your settings (see Configuration section below)

4. **Run the sync**
   ```bash
   node main.js --sync
   ```

## ⚙️ Configuration

Edit `config.json` to customize your sync settings:

### Apple Notes Settings

- **`appleNotesAccount`**: The Apple Notes account to use (default: `"iCloud"`)
  - Common values: `"iCloud"`, `"On My Mac"`, or your email address
  - To find your account name, open Apple Notes and check the sidebar

- **`appleNotesFolder`**: The folder name within the account (default: `""` for root)
  - Leave empty to sync to the root of the account
  - Specify a folder name to organize notes (folder will be created if it doesn't exist)
  - Example: `"Granola Notes"` or `"Meetings"`

### Granola Authentication

- **`authKeyPath`**: Path to your Granola authentication file (relative to home directory)
  - **macOS default**: `Library/Application Support/Granola/supabase.json`
  - The script automatically checks common locations

### Note Formatting

- **`notePrefix`**: Optional prefix to add to all synced note titles (e.g., `"Meeting: "`)

- **`filenameTemplate`**: Template for note titles (not filenames in Apple Notes, but used for organization)
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

## 🎯 Usage

### Manual Sync

Run a single sync operation:

```bash
node main.js --sync
# or
node main.js -s
```

### Auto-Sync

Start continuous auto-sync (runs in the foreground):

```bash
node main.js --auto-sync
# or
node main.js -a
```

Press `Ctrl+C` to stop auto-sync.

### Help

View usage information:

```bash
node main.js --help
# or
node main.js -h
```

### Using npm scripts (if you prefer)

If you've set up the project, you can also use:

```bash
npm run sync        # Single sync
npm run auto-sync   # Start auto-sync
npm start           # Start auto-sync (alias)
```

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
- All formatting is converted appropriately
```

## 🔧 How It Works

1. **Authentication**: Reads your Granola authentication token from the local Granola app data
2. **API Integration**: Fetches your notes from the Granola API
3. **Content Conversion**: Converts ProseMirror format to Markdown
4. **Apple Notes Integration**: Uses AppleScript to create/update notes in Apple Notes
5. **Duplicate Detection**: Checks for existing notes by Granola ID to avoid duplicates

## 🐛 Troubleshooting

### Script Won't Run

- **Check Node.js version**: Run `node --version` (needs v12+)
- **Check file permissions**: Ensure `main.js` and `create-note.applescript` are executable
- **Check macOS version**: Apple Notes scripting requires macOS

### No Notes Syncing

- **Verify Granola auth**: Check that `config.json` has the correct `authKeyPath`
- **Check Granola app**: Ensure Granola desktop app is logged in
- **Check API access**: Verify you have meeting notes in your Granola account
- **Check console output**: Look for error messages in the terminal

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
- **Note not updating**: Check that `skipExistingNotes` is `false` if you want updates

### Content Issues

- **Missing content**: Some notes may not have content if they're empty in Granola
- **Formatting issues**: Markdown conversion preserves most formatting, but some complex structures may be simplified
- **Transcript missing**: Ensure `includeFullTranscript` is `true` if you want transcripts

## 🔒 Security & Privacy

- **Local only**: All processing happens on your Mac
- **No cloud upload**: Your notes never leave your computer
- **Uses existing auth**: Reads Granola credentials already stored locally
- **AppleScript permissions**: First run may require granting terminal app permission to control Notes

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- With thanks to [Joseph Thacker](https://josephthacker.com/) for first discovering that it's possible to query the Granola [API using locally stored auth keys](https://josephthacker.com/hacking/2025/05/08/reverse-engineering-granola-notes.html)!
- [Granola AI](https://granola.ai) for creating an amazing meeting assistant
- Based on the original [Granola to Obsidian](https://github.com/dannymcc/Granola-to-Obsidian) plugin by Danny McClelland

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/Granola-to-AppleNotes/issues)
- **Documentation**: This README

---

**Made with ❤️ for the Granola and Apple Notes community**

*Not officially affiliated with Granola AI or Apple.*
