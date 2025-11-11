# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-XX

### Added
- **🌐 Web UI**: Modern web interface for controlling sync operations
  - Start/stop sync functionality
  - Real-time status monitoring with progress bar
  - Delete all notes functionality
  - Test mode toggle with configurable limit
  - Configuration display and management
  - Error reporting and status updates

- **🔄 Bulk Sync Process**: Efficient bulk import workflow
  - Delete all existing notes in target folder before sync
  - Download all notes as markdown files first
  - Bulk import all notes with proper line break handling
  - Prevents duplicate notes and ensures consistency

- **🧪 Test Mode**: Safe testing functionality
  - Toggle test mode on/off via web UI
  - Configurable test mode limit (default: 10 notes)
  - Allows testing sync before syncing all notes
  - Limit can be adjusted in web UI

- **📊 Status Monitoring**: Real-time sync status
  - Live progress tracking (X/Y notes processed)
  - Last sync time and note count
  - Error messages and status updates
  - Auto-refreshing status display

- **🗑️ Delete All Notes**: One-click deletion
  - Delete all notes in the configured Apple Notes folder
  - Confirmation dialog for safety
  - Returns count of deleted notes

- **📋 Content Conversion**: ProseMirror to Markdown conversion
  - Converts Granola's ProseMirror format to clean Markdown
  - Preserves headings, lists, and formatting
  - Handles nested content structures

- **📁 Apple Notes Integration**: Direct Apple Notes integration
  - Uses AppleScript for reliable note creation
  - Supports multiple Apple Notes accounts (iCloud, On My Mac, etc.)
  - Automatic folder creation if it doesn't exist
  - Proper line break handling (Unix newlines → AppleScript returns)

- **⚙️ Configuration System**: Comprehensive configuration
  - JSON-based configuration file (`config.json`)
  - Example configuration file provided
  - Web UI for test mode and limit configuration
  - Support for all Granola sync settings

- **🔗 Granola URL Links**: Optional links back to original notes
  - Configurable inclusion of Granola URLs
  - Links stored in note metadata

- **📝 Metadata Support**: Rich note metadata
  - Granola ID tracking for duplicate detection
  - Creation and update timestamps
  - Optional attendee tags
  - Optional folder tags

### Changed
- **Complete Refactor**: Converted from Obsidian plugin to standalone Node.js application
  - Removed Obsidian-specific code
  - Replaced file system operations with AppleScript automation
  - Changed from plugin architecture to web application

- **Sync Strategy**: Changed from incremental updates to full resync
  - Deletes all notes before importing
  - Ensures consistency and prevents duplicates
  - Handles title preservation correctly

- **Line Break Handling**: Improved newline conversion
  - Properly converts Unix newlines (`\n`) to AppleScript return characters
  - Ensures notes display with correct line breaks in Apple Notes

### Technical
- **Node.js Application**: Standalone Node.js application (not a plugin)
- **HTTP Server**: Built-in web server for UI (`ui-server.js`)
- **AppleScript Integration**: Direct AppleScript execution for Apple Notes
- **API Integration**: Granola API integration with pagination support
- **Error Handling**: Comprehensive error handling and reporting
- **Status Tracking**: Real-time status tracking for sync operations

### Fixed
- **Title Preservation**: Fixed issue where note titles were lost on resync
- **Line Breaks**: Fixed continuous text issue - notes now display with proper line breaks
- **Stop Sync**: Fixed stop sync button to properly cancel ongoing sync operations
- **Button States**: Fixed button text not reverting after sync completes
- **Config Saving**: Fixed test mode limit not being saved due to premature page refresh

### Removed
- **Obsidian Dependencies**: Removed all Obsidian plugin code
- **File System Operations**: Removed direct file system note creation
- **Daily Notes Integration**: Removed Obsidian Daily Notes integration
- **Periodic Notes Integration**: Removed Obsidian Periodic Notes integration
- **Obsidian Settings UI**: Replaced with web UI

### Migration Notes
- This is a complete rewrite from the original Obsidian plugin
- Users migrating from the Obsidian version will need to:
  1. Install Node.js
  2. Run `npm install`
  3. Configure `config.json`
  4. Use the web UI instead of Obsidian settings

---

## Previous Versions (Obsidian Plugin)

The following changelog entries are from the original Granola to Obsidian plugin that this project was forked from. They are kept for historical reference.

<details>
<summary>Click to expand Obsidian plugin changelog</summary>

## [1.6.0]
### Added
- **🗓️ Periodic Notes Integration**: New support for the Periodic Notes plugin alongside existing Daily Notes integration
  - Independent toggle for Periodic Notes integration (can be used with or without Daily Notes)
  - Configurable section heading for Periodic Notes (separate from Daily Notes section)
  - Automatic detection of Periodic Notes plugin availability
  - Settings UI automatically disables when Periodic Notes plugin is not installed
  - Seamlessly integrates with Periodic Notes' daily note creation and management

