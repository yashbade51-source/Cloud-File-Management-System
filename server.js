const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises; 
const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(express.json()); 

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniquePrefix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const secureFilePath = (filename) => {
    if (!filename || typeof filename !== 'string') {
        throw new Error('Invalid filename provided.');
    }
    const resolvedPath = path.join(UPLOADS_DIR, filename);
    if (!resolvedPath.startsWith(UPLOADS_DIR)) {
        throw new Error('Attempted to access a restricted path.');
    }
    return resolvedPath;
};


app.get('/files', async (req, res) => {
    try {
        const files = await fsp.readdir(UPLOADS_DIR);
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(UPLOADS_DIR, file);
                const stats = await fsp.stat(filePath);
                return {
                    name: file,
                    size: stats.size, 
                    lastModified: stats.mtime,
                };
            })
        );
        res.json(fileDetails);
    } catch (err) {
        console.error("Error reading files directory:", err);
        res.status(500).json({ success: false, message: 'Could not retrieve files.' });
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file was uploaded.' });
    }
    res.json({ success: true, message: `File '${req.file.originalname}' uploaded successfully.` });
});

app.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = secureFilePath(filename);
        res.download(filePath, filename, (err) => {
            if (err && !res.headersSent) {
                res.status(404).json({ success: false, message: 'File not found.' });
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = secureFilePath(filename);
        await fsp.unlink(filePath);
        res.json({ success: true, message: `File '${filename}' deleted successfully.` });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(error.code === 'ENOENT' ? 404 : 500).json({ success: false, message: error.message || 'Error deleting file.' });
    }
});


app.put('/files/:oldname', async (req, res) => {
    try {
        const oldName = req.params.oldname;
        const { newName } = req.body;

        if (!newName) {
            return res.status(400).json({ success: false, message: 'New filename not provided.' });
        }

        const oldPath = secureFilePath(oldName);
        const newPath = secureFilePath(newName);

        await fsp.rename(oldPath, newPath);
        res.json({ success: true, message: `File renamed to '${newName}'.` });
    } catch (error) {
        console.error("Error renaming file:", error);
        res.status(error.code === 'ENOENT' ? 404 : 500).json({ success: false, message: error.message || 'Error renaming file.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});