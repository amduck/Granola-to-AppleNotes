const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const GranolaToAppleNotes = require('./main');

const PORT = 3000;
let syncInstance = null;

// Initialize sync instance
function getSyncInstance() {
	if (!syncInstance) {
		syncInstance = new GranolaToAppleNotes();
	}
	return syncInstance;
}

// Serve static files
function serveStaticFile(filePath, res) {
	const extname = String(path.extname(filePath)).toLowerCase();
	const mimeTypes = {
		'.html': 'text/html',
		'.js': 'text/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
		'.png': 'image/png',
		'.jpg': 'image/jpg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.wav': 'audio/wav',
		'.mp4': 'video/mp4',
		'.woff': 'application/font-woff',
		'.ttf': 'application/font-ttf',
		'.eot': 'application/vnd.ms-fontobject',
		'.otf': 'application/font-otf',
		'.wasm': 'application/wasm'
	};

	const contentType = mimeTypes[extname] || 'application/octet-stream';

	fs.readFile(filePath, (error, content) => {
		if (error) {
			if (error.code == 'ENOENT') {
				res.writeHead(404, { 'Content-Type': 'text/html' });
				res.end('<h1>404 - File Not Found</h1>', 'utf-8');
			} else {
				res.writeHead(500);
				res.end(`Server Error: ${error.code}`, 'utf-8');
			}
		} else {
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(content, 'utf-8');
		}
	});
}

// API routes
function handleAPI(req, res) {
	const parsedUrl = url.parse(req.url, true);
	const pathname = parsedUrl.pathname;
	const sync = getSyncInstance();
	
	// Debug logging
	console.log(`API Request: ${req.method} ${pathname}`);

	// Set CORS headers
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}

	if (pathname === '/api/status') {
		const status = sync.getStatus();
		res.writeHead(200);
		res.end(JSON.stringify(status));
	} else if (pathname === '/api/start' && req.method === 'POST') {
		// Don't wait for sync to complete - return immediately
		// The sync runs in the background and status will update via polling
		sync.syncNotes().catch((error) => {
			console.error('Sync error:', error);
			console.error('Error stack:', error.stack);
			// Update status with error
			sync.syncStatus.isRunning = false;
			sync.syncStatus.lastError = error.message || String(error);
		});
		// Return success immediately
		res.writeHead(200);
		res.end(JSON.stringify({ success: true, message: 'Sync started' }));
	} else if (pathname === '/api/stop' && req.method === 'POST') {
		sync.stopSync();
		res.writeHead(200);
		res.end(JSON.stringify({ success: true, message: 'Sync stopped' }));
	} else if (pathname === '/api/config' && req.method === 'GET') {
		res.writeHead(200);
		res.end(JSON.stringify(sync.settings));
	} else if (pathname === '/api/config' && req.method === 'POST') {
		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});
		req.on('end', () => {
			try {
				const newConfig = JSON.parse(body);
				// Update settings in sync instance
				sync.settings = Object.assign({}, sync.settings, newConfig);
				// Save to file
				const configPath = path.join(__dirname, 'config.json');
				fs.writeFileSync(configPath, JSON.stringify(sync.settings, null, 2), 'utf8');
				console.log(`Config updated: ${JSON.stringify(newConfig)}`);
				res.writeHead(200);
				res.end(JSON.stringify({ success: true, message: 'Config updated', settings: sync.settings }));
			} catch (error) {
				console.error('Error updating config:', error);
				res.writeHead(400);
				res.end(JSON.stringify({ success: false, error: error.message }));
			}
		});
	} else if (pathname === '/api/delete-notes' && req.method === 'POST') {
		if (!sync.deleteAllNotesInFolder) {
			res.writeHead(500);
			res.end(JSON.stringify({ success: false, error: 'deleteAllNotesInFolder method not found' }));
			return;
		}
		sync.deleteAllNotesInFolder().then((deletedCount) => {
			res.writeHead(200);
			res.end(JSON.stringify({ 
				success: true, 
				message: `Deleted ${deletedCount} notes from Granola folder`,
				deletedCount: deletedCount
			}));
		}).catch((error) => {
			console.error('Error deleting notes:', error);
			res.writeHead(500);
			res.end(JSON.stringify({ success: false, error: error.message }));
		});
	} else {
		console.log(`404: ${req.method} ${pathname}`);
		res.writeHead(404);
		res.end(JSON.stringify({ error: 'Not found', path: pathname, method: req.method }));
	}
}

// Create server
const server = http.createServer((req, res) => {
	const parsedUrl = url.parse(req.url, true);
	const pathname = parsedUrl.pathname;

	if (pathname.startsWith('/api/')) {
		handleAPI(req, res);
	} else if (pathname === '/' || pathname === '/index.html') {
		serveStaticFile(path.join(__dirname, 'ui.html'), res);
	} else {
		serveStaticFile(path.join(__dirname, pathname), res);
	}
});

server.listen(PORT, () => {
	console.log(`\n🌐 Granola to Apple Notes UI Server`);
	console.log(`   Server running at http://localhost:${PORT}`);
	console.log(`   Open this URL in your browser to access the UI\n`);
}).on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`\n❌ Error: Port ${PORT} is already in use`);
		console.error(`   Another instance of the UI server may be running.`);
		console.error(`   To fix this:`);
		console.error(`   1. Kill the existing process: lsof -ti:${PORT} | xargs kill -9`);
		console.error(`   2. Or use a different port: PORT=3001 node ui-server.js\n`);
		process.exit(1);
	} else {
		console.error(`\n❌ Error starting server:`, err);
		process.exit(1);
	}
});

