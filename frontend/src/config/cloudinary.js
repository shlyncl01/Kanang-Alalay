// config/cloudinary.js
//
// Central Cloudinary configuration. Requires these env vars to be set
// (e.g. in your .env file):
//
//   CLOUDINARY_CLOUD_NAME=your-cloud-name
//   CLOUDINARY_API_KEY=your-api-key
//   CLOUDINARY_API_SECRET=your-api-secret
//
// Sign up at https://cloudinary.com — the free tier is plenty for
// resident profile photos.

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

module.exports = cloudinary;