### Enhanced
- **Dual Integration Support**: Users can now enable Daily Notes, Periodic Notes, both, or neither
- **User Choice**: Flexible integration options to match different Obsidian workflows
- **Backward Compatibility**: All existing Daily Notes functionality preserved unchanged

### Technical
- Added `enablePeriodicNoteIntegration` and `periodicNoteSectionName` settings
- Added `isPeriodicNotesPluginAvailable()` method for plugin detection
- Added `getPeriodicNote()` method for Periodic Notes API integration
- Added `updatePeriodicNote()` method mirroring Daily Notes functionality
- Enhanced sync logic to support both integrations independently
- All changes maintain 100% backward compatibility with existing settings and workflows

### Fixes Issue
- Resolves [#6](https://github.com/dannymcc/Granola-to-Obsidian/issues/6): Request for Periodic Notes plugin support

## [1.5.2]
### Fixed
- **Settings UI**: Fixed JavaScript errors that prevented all settings from displaying
- **Heading Syntax**: Corrected `setHeading()` calls to use proper `createEl()` syntax
- **Sync Functionality**: Resolved sync issues caused by cached JavaScript errors
- **Console Output**: Cleaned up debug logs for cleaner production experience

### Technical
- Fixed `containerEl.createEl().setHeading()` runtime errors
- Restored all 19 settings to be properly displayed and functional
- Improved error handling and reduced verbose logging

## [1.5.1]
### Fixed
- **Platform Support**: Added proper Linux authentication path support (`~/.config/Granola/supabase.json`)
- **Modern Obsidian APIs**: Replaced deprecated APIs with current best practices
  - Use `Platform` instead of Node.js `os` module
  - Use `window.setTimeout`/`window.setInterval` instead of global versions
  - Use `Vault.process` instead of `Vault.modify` for background file operations
  - Use `Vault.getFolderByPath` instead of `getAbstractFileByPath`
  - Use `Vault.recurseChildren` for recursive folder operations
  - Use `Vault.getAllFolders` for folder enumeration
  - Use `FileManager.processFrontMatter` for atomic frontmatter updates
  - Use `MetadataCache.getFileCache` instead of regex for heading detection
- **UI Consistency**: Converted all UI text to sentence case per Obsidian guidelines
- **Settings Improvements**: 
  - Use `setHeading()` instead of HTML heading elements
  - Remove hardcoded CSS styling
  - Remove top-level settings heading
  - Remove ribbon icon toggle (users can customize via Obsidian settings)
- **Code Quality**: 
  - Reduced unnecessary console logging while preserving essential error messages
  - Improved error handling and performance
- **Version Requirements**: Updated minAppVersion to 1.6.6 to support modern APIs

### Technical
- All changes maintain backward compatibility for user data and settings
- No breaking changes to plugin functionality or user experience
- Addresses all Obsidian plugin review feedback for official plugin store inclusion

## [1.5.0]
### Added
- **🧪 Experimental: Search Scope for Existing Notes**: Control where the plugin searches for existing notes when checking for duplicates by granola-id
- **Flexible Search Options**: Choose between "Sync Directory Only" (default), "Entire Vault", or "Specific Folders"
- **Duplicate Prevention Tools**: Added "Find Duplicate Notes" button to scan for and identify existing duplicates
- **Auto-Sync Safety**: New "Re-enable Auto-Sync" button to safely restart auto-sync after testing new settings
- **Enhanced Settings Safety**: Search scope settings now save without triggering auto-sync to prevent accidental duplicates

### Enhanced
- **Experimental Features Section**: Clear UI separation for experimental features with backup warnings
- **User Safety**: Prominent warnings about backing up vault before using experimental features
- **Duplicate Management**: Added comprehensive duplicate detection and management tools
- **Error Prevention**: Auto-sync temporarily disabled when changing search scope settings

### Technical
- **Recursive Folder Search**: Added support for searching all markdown files within specified folders and subfolders
- **Safe Settings Management**: New `saveSettingsWithoutSync()` method to prevent unwanted auto-sync triggers
- **Validation Improvements**: Enhanced folder path validation with user-friendly error messages
- **Search Scope Flexibility**: Infrastructure for different search strategies based on user needs

## [1.4.0]
### Added
- **Customizable Attendee Tag Structure**: New setting to customize how attendee tags are formatted and organized
- **Tag Template System**: Use `{name}` placeholder to create custom tag hierarchies (e.g., `people/{name}`, `meeting-attendees/{name}`)
- **Flexible Tag Organization**: Allows users to control their tag hierarchy and reduce root-level tag clutter in Obsidian

### Enhanced
- **Attendee Tag Generation**: Now uses customizable templates instead of hardcoded `person/` prefix
- **Tag Validation**: Automatic cleanup of invalid tag structures (double slashes, leading/trailing slashes)
- **Settings UI**: Added new "Attendee Tag Template" setting with helpful examples and validation

## [1.3.2]
### Fixed
- **Nested bullet preservation**: Fixed issue where sub-bullets from Granola were being flattened instead of maintaining proper indentation in Obsidian
- **List structure**: Improved ProseMirror to Markdown conversion to properly handle nested bullet lists with correct indentation
- **Bullet formatting**: Sub-bullets now display with proper 2-space indentation per nesting level

## [1.3.1]
### Fixed
- **Granola URL format**: Fixed incorrect URL format from `https://app.granola.ai/documents/{id}` to correct `https://notes.granola.ai/d/{id}`
- Updated documentation examples to reflect correct URL format

## [1.3.0]
### Added
- **Granola URL integration**: Add links back to original Granola notes in frontmatter (`granola_url`)
- **Enhanced attendee extraction**: Improved name resolution using detailed person data from Granola API
- **Multi-folder infrastructure**: Code infrastructure ready for when Granola API includes folder information
- **Organized settings UI**: Grouped related settings into clear sections (Metadata & Tags, Daily Note Integration, etc.)
- **Better deduplication**: Prevents duplicate attendees from multiple sources (people array + calendar events)

### Enhanced
- **Attendee name detection**: Now uses `fullName`, `givenName`, `familyName` fields for more accurate names
- **Settings organization**: Related settings grouped under clear headings for better UX
- **Metadata management**: Unified handling of tags, URLs, and other frontmatter data
- **Console output**: Cleaner debug information with better organization

### Technical
- **Future-ready folder support**: All infrastructure in place for multi-folder tagging when API supports it
- **Improved email tracking**: Prevents processing same attendee multiple times across different data sources
- **Enhanced error handling**: Better error messages and graceful fallbacks
- **Code organization**: Cleaner separation of concerns and modular design

## [1.2.2]
### Fixed
- **Critical bug**: Fixed issue where meetings with duplicate titles (e.g., recurring "Enterprise Team | Project Update") were being skipped instead of created with unique filenames
- Daily note integration now works correctly for meetings that would have been skipped due to filename collisions
- Added timestamp-based unique filename generation when title conflicts occur

## [1.2.1]
### Fixed
- **Critical bug**: Fixed daily note integration using hardcoded date instead of current date
- Daily note meetings now correctly appear in today's note instead of a previous date
- Enhanced daily note detection to work with multiple date formats (DD-MM-YYYY, YYYY-MM-DD, etc.)

## [1.2.0]
### Added
- **Attendee tagging system**: Automatically extract meeting attendees and add them as tags in note frontmatter
- **Smart name filtering**: Exclude your own name from attendee tags with configurable settings
- **Organised tag structure**: Uses `person/` prefix for clean tag organisation (e.g. `person/john-smith`)
- **Existing note updates**: Updates attendee tags in existing notes while preserving manual edits when enabled
- **Conservative defaults**: Attendee tagging disabled by default to avoid disrupting existing workflows

### Changed
- Enhanced settings UI with attendee tagging configuration options
- Improved case-insensitive name matching for more reliable filtering

## [1.1.2]
### Fixed
- Completely resolved daily note integration issues by implementing a robust file search-based approach
- Daily note integration now works regardless of complex Daily Notes plugin configurations
- Meetings from today are now properly added to the daily note section as expected

## [1.1.1]
### Fixed
- Resolved "File already exists" error by adding proper file name conflict detection
- Fixed daily note integration to work with hierarchical folder structures (e.g. Notes/Daily/YYYY/MM)
- Enhanced daily note detection with better logging and error handling
- Improved folder creation for date-based daily note structures

## [1.1.0]
### Added
- Customisable daily note section name setting - users can now customise the heading used for Granola meetings in their Daily Note

## [1.0.9]
### Changed
- New version number bump to adpot new versioning

## [1.0.8]
### Fixed
- Updated version numbering to use simple X.X.X format for Obsidian compatibility
- Fixed manifest.json to remove "v" prefix from version numbers

### Changed
- GitHub releases now use clean version tags (e.g., 1.0.8) instead of v-prefixed tags

## [1.0.7]
### Added
- Daily Note integration feature
- Skip existing notes option

### Fixed
- Improved error handling for sync operations

## [1.0.6]
### Added
- Custom filename templates with variables
- Better date formatting options

### Fixed
- Status bar updates during sync operations

## [1.0.5]
### Fixed
- Authentication path detection improvements
- Better error messages for sync failures

## [1.0.4]
### Added
- Auto-sync frequency options
- Status bar integration

### Fixed
- File naming edge cases

## [1.0.3]
### Fixed
- Content conversion improvements
- Better handling of missing data

## [1.0.2]
### Added
- Customizable sync directory
- Note prefix options

### Fixed
- Frontmatter formatting improvements

## [1.0.1]
### Fixed
- Initial bug fixes and stability improvements

## [1.0.0]
### Added
- Initial release of Granola Sync plugin
- Basic sync functionality for Granola AI notes
- Automatic content conversion from ProseMirror to Markdown
- Frontmatter with metadata support

</details>
