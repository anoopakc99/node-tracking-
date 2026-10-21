const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const photosDir = path.join(uploadDir, 'photos');
const profilesDir = path.join(uploadDir, 'profiles');
const thumbnailsDir = path.join(uploadDir, 'thumbnails');

[uploadDir, photosDir, profilesDir, thumbnailsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '') {
      if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else ext = '.jpg';
    }
    cb(null, `photo_${uuidv4()}${ext}`);
  }
});

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, profilesDir),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '') {
      if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else ext = '.jpg';
    }
    cb(null, `profile_${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMime = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/octet-stream'
  ];
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', ''];

  if (
    allowedMime.includes(file.mimetype) ||
    (file.mimetype && file.mimetype.startsWith('image/')) ||
    allowedExts.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  }
};

const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 }
});

const uploadProfile = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 2097152 }
});

module.exports = { uploadPhoto, uploadProfile, photosDir, profilesDir, thumbnailsDir };
