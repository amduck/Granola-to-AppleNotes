
						set contentFile to POSIX file "/Users/duck/Granola2AppleNotes/Granola-to-AppleNotes/.temp-content-53.txt"
						set noteContent to read file contentFile as «class utf8»
						
						tell application "Notes"
							activate
							set targetAccount to account "iCloud"
							
							if "Granola" is not "" then
								try
									set targetFolder to folder "Granola" of targetAccount
								on error
									set targetFolder to make new folder at targetAccount with properties {name:"Granola"}
								end try
							else
								set targetFolder to targetAccount
							end if
							
							-- Create note with name first, then set body
							set newNote to make new note at targetFolder with properties {name:"orla 1:1"}
							delay 0.1
							set body of newNote to noteContent
							delay 0.1
							set name of newNote to "orla 1:1"
						end tell
					