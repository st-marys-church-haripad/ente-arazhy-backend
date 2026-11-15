const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const isCloudFunction = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET);

// Cloud Functions only allows writing to the temp directory (files there are NOT permanent)
const uploadsDir = isCloudFunction
    ? path.join(os.tmpdir(), 'uploads', 'family-photos')
    : path.join(__dirname, '../../uploads/family-photos');

// Ensure uploads directory exists
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (err) {
    console.error('Could not create uploads directory:', err.message);
}

// Extension comes from the validated mime type, never from the client's filename
const EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = EXTENSIONS[file.mimetype] || '';
        const name = path
            .basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 40) || 'photo';
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed');
        error.statusCode = 400;
        cb(error, false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

module.exports = upload;