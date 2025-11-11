-- AppleScript to create or update a note in Apple Notes
-- This script reads metadata from a JSON file and creates/updates the note accordingly

on run argv
	set metadataFile to item 1 of argv
	
	try
		-- Read the metadata JSON file (convert to POSIX file)
		set metadataFilePosix to POSIX file metadataFile
		set metadataContent to read file metadataFilePosix as «class utf8»
		
		-- Extract JSON values using text parsing
		set noteTitle to extractStringValue(metadataContent, "title")
		set noteContent to extractStringValue(metadataContent, "content")
		set noteAccount to extractStringValue(metadataContent, "account")
		set noteFolder to extractStringValue(metadataContent, "folder")
		set granolaId to extractStringValue(metadataContent, "granolaId")
		
		tell application "Notes"
			activate
			
			-- Find the account
			set targetAccount to account noteAccount
			
			-- Find or create the folder if specified
			if noteFolder is not "" then
				try
					set targetFolder to folder noteFolder of targetAccount
				on error
					set targetFolder to make new folder at targetAccount with properties {name:noteFolder}
				end try
			else
				set targetFolder to targetAccount
			end if
			
			-- Check if note with this Granola ID already exists
			set existingNote to missing value
			repeat with aNote in notes of targetFolder
				try
					set noteBody to body of aNote
					if noteBody contains "granola_id: " & granolaId then
						set existingNote to aNote
						exit repeat
					end if
				end try
			end repeat
			
			-- Create or update note
			if existingNote is not missing value then
				-- Update existing note
				set name of existingNote to noteTitle
				set body of existingNote to noteContent
			else
				-- Create new note
				make new note at targetFolder with properties {name:noteTitle, body:noteContent}
			end if
		end tell
		
		return true
	on error errMsg
		return "Error: " & errMsg
	end try
end run

on extractStringValue(jsonContent, keyName)
	try
		-- Find the key in the JSON
		set keyPattern to "\"" & keyName & "\""
		set keyPos to offset of keyPattern in jsonContent
		
		if keyPos = 0 then
			return ""
		end if
		
		-- Find the colon after the key
		set afterKey to text (keyPos + (length of keyPattern)) thru -1 of jsonContent
		set colonPos to offset of ":" in afterKey
		
		if colonPos = 0 then
			return ""
		end if
		
		-- Find the opening quote
		set afterColon to text (colonPos + 1) thru -1 of afterKey
		set quotePos to offset of "\"" in afterColon
		
		if quotePos = 0 then
			return ""
		end if
		
		-- Extract the value between quotes
		set afterQuote to text (quotePos + 1) thru -1 of afterColon
		
		-- Handle escaped quotes and find the closing quote
		set valueText to ""
		set i to 1
		repeat while i ≤ (length of afterQuote)
			set currentChar to text i thru i of afterQuote
			if currentChar is "\"" then
				-- Check if it's escaped
				if i > 1 then
					set prevChar to text (i - 1) thru (i - 1) of afterQuote
					if prevChar is not "\\" then
						exit repeat
					end if
				else
					exit repeat
				end if
			end if
			set valueText to valueText & currentChar
			set i to i + 1
		end repeat
		
		-- Unescape common escape sequences
		set valueText to replaceText(valueText, "\\n", return)
		set valueText to replaceText(valueText, "\\t", tab)
		set valueText to replaceText(valueText, "\\\"", "\"")
		set valueText to replaceText(valueText, "\\\\", "\\")
		
		return valueText
	on error
		return ""
	end try
end extractStringValue

on replaceText(sourceText, findText, replaceText)
	set AppleScript's text item delimiters to findText
	set textItems to text items of sourceText
	set AppleScript's text item delimiters to replaceText
	set resultText to textItems as string
	set AppleScript's text item delimiters to ""
	return resultText
end replaceText

