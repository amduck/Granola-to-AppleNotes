const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Default settings
const DEFAULT_SETTINGS = {
	notePrefix: '',
	authKeyPath: getDefaultAuthPath(),
	filenameTemplate: '{title}',
	dateFormat: 'YYYY-MM-DD',
	autoSyncFrequency: 300000, // 5 minutes in milliseconds
	includeFullTranscript: false,
	skipExistingNotes: false,
	includeAttendeeTags: false,
	excludeMyNameFromTags: true,
	myName: '',
	includeFolderTags: false,
	includeGranolaUrl: false,
	attendeeTagTemplate: 'person/{name}',
	folderTagTemplate: 'folder/{name}',
	appleNotesAccount: 'iCloud', // Default to iCloud, can be 'On My Mac' or other account names
	appleNotesFolder: '', // Empty means root folder, otherwise specify folder name
	testMode: false, // Test mode - only sync limited number of notes
	testModeLimit: 10, // Number of notes to sync in test mode
	preserveTitlesOnUpdate: true, // If true, skip body updates when title is already correct (prevents title loss)
};

// Load settings from config file
function loadSettings() {
	const configPath = path.join(__dirname, 'config.json');
	if (fs.existsSync(configPath)) {
		try {
			const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			return Object.assign({}, DEFAULT_SETTINGS, config);
		} catch (error) {
			console.error('Error loading config.json:', error);
			return DEFAULT_SETTINGS;
		}
	}
	return DEFAULT_SETTINGS;
}

// Save settings to config file
function saveSettings(settings) {
	const configPath = path.join(__dirname, 'config.json');
	try {
		fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf8');
	} catch (error) {
		console.error('Error saving config.json:', error);
	}
}

function getDefaultAuthPath() {
	const platform = os.platform();
	if (platform === 'win32') {
		return 'AppData/Roaming/Granola/supabase.json';
	} else if (platform === 'linux') {
		return '.config/Granola/supabase.json';
	} else {
		// macOS
		return 'Library/Application Support/Granola/supabase.json';
	}
}

class GranolaToAppleNotes {
	constructor() {
		this.settings = loadSettings();
		this.autoSyncInterval = null;
		this.documentToFolderMap = {};
		this.syncStatus = {
			isRunning: false,
			lastSyncTime: null,
			lastSyncCount: 0,
			lastError: null,
			currentProgress: { total: 0, processed: 0 }
		};
		this.shouldStopSync = false;
	}

	async loadCredentials() {
		const homedir = os.homedir();
		const authPaths = [
			// Current configured path
			path.resolve(homedir, this.settings.authKeyPath),
			// macOS fallback locations
			path.resolve(homedir, 'Library/Application Support/Granola/supabase.json'),
			path.resolve(homedir, 'Users', os.userInfo().username, 'Library/Application Support/Granola/supabase.json'),
		];

		for (const authPath of authPaths) {
			try {
				if (!fs.existsSync(authPath)) {
					continue;
				}

				const credentialsFile = fs.readFileSync(authPath, 'utf8');
				const data = JSON.parse(credentialsFile);
				
				let accessToken = null;
				
				// Try new token structure (workos_tokens)
				if (data.workos_tokens) {
					try {
						const workosTokens = JSON.parse(data.workos_tokens);
						accessToken = workosTokens.access_token;
					} catch (e) {
						// workos_tokens might already be an object
						accessToken = data.workos_tokens.access_token;
					}
				}
				
				// Fallback to old token structure (cognito_tokens)
				if (!accessToken && data.cognito_tokens) {
					try {
						const cognitoTokens = JSON.parse(data.cognito_tokens);
						accessToken = cognitoTokens.access_token;
					} catch (e) {
						// cognito_tokens might already be an object
						accessToken = data.cognito_tokens.access_token;
					}
				}
				
				if (accessToken) {
					console.log('Successfully loaded credentials from:', authPath);
					return accessToken;
				}
			} catch (error) {
				console.error('Error reading credentials from', authPath, ':', error);
				continue;
			}
		}

		console.error('No valid credentials found in any of the expected locations');
		return null;
	}

