const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { SUPPORTED_IMAGE_MIMES, SUPPORTED_IMAGE_EXTENSIONS } = require("../constants/constants");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/customs_examinations";
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || "10", 10);
const MAX_IMAGES_PER_REQUEST = parseInt(process.env.MAX_IMAGES_PER_REQUEST || "20", 10);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const generateTimestamp = () => {
  const now = new Date();
  const DD = String(now.getDate()).padStart(2, "0");
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const YYYY = String(now.getFullYear());
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
};

const sanitizeContainerNumber = (containerNumber) => {
  return containerNumber ? containerNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : "CONTAINER";
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const containerNumber = sanitizeContainerNumber(req.body.containerNumber);
    const timestamp = generateTimestamp();
    const extension = path.extname(file.originalname).toLowerCase();
    
    const fileName = `CUSTOMS_${containerNumber}_${timestamp}_${file.fieldname}${extension}`;
    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (!SUPPORTED_IMAGE_MIMES.includes(file.mimetype) || !SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
    return cb(new Error(`Invalid image type. Only ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")} files are allowed`));
  }
  
  cb(null, true);
};

// Magic byte validation for image files
const validateImageMagicBytes = (filePath) => {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    
    // JPEG magic bytes: FF D8 FF
    const jpegMagic = Buffer.from([0xFF, 0xD8, 0xFF]);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    return (
      buf.subarray(0, jpegMagic.length).equals(jpegMagic) ||
      buf.subarray(0, pngMagic.length).equals(pngMagic)
    );
  } catch (error) {
    return false;
  }
};

const validateUploadedImages = (req, res, next) => {
  const uploadedFiles = req.files || [];
  
  if (uploadedFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one image is required",
    });
  }
  
  const invalidFiles = [];
  
  for (const file of uploadedFiles) {
    if (!validateImageMagicBytes(file.path)) {
      invalidFiles.push(file);
    }
  }
  
  if (invalidFiles.length > 0) {
    // Delete invalid files
    for (const file of invalidFiles) {
      try { 
        fs.unlinkSync(file.path); 
      } catch { 
        /* ignore */ 
      }
    }
    
    return res.status(400).json({
      success: false,
      message: `Invalid image content detected in ${invalidFiles.length} file(s). Images must be genuine JPEG or PNG files.`,
    });
  }
  
  next();
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024, // Convert MB to bytes
    files: MAX_IMAGES_PER_REQUEST,
  },
});

const handleImageUpload = (req, res, next) => {
  upload.array("images", MAX_IMAGES_PER_REQUEST)(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: `Image size exceeds ${MAX_IMAGE_SIZE_MB}MB limit`,
          });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            message: `Maximum ${MAX_IMAGES_PER_REQUEST} images allowed`,
          });
        }
      }
      
      return res.status(400).json({
        success: false,
        message: error.message || "Image upload failed",
      });
    }
    
    next();
  });
};

module.exports = { handleImageUpload, validateUploadedImages };