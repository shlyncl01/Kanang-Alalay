// middleware/imageUpload.js
//
// Multer config for resident/caregiver photo uploads. Keeps the file in
// memory (as a Buffer) instead of writing to local disk, since we stream
// it straight to Cloudinary. Validates file type and caps size at 5MB —
// keep this in sync with the 5MB check on the frontend.

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed.'), false);
    }
    cb(null, true);
};

const imageUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = imageUpload;