	async fetchGranolaDocuments(token, offset = 0, limit = 100) {
		try {
			const https = require('https');
			const zlib = require('zlib');
			
			const postData = JSON.stringify({
				limit: limit,
				offset: offset,
				include_last_viewed_panel: true
			});

			const options = {
				hostname: 'api.granola.ai',
				path: '/v2/get-documents',
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + token,
					'Content-Type': 'application/json',
					'Accept': '*/*',
					'User-Agent': 'Granola/5.354.0',
					'X-Client-Version': '5.354.0',
					'Content-Length': Buffer.byteLength(postData),
					'Accept-Encoding': 'gzip, deflate'
				}
			};

			return new Promise((resolve, reject) => {
				const req = https.request(options, (res) => {
					let chunks = [];
					
					// Handle compressed responses
					let stream = res;
					if (res.headers['content-encoding'] === 'gzip') {
						stream = zlib.createGunzip();
						res.pipe(stream);
					} else if (res.headers['content-encoding'] === 'deflate') {
						stream = zlib.createInflate();
						res.pipe(stream);
					}
					
					stream.on('data', (chunk) => {
						chunks.push(chunk);
					});
					
					stream.on('end', () => {
						try {
							const data = Buffer.concat(chunks).toString('utf8');
							const apiResponse = JSON.parse(data);
							if (!apiResponse || !apiResponse.docs) {
								console.error('API response format is unexpected');
								resolve(null);
							} else {
								resolve(apiResponse);
							}
						} catch (error) {
							console.error('Error parsing API response:', error);
							console.error('Response data preview:', Buffer.concat(chunks).toString('utf8').substring(0, 200));
							reject(error);
						}
					});
					
					stream.on('error', (error) => {
						console.error('Stream error:', error);
						reject(error);
					});
				});

				req.on('error', (error) => {
					console.error('Error fetching documents:', error);
					reject(error);
				});

				req.write(postData);
				req.end();
			});
		} catch (error) {
			console.error('Error fetching documents:', error);
			return null;
		}
	}

	async fetchAllGranolaDocuments(token) {
		const allDocuments = [];
		let offset = 0;
		const limit = 100;
		let hasMore = true;

		while (hasMore) {
			const response = await this.fetchGranolaDocuments(token, offset, limit);
			if (!response || !response.docs) {
				break;
			}

			const docs = response.docs;
			allDocuments.push(...docs);

			// If we got fewer than the limit, we've reached the end
			if (docs.length < limit) {
				hasMore = false;
			} else {
				offset += limit;
				console.log(`Fetched ${allDocuments.length} documents so far...`);
			}
		}

		return allDocuments;
	}

	async fetchGranolaFolders(token) {
		try {
			const https = require('https');
			const zlib = require('zlib');
			
			const postData = JSON.stringify({
				include_document_ids: true,
				include_only_joined_lists: false
			});

			const options = {
				hostname: 'api.granola.ai',
				path: '/v1/get-document-lists-metadata',
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + token,
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Content-Length': Buffer.byteLength(postData),
					'Accept-Encoding': 'gzip, deflate'
				}
			};

			return new Promise((resolve, reject) => {
				const req = https.request(options, (res) => {
					let chunks = [];
					
					// Handle compressed responses
					let stream = res;
					if (res.headers['content-encoding'] === 'gzip') {
						stream = zlib.createGunzip();
						res.pipe(stream);
					} else if (res.headers['content-encoding'] === 'deflate') {
						stream = zlib.createInflate();
						res.pipe(stream);
					}
					
					stream.on('data', (chunk) => {
						chunks.push(chunk);
					});
					
					stream.on('end', () => {
						try {
							const data = Buffer.concat(chunks).toString('utf8');
							const apiResponse = JSON.parse(data);
							if (!apiResponse || !apiResponse.lists) {
								console.error('Folders API response format is unexpected');
								resolve(null);
							} else {
								const folders = Object.values(apiResponse.lists);
								resolve(folders);
							}
						} catch (error) {
							console.error('Error parsing folders API response:', error);
							reject(error);
						}
					});
					
					stream.on('error', (error) => {
						console.error('Stream error:', error);
						reject(error);
					});
				});

				req.on('error', (error) => {
					console.error('Error fetching folders:', error);
					reject(error);
				});

				req.write(postData);
				req.end();
			});
		} catch (error) {
			console.error('Error fetching folders:', error);
			return null;
		}
	}

	async fetchTranscript(token, docId) {
		try {
			const https = require('https');
			const zlib = require('zlib');
			
			const postData = JSON.stringify({
				'document_id': docId
			});

			const options = {
				hostname: 'api.granola.ai',
				path: '/v1/get-document-transcript',
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + token,
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Content-Length': Buffer.byteLength(postData),
					'Accept-Encoding': 'gzip, deflate'
				}
			};

			return new Promise((resolve, reject) => {
				const req = https.request(options, (res) => {
					let chunks = [];
					
					// Handle compressed responses
					let stream = res;
					if (res.headers['content-encoding'] === 'gzip') {
						stream = zlib.createGunzip();
						res.pipe(stream);
					} else if (res.headers['content-encoding'] === 'deflate') {
						stream = zlib.createInflate();
						res.pipe(stream);
					}
					
					stream.on('data', (chunk) => {
						chunks.push(chunk);
					});
					
					stream.on('end', () => {
						try {
							const data = Buffer.concat(chunks).toString('utf8');
							const apiResponse = JSON.parse(data);
							resolve(apiResponse);
						} catch (error) {
							console.error('Error parsing transcript API response:', error);
							reject(error);
						}
					});
					
					stream.on('error', (error) => {
						console.error('Stream error:', error);
						reject(error);
					});
				});

				req.on('error', (error) => {
					console.error('Error fetching transcript for document ' + docId + ':', error);
					reject(error);
				});

				req.write(postData);
				req.end();
			});
		} catch (error) {
			console.error('Error fetching transcript:', error);
			return null;
		}
	}

	getSpeakerLabel(source) {
		switch (source) {
			case "microphone":
				return "Me";
			case "system":
			default:
				return "Them";
		}
	}

	formatTimestamp(timestamp) {
		const d = new Date(timestamp);
		return [d.getHours(), d.getMinutes(), d.getSeconds()]
			.map(v => String(v).padStart(2, '0'))
			.join(':');
	}

	transcriptToMarkdown(segments) {
		if (!segments || segments.length === 0) {
			return "*No transcript content available*";
		}

		const sortedSegments = segments.slice().sort((a, b) => {
			const timeA = new Date(a.start_timestamp || 0);
			const timeB = new Date(b.start_timestamp || 0);
			return timeA - timeB;
		});

		const lines = [];
		let currentSpeaker = null;
		let currentText = "";
		let currentTimestamp = null;

		const flushCurrentSegment = () => {
			const cleanText = currentText.trim().replace(/\s+/g, " ");
			if (cleanText && currentSpeaker) {
				const timeStr = this.formatTimestamp(currentTimestamp);
				const speakerLabel = this.getSpeakerLabel(currentSpeaker);
				lines.push(`**${speakerLabel}** *(${timeStr})*: ${cleanText}`)
			}
			currentText = "";
			currentSpeaker = null;
			currentTimestamp = null;
		};

		for (const segment of sortedSegments) {
			if (currentSpeaker && currentSpeaker !== segment.source) {
				flushCurrentSegment();
			}
			if (!currentSpeaker) {
				currentSpeaker = segment.source;
				currentTimestamp = segment.start_timestamp;
			}
			const segmentText = segment.text;
			if (segmentText && segmentText.trim()) {
				currentText += currentText ? ` ${segmentText}` : segmentText;
			}
		}
		flushCurrentSegment();

		return lines.length === 0 ? "*No transcript content available*" : lines.join("\n\n");
	}

	convertProseMirrorToMarkdown(content) {
		if (!content || typeof content !== 'object' || !content.content) {
			return '';
		}

		const processNode = (node, indentLevel = 0) => {
			if (!node || typeof node !== 'object') {
				return '';
			}

			const nodeType = node.type || '';
			const nodeContent = node.content || [];
			const text = node.text || '';

			if (nodeType === 'heading') {
				const level = node.attrs && node.attrs.level ? node.attrs.level : 1;
				const headingText = nodeContent.map(child => processNode(child, indentLevel)).join('');
				return '#'.repeat(level) + ' ' + headingText + '\n\n';
			} else if (nodeType === 'paragraph') {
				const paraText = nodeContent.map(child => processNode(child, indentLevel)).join('');
				// Preserve single newline for paragraphs (Apple Notes will render them)
				return paraText + '\n';
			} else if (nodeType === 'bulletList') {
				const items = [];
				for (let i = 0; i < nodeContent.length; i++) {
					const item = nodeContent[i];
					if (item.type === 'listItem') {
						const processedItem = this.processListItem(item, indentLevel);
						if (processedItem) {
							items.push(processedItem);
						}
					}
				}
				return items.join('\n') + '\n\n';
			} else if (nodeType === 'text') {
				return text;
			} else {
				return nodeContent.map(child => processNode(child, indentLevel)).join('');
			}
		};

		return processNode(content);
	}

	processListItem(listItem, indentLevel = 0) {
		if (!listItem || !listItem.content) {
			return '';
		}

		const indent = '  '.repeat(indentLevel);
		let itemText = '';
		let hasNestedLists = false;

		for (const child of listItem.content) {
			if (child.type === 'paragraph') {
				const paraText = (child.content || []).map(node => {
					if (node.type === 'text') {
						return node.text || '';
					}
					return '';
				}).join('').trim();
				if (paraText) {
					itemText += paraText;
				}
			} else if (child.type === 'bulletList') {
				hasNestedLists = true;
				const nestedItems = [];
				for (const nestedItem of child.content || []) {
					if (nestedItem.type === 'listItem') {
						const nestedProcessed = this.processListItem(nestedItem, indentLevel + 1);
						if (nestedProcessed) {
							nestedItems.push(nestedProcessed);
						}
					}
				}
				if (nestedItems.length > 0) {
					itemText += '\n' + nestedItems.join('\n');
				}
			}
		}

		if (!itemText.trim()) {
			return '';
		}

		const mainBullet = indent + '- ' + itemText.split('\n')[0];
		
		if (hasNestedLists) {
			const lines = itemText.split('\n');
			if (lines.length > 1) {
				const nestedLines = lines.slice(1).join('\n');
				return mainBullet + '\n' + nestedLines;
			}
		}

		return mainBullet;
	}

	formatDate(date, format) {
		if (!date) return '';
		
		const d = new Date(date);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		const seconds = String(d.getSeconds()).padStart(2, '0');
		
		return format
			.replace(/YYYY/g, year)
			.replace(/YY/g, String(year).slice(-2))
			.replace(/MM/g, month)
			.replace(/DD/g, day)
			.replace(/HH/g, hours)
			.replace(/mm/g, minutes)
			.replace(/ss/g, seconds);
	}

	generateNoteTitle(doc) {
		const title = doc.title || 'Untitled Granola Note';
		// Don't strip characters - use the full title as-is
		return title.trim();
	}

	generateFilename(doc) {
		const title = doc.title || 'Untitled Granola Note';
		const docId = doc.id || 'unknown_id';

		let createdDate = '';
		let updatedDate = '';
		let createdTime = '';
		let updatedTime = '';
		let createdDateTime = '';
		let updatedDateTime = '';

		if (doc.created_at) {
			createdDate = this.formatDate(doc.created_at, this.settings.dateFormat);
			createdTime = this.formatDate(doc.created_at, 'HH-mm-ss');
			createdDateTime = this.formatDate(doc.created_at, this.settings.dateFormat + '_HH-mm-ss');
		}

		if (doc.updated_at) {
			updatedDate = this.formatDate(doc.updated_at, this.settings.dateFormat);
			updatedTime = this.formatDate(doc.updated_at, 'HH-mm-ss');
			updatedDateTime = this.formatDate(doc.updated_at, this.settings.dateFormat + '_HH-mm-ss');
		}

		let filename = this.settings.filenameTemplate
			.replace(/{title}/g, title)
			.replace(/{id}/g, docId)
			.replace(/{created_date}/g, createdDate)
			.replace(/{updated_date}/g, updatedDate)
			.replace(/{created_time}/g, createdTime)
			.replace(/{updated_time}/g, updatedTime)
			.replace(/{created_datetime}/g, createdDateTime)
			.replace(/{updated_datetime}/g, updatedDateTime);

		if (this.settings.notePrefix) {
			filename = this.settings.notePrefix + filename;
		}

		const invalidChars = /[<>:"/\\|?*]/g;
		filename = filename.replace(invalidChars, '');
		filename = filename.replace(/\s+/g, '_');

		return filename;
	}

	extractAttendeeNames(doc) {
		const attendees = [];
		const processedEmails = new Set();
		
		try {
			if (doc.people && Array.isArray(doc.people)) {
				for (const person of doc.people) {
					let name = null;
					
					if (person.name) {
						name = person.name;
					} else if (person.display_name) {
						name = person.display_name;
					} else if (person.details && person.details.person && person.details.person.name) {
						const personDetails = person.details.person.name;
						if (personDetails.fullName) {
							name = personDetails.fullName;
						} else if (personDetails.givenName && personDetails.familyName) {
							name = `${personDetails.givenName} ${personDetails.familyName}`;
						} else if (personDetails.givenName) {
							name = personDetails.givenName;
						}
					} else if (person.email) {
						const emailName = person.email.split('@')[0].replace(/[._]/g, ' ');
						name = emailName;
					}
					
					if (name && !attendees.includes(name)) {
						attendees.push(name);
						if (person.email) {
							processedEmails.add(person.email);
						}
					}
				}
			}
			
			if (doc.google_calendar_event && doc.google_calendar_event.attendees) {
				for (const attendee of doc.google_calendar_event.attendees) {
					if (attendee.email && processedEmails.has(attendee.email)) {
						continue;
					}
					
					if (attendee.displayName && !attendees.includes(attendee.displayName)) {
						attendees.push(attendee.displayName);
						if (attendee.email) {
							processedEmails.add(attendee.email);
						}
					} else if (attendee.email && !attendees.some(name => name.includes(attendee.email.split('@')[0]))) {
						const emailName = attendee.email.split('@')[0].replace(/[._]/g, ' ');
						attendees.push(emailName);
						processedEmails.add(attendee.email);
					}
				}
			}
			
			return attendees;
		} catch (error) {
			console.error('Error extracting attendee names:', error);
			return [];
		}
	}

	generateAttendeeTags(attendees) {
		if (!this.settings.includeAttendeeTags || !attendees || attendees.length === 0) {
			return [];
		}
		
		const tags = [];
		
		for (const attendee of attendees) {
			if (this.settings.excludeMyNameFromTags && this.settings.myName && 
				attendee.toLowerCase().trim() === this.settings.myName.toLowerCase().trim()) {
				continue;
			}
			
			let cleanName = attendee
				.replace(/[^\w\s-]/g, '')
				.trim()
				.replace(/\s+/g, '-')
				.toLowerCase();
			
			let tag = this.settings.attendeeTagTemplate.replace('{name}', cleanName);
			tag = tag.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
			
			if (tag && !tags.includes(tag)) {
				tags.push(tag);
			}
		}
		
		return tags;
	}

	extractFolderNames(doc) {
		const folderNames = [];
		
		try {
			if (this.settings.includeFolderTags && this.documentToFolderMap) {
				const folder = this.documentToFolderMap[doc.id];
				if (folder && folder.title) {
					folderNames.push(folder.title);
				}
			}
			
			return folderNames;
		} catch (error) {
			console.error('Error extracting folder names:', error);
			return [];
		}
	}

	generateFolderTags(folderNames) {
		if (!this.settings.includeFolderTags || !folderNames || folderNames.length === 0) {
			return [];
		}
		
		try {
			const tags = [];
			
			for (const folderName of folderNames) {
				if (!folderName) continue;
				
				let cleanName = folderName
					.replace(/[^\w\s-]/g, '')
					.trim()
					.replace(/\s+/g, '-')
					.toLowerCase();
				
				let tag = this.settings.folderTagTemplate.replace('{name}', cleanName);
				tag = tag.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
				
				if (tag && !tags.includes(tag)) {
					tags.push(tag);
				}
			}
			
			return tags;
		} catch (error) {
			console.error('Error generating folder tags:', error);
			return [];
		}
	}

	generateGranolaUrl(docId) {
		if (!this.settings.includeGranolaUrl || !docId) {
			return null;
		}
		
		try {
			return `https://notes.granola.ai/d/${docId}`;
		} catch (error) {
			console.error('Error generating Granola URL:', error);
			return null;
		}
	}

	convertMarkdownToAppleNotes(markdown) {
		if (!markdown) return '';
		
		let formatted = markdown;
		
		// Convert markdown headings to plain text with spacing
		formatted = formatted.replace(/^### (.*$)/gim, '\n$1\n'); // H3
		formatted = formatted.replace(/^## (.*$)/gim, '\n$1\n'); // H2
		formatted = formatted.replace(/^# (.*$)/gim, '\n$1\n'); // H1
		
		// Convert bold **text** to plain text
		formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
		
		// Convert italic *text* to plain text
		formatted = formatted.replace(/\*(.*?)\*/g, '$1');
		
		// Clean up any remaining markdown artifacts
		formatted = formatted.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
		formatted = formatted.replace(/`([^`]+)`/g, '$1'); // Remove inline code
		
		// Preserve line breaks - ensure single newlines are preserved
		// Apple Notes needs explicit newlines, so we'll keep them as-is
		// Normalize multiple consecutive newlines to max 2
		formatted = formatted.replace(/\n{3,}/g, '\n\n');
		
		return formatted;
	}

	// Create or update note in Apple Notes using AppleScript
	async createOrUpdateAppleNote(doc, content) {
		// Use the inline AppleScript method directly (more reliable than file-based approach)
		return await this.createOrUpdateAppleNoteFallback(doc, content);
	}

	// Delete all notes in the Granola folder
	async deleteAllNotesInFolder() {
		try {
			const escapedAccount = this.settings.appleNotesAccount
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedFolder = (this.settings.appleNotesFolder || '')
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');

			// Use a simpler, more direct approach
			const script = `
				tell application "Notes"
					activate
					set targetAccount to account "${escapedAccount}"
					
					-- Get target folder
					if "${escapedFolder}" is not "" then
						try
							set targetFolder to folder "${escapedFolder}" of targetAccount
						on error errMsg
							return "ERROR: Folder not found"
						end try
					else
						set targetFolder to targetAccount
					end if
					
					-- Get initial count
					set initialCount to count of notes of targetFolder
					
					-- Keep deleting until no notes remain
					repeat
						set allNotes to notes of targetFolder
						set noteCount to count of allNotes
						if noteCount is 0 then exit repeat
						
						-- Delete the first note (simpler than reverse iteration)
						try
							delete item 1 of allNotes
						on error
							-- If deletion fails, try next approach
							exit repeat
						end try
					end repeat
					
					return initialCount
				end tell
			`;

			console.log(`Executing delete script for folder "${this.settings.appleNotesFolder || 'root'}" in account "${this.settings.appleNotesAccount}"...`);
			
			// Write script to temp file to avoid escaping issues - use absolute path
			const tempScriptFile = path.join(__dirname, '.temp-delete-script.applescript');
			const absoluteScriptPath = path.resolve(tempScriptFile);
			fs.writeFileSync(absoluteScriptPath, script, 'utf8');
			
			try {
				// Use absolute path and ensure it's properly quoted
				const result = execSync(`osascript "${absoluteScriptPath}"`, { 
					encoding: 'utf8',
					timeout: 30000,
					stdio: 'pipe',
					cwd: __dirname
				});

				const output = result.toString().trim();
				console.log('Delete script output:', output);
				
				// Check if there was an error message
				if (output.startsWith('ERROR:')) {
					console.warn(output);
					return 0;
				}
				
				const deletedCount = parseInt(output) || 0;
				if (deletedCount > 0) {
					console.log(`✓ Successfully deleted ${deletedCount} existing notes from Granola folder`);
				} else {
					console.log(`✓ No notes found to delete in Granola folder (folder is empty)`);
				}
				return deletedCount;
			} catch (error) {
				console.error('Error executing delete script:', error.message);
				// Try to read the script file to debug
				if (fs.existsSync(absoluteScriptPath)) {
					const scriptContent = fs.readFileSync(absoluteScriptPath, 'utf8');
					console.error('Script content length:', scriptContent.length);
				}
				return 0;
			} finally {
				// Clean up temp script file
				try {
					if (fs.existsSync(absoluteScriptPath)) {
						fs.unlinkSync(absoluteScriptPath);
					}
				} catch (e) {
					// Ignore cleanup errors
				}
			}
		} catch (error) {
			console.error('Error deleting notes:', error.message);
			console.error('Error details:', error);
			return 0;
		}
	}

	// Save markdown file for later bulk import
	async saveMarkdownFile(doc, content) {
		try {
			const title = doc.title || 'Untitled Granola Note';
			// Sanitize filename
			const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
			const tempFile = path.join(__dirname, `.temp-${sanitizedTitle}-${doc.id}.md`);
			// Normalize line endings and ensure proper formatting
			const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
			fs.writeFileSync(tempFile, normalizedContent, 'utf8');
			return { file: tempFile, doc: doc };
		} catch (error) {
			console.error('Error saving markdown file:', error);
			return null;
		}
	}

	// Import all markdown files in bulk by creating notes directly
	// This is more reliable than using the import dialog
	async importMarkdownFilesBulk(markdownFiles) {
		if (!markdownFiles || markdownFiles.length === 0) {
			return 0;
		}

		try {
			const escapedAccount = this.settings.appleNotesAccount
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedFolder = (this.settings.appleNotesFolder || '')
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');

			let importedCount = 0;
			
			console.log(`Starting bulk import of ${markdownFiles.length} files...`);
			
			for (let i = 0; i < markdownFiles.length; i++) {
				// Check if sync should be stopped
				if (this.shouldStopSync) {
					console.log('Sync stopped by user during import');
					this.syncStatus.isRunning = false;
					this.syncStatus.lastError = 'Sync stopped by user';
					return importedCount;
				}
				
				const mf = markdownFiles[i];
				const filePath = mf.file.replace(/\\/g, '/');
				const fileName = path.basename(filePath);
				const doc = mf.doc;
				const title = doc.title || 'Untitled Granola Note';
				const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				const escapedGranolaId = doc.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				
				console.log(`Importing ${i + 1}/${markdownFiles.length}: ${fileName}`);
				
				try {
					// Read the markdown file content
					let content = fs.readFileSync(filePath, 'utf8');
					
					// Normalize line endings to ensure consistent newlines
					content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
					
					// Create note directly using AppleScript - simpler and more reliable
					const title = doc.title || 'Untitled Granola Note';
					const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
					
					// Write content to temp file for AppleScript to read
					const contentTempFile = path.join(__dirname, `.temp-content-${i}.txt`);
					fs.writeFileSync(contentTempFile, content, 'utf8');
					const contentTempFilePath = contentTempFile.replace(/\\/g, '/');
					
					const script = `
						-- Read content and convert newlines properly
						set contentFile to POSIX file "${contentTempFilePath}"
						set rawContent to read file contentFile as «class utf8»
						
						-- Convert Unix newlines (\\n) to AppleScript return characters
						set AppleScript's text item delimiters to ASCII character 10
						set contentLines to text items of rawContent
						set AppleScript's text item delimiters to return
						set noteContent to contentLines as string
						set AppleScript's text item delimiters to ""
						
						tell application "Notes"
							activate
							set targetAccount to account "${escapedAccount}"
							
							if "${escapedFolder}" is not "" then
								try
									set targetFolder to folder "${escapedFolder}" of targetAccount
								on error
									set targetFolder to make new folder at targetAccount with properties {name:"${escapedFolder}"}
								end try
							else
								set targetFolder to targetAccount
							end if
							
							-- Create note with name first, then set body
							set newNote to make new note at targetFolder with properties {name:"${escapedTitle}"}
							delay 0.1
							set body of newNote to noteContent
							delay 0.1
							set name of newNote to "${escapedTitle}"
						end tell
					`;
					
					// Write script to temp file
					const scriptFile = path.join(__dirname, `.temp-create-${i}.applescript`);
					fs.writeFileSync(scriptFile, script, 'utf8');
					
					try {
						execSync(`osascript "${scriptFile}"`, { 
							encoding: 'utf8',
							timeout: 15000,
							stdio: 'pipe'
						});
						
						importedCount++;
						console.log(`  ✓ Successfully imported ${fileName}`);
					} finally {
						// Clean up temp files
						try {
							if (fs.existsSync(scriptFile)) fs.unlinkSync(scriptFile);
							if (fs.existsSync(contentTempFile)) fs.unlinkSync(contentTempFile);
						} catch (e) {
							// Ignore cleanup errors
						}
					}
				} catch (error) {
					console.error(`  ✗ Error importing file ${fileName}:`, error.message);
					// Continue with next file
				}
			}

			// Clean up all temp files
			for (const mf of markdownFiles) {
				try {
					if (fs.existsSync(mf.file)) {
						fs.unlinkSync(mf.file);
					}
				} catch (cleanupError) {
					console.warn('Could not delete temp file:', mf.file);
				}
			}

			// Find imported notes and set their titles
			await this.setImportedNoteTitles(markdownFiles);

			return importedCount;
		} catch (error) {
			console.error('Error importing markdown files:', error);
			// Clean up temp files on error
			for (const mf of markdownFiles) {
				try {
					if (fs.existsSync(mf.file)) {
						fs.unlinkSync(mf.file);
					}
				} catch (cleanupError) {
					// Ignore cleanup errors
				}
			}
			return 0;
		}
	}

	// Set titles for imported notes
	async setImportedNoteTitles(markdownFiles) {
		try {
			const escapedAccount = this.settings.appleNotesAccount
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedFolder = (this.settings.appleNotesFolder || '')
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');

			// Build script to set titles for all imported notes
			let titleUpdates = '';
			for (const mf of markdownFiles) {
				const doc = mf.doc;
				const title = doc.title || 'Untitled Granola Note';
				const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				const escapedGranolaId = doc.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				
				titleUpdates += `
					-- Set title for note with granola_id: ${escapedGranolaId}
					repeat with aNote in notes of targetFolder
						try
							set noteBody to body of aNote
							if noteBody contains "granola_id: ${escapedGranolaId}" then
								set name of aNote to "${escapedTitle}"
								exit repeat
							end if
						end try
					end repeat
				`;
			}

			const script = `
				tell application "Notes"
					set targetAccount to account "${escapedAccount}"
					
					if "${escapedFolder}" is not "" then
						try
							set targetFolder to folder "${escapedFolder}" of targetAccount
						on error
							set targetFolder to targetAccount
						end try
					else
						set targetFolder to targetAccount
					end if
					
					${titleUpdates}
				end tell
			`;

			execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { 
				encoding: 'utf8',
				timeout: 30000,
				stdio: 'inherit'
			});
		} catch (error) {
			console.error('Error setting imported note titles:', error);
		}
	}

	// Method using Apple Notes' Import Markdown functionality (legacy - kept for reference)
	async createOrUpdateAppleNoteFallback(doc, content) {
		try {
			// Save content as markdown file - use title as filename for better organization
			const title = doc.title || 'Untitled Granola Note';
			// Sanitize filename
			const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
			const tempFile = path.join(__dirname, `.temp-${sanitizedTitle}-${doc.id}.md`);
			// Normalize line endings and ensure proper formatting
			const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
			fs.writeFileSync(tempFile, normalizedContent, 'utf8');
			const escapedTitle = title
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedAccount = this.settings.appleNotesAccount
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedFolder = (this.settings.appleNotesFolder || '')
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const escapedGranolaId = doc.id
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			
			const tempFilePath = tempFile.replace(/\\/g, '/'); // Ensure forward slashes
			
			// Use Apple Notes' Import Markdown functionality via AppleScript
			// This should preserve titles better since it uses Apple Notes' native import
			const script = `
				set markdownFile to POSIX file "${tempFilePath}"
				
				tell application "Notes"
					activate
					set targetAccount to account "${escapedAccount}"
					
					-- Ensure target folder exists
					if "${escapedFolder}" is not "" then
						try
							set targetFolder to folder "${escapedFolder}" of targetAccount
						on error
							set targetFolder to make new folder at targetAccount with properties {name:"${escapedFolder}"}
						end try
					else
						set targetFolder to targetAccount
					end if
					
					-- Check if note already exists by granola_id
					set existingNote to missing value
					repeat with aNote in notes of targetFolder
						try
							set noteBody to body of aNote
							if noteBody contains "granola_id: ${escapedGranolaId}" then
								set existingNote to aNote
								exit repeat
							end if
						end try
					end repeat
					
					-- Delete existing note if found (we'll recreate via import)
					if existingNote is not missing value then
						delete existingNote
					end if
					
					-- Use Apple Notes' Import Markdown functionality
					-- Try using the 'open' command which should trigger import
					-- First, switch to the target folder
					set current view to targetFolder
					delay 0.2
					
					-- Use System Events to trigger the import menu
					tell application "System Events"
						tell process "Notes"
							set frontmost to true
							delay 0.3
							
							-- Use keyboard shortcut for Import to Notes (Cmd+Shift+I)
							keystroke "i" using {command down, shift down}
							delay 1
							
							-- In the file picker dialog, use Go to Folder (Cmd+Shift+G)
							keystroke "g" using {command down, shift down}
							delay 0.5
							
							-- Type the directory path (parent directory of the file)
							set fileDir to do shell script "dirname \"${tempFilePath}\""
							keystroke fileDir
							delay 0.3
							keystroke return
							delay 0.5
							
							-- Select the file (filename only)
							set fileName to do shell script "basename \"${tempFilePath}\""
							keystroke fileName
							delay 0.3
							keystroke return
							delay 2
						end tell
					end tell
					
					-- Wait for import to complete
					delay 1
					
					-- Find the newly imported note (should be the most recent one)
					-- Check notes in reverse order (newest first)
					set importedNote to missing value
					set allNotes to notes of targetFolder
					repeat with i from (count of allNotes) to 1 by -1
						set aNote to item i of allNotes
						try
							set noteBody to body of aNote
							if noteBody contains "granola_id: ${escapedGranolaId}" then
								set importedNote to aNote
								exit repeat
							end if
						end try
					end repeat
					
					-- If we found the imported note, ensure the title is correct
					if importedNote is not missing value then
						set name of importedNote to "${escapedTitle}"
					end if
				end tell
			`;
			
			execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { 
				encoding: 'utf8',
				timeout: 30000,
				stdio: 'inherit' // Show output for debugging
			});
			
			// Clean up temp markdown file after import
			try {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile);
				}
			} catch (cleanupError) {
				// Ignore cleanup errors
				console.warn('Could not delete temp file:', tempFile);
			}
			
			return true;
		} catch (error) {
			console.error('AppleScript failed:', error.message);
			// Clean up temp file on error
			const tempFile = path.join(__dirname, '.temp-note-content.txt');
			if (fs.existsSync(tempFile)) {
				try {
					fs.unlinkSync(tempFile);
				} catch (e) {
					// Ignore cleanup errors
				}
			}
			return false;
		}
	}

	async processDocument(doc) {
		try {
			const title = doc.title || 'Untitled Granola Note';
			const docId = doc.id || 'unknown_id';
			const transcript = doc.transcript || 'no_transcript';

			let contentToParse = null;
			if (doc.last_viewed_panel && doc.last_viewed_panel.content && doc.last_viewed_panel.content.type === 'doc') {
				contentToParse = doc.last_viewed_panel.content;
			}

			if (!contentToParse) {
				return false;
			}

			// Convert ProseMirror to Markdown
			const markdownContent = this.convertProseMirrorToMarkdown(contentToParse);
			
			// Extract metadata
			const attendeeNames = this.extractAttendeeNames(doc);
			const attendeeTags = this.generateAttendeeTags(attendeeNames);
			const folderNames = this.extractFolderNames(doc);
			const folderTags = this.generateFolderTags(folderNames);
			const granolaUrl = this.generateGranolaUrl(docId);
			
			// Combine all tags
			const allTags = [...attendeeTags, ...folderTags];

			// Build note content - put actual content FIRST to prevent Apple Notes from using metadata as title
			// Convert markdown to Apple Notes-friendly format
			const formattedContent = this.convertMarkdownToAppleNotes(markdownContent);
			
			let noteContent = '';
			
			// Put the EXACT title as the first line, then two newlines, then body
			// This structure: Title\n\nBody ensures title is clearly separated
			const exactTitle = title.trim(); // Ensure no extra whitespace
			noteContent += exactTitle;
			noteContent += '\n\n'; // Two newlines to separate title from body
			
			// Then add the actual content
			if (formattedContent.trim().length > 0) {
				noteContent += formattedContent.trim();
			}
			
			// Add spacing before metadata if there's content
			if (formattedContent.trim().length > 0) {
				noteContent += '\n\n';
			}
			
			// Add metadata at the bottom (after content)
			noteContent += '\n\n--- Granola Note ---\n';
			noteContent += `granola_id: ${docId}\n`;
			noteContent += `title: "${title.replace(/"/g, '\\"')}"\n`;
			
			if (granolaUrl) {
				noteContent += `granola_url: ${granolaUrl}\n`;
			}
			
			if (doc.created_at) {
				noteContent += `created_at: ${doc.created_at}\n`;
			}
			if (doc.updated_at) {
				noteContent += `updated_at: ${doc.updated_at}\n`;
			}
			
			if (allTags.length > 0) {
				noteContent += `tags: ${allTags.join(', ')}\n`;
			}
			
			noteContent += '---';
			
			// Add transcript section if enabled
			if (this.settings.includeFullTranscript && transcript !== 'no_transcript') {
				const formattedTranscript = this.convertMarkdownToAppleNotes(transcript);
				noteContent += '\n\n---\n\nTRANSCRIPT\n\n' + formattedTranscript;
			}

			// Save markdown file instead of importing immediately
			// We'll import all files in bulk later
			const markdownFile = await this.saveMarkdownFile(doc, noteContent);
			return markdownFile;

		} catch (error) {
			console.error('Error processing document:', error);
			return false;
		}
	}

	async syncNotes() {
		if (this.syncStatus.isRunning) {
			console.log('Sync already in progress');
			return;
		}
		
		try {
			this.syncStatus.isRunning = true;
			this.shouldStopSync = false;
			this.syncStatus.lastError = null;
			console.log('Starting Granola sync...');
			
			const token = await this.loadCredentials();
			if (!token) {
				console.error('Failed to load credentials');
				return;
			}

			const documents = await this.fetchAllGranolaDocuments(token);
			if (!documents || documents.length === 0) {
				console.error('Failed to fetch documents or no documents found');
				this.syncStatus.isRunning = false;
				this.syncStatus.lastError = 'No documents found';
				this.syncStatus.lastSyncCount = 0;
				return;
			}

			// Apply test mode limit if enabled
			let documentsToSync = documents;
			if (this.settings.testMode) {
				documentsToSync = documents.slice(0, this.settings.testModeLimit);
				console.log(`Test mode enabled: syncing only ${documentsToSync.length} of ${documents.length} documents`);
			}

			console.log(`Found ${documents.length} total documents, syncing ${documentsToSync.length}`);
			this.syncStatus.currentProgress.total = documentsToSync.length;
			this.syncStatus.currentProgress.processed = 0;

			// Fetch folders if folder support is enabled
			if (this.settings.includeFolderTags) {
				const folders = await this.fetchGranolaFolders(token);
				if (folders) {
					this.documentToFolderMap = {};
					for (const folder of folders) {
						if (folder.document_ids) {
							for (const docId of folder.document_ids) {
								this.documentToFolderMap[docId] = folder;
							}
						}
					}
				}
			}

			// Step 0: Delete all existing notes in the Granola folder for a fresh start
			console.log('Step 0: Deleting all existing notes in Granola folder...');
			await this.deleteAllNotesInFolder();
			
			// Step 1: Download and save all markdown files first
			console.log('Step 1: Downloading and saving markdown files...');
			const markdownFiles = [];
			
			for (let i = 0; i < documentsToSync.length; i++) {
				// Check if sync should be stopped
				if (this.shouldStopSync) {
					console.log('Sync stopped by user');
					this.syncStatus.isRunning = false;
					this.syncStatus.lastError = 'Sync stopped by user';
					return;
				}
				
				const doc = documentsToSync[i];
				try {
					// Fetch transcript if enabled
					if (this.settings.includeFullTranscript) {
						const transcriptData = await this.fetchTranscript(token, doc.id);
						doc.transcript = this.transcriptToMarkdown(transcriptData);
					}

					const markdownFile = await this.processDocument(doc);
					if (markdownFile) {
						markdownFiles.push(markdownFile);
					}
					
					this.syncStatus.currentProgress.processed = i + 1;
					console.log(`Downloaded ${i + 1}/${documentsToSync.length} notes...`);
				} catch (error) {
					console.error('Error processing document ' + doc.title + ':', error);
					this.syncStatus.lastError = error.message;
				}
			}
			
			// Check again before bulk import
			if (this.shouldStopSync) {
				console.log('Sync stopped by user before import');
				this.syncStatus.isRunning = false;
				this.syncStatus.lastError = 'Sync stopped by user';
				return;
			}

			// Step 2: Import all markdown files in bulk
			console.log(`Step 2: Importing ${markdownFiles.length} markdown files to Apple Notes...`);
			const syncedCount = await this.importMarkdownFilesBulk(markdownFiles);
			console.log(`Imported ${syncedCount} notes successfully.`);

			this.syncStatus.lastSyncTime = new Date().toISOString();
			this.syncStatus.lastSyncCount = syncedCount;
			this.syncStatus.isRunning = false;
			this.shouldStopSync = false;
			this.syncStatus.lastError = null;
			console.log(`Sync complete! ${syncedCount} notes synced.`);
			
		} catch (error) {
			console.error('Granola sync failed:', error);
			console.error('Error stack:', error.stack);
			this.syncStatus.isRunning = false;
			this.shouldStopSync = false;
			this.syncStatus.lastError = error.message || String(error);
			this.syncStatus.lastSyncCount = 0;
		}
	}

	getStatus() {
		return {
			...this.syncStatus,
			settings: this.settings
		};
	}

	stopSync() {
		this.clearAutoSync();
		this.shouldStopSync = true;
		this.syncStatus.isRunning = false;
		console.log('Sync stop requested');
	}

	setupAutoSync() {
		this.clearAutoSync();
		
		if (this.settings.autoSyncFrequency > 0) {
			console.log(`Auto-sync enabled: every ${this.settings.autoSyncFrequency / 1000} seconds`);
			this.autoSyncInterval = setInterval(() => {
				this.syncNotes();
			}, this.settings.autoSyncFrequency);
		}
	}

	clearAutoSync() {
		if (this.autoSyncInterval) {
			clearInterval(this.autoSyncInterval);
			this.autoSyncInterval = null;
		}
	}
}

// Main execution
if (require.main === module) {
	const sync = new GranolaToAppleNotes();
	
	// Check command line arguments
	const args = process.argv.slice(2);
	
	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Granola to Apple Notes Sync

Usage:
  node main.js [options]
  node ui-server.js    Start web UI server

Options:
  --sync, -s          Run a single sync now
  --auto-sync, -a     Start auto-sync (runs continuously)
  --ui, -u            Start web UI server
  --help, -h          Show this help message

Examples:
  node main.js --sync        # Sync once
  node main.js --auto-sync   # Start auto-sync
  node ui-server.js          # Start web UI
		`);
		process.exit(0);
	}
	
	if (args.includes('--ui') || args.includes('-u')) {
		// Start UI server
		require('./ui-server');
	} else if (args.includes('--auto-sync') || args.includes('-a')) {
		sync.setupAutoSync();
		// Keep process alive
		process.stdin.resume();
	} else {
		// Default: single sync
		sync.syncNotes().then(() => {
			process.exit(0);
		}).catch((error) => {
			console.error('Sync failed:', error);
			process.exit(1);
		});
	}
}

module.exports = GranolaToAppleNotes;
