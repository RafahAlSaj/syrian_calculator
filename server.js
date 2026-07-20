const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from 'www' first
app.use(express.static(path.join(__dirname, 'www')));

// Fallback to serving static files from the root directory for any missing assets (like manifest, icons, etc.)
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
