# APACS Face Verify & Biometric Identification Service

Standalone microservice providing:
1. **Pass Application Face Capture**: Remote link / local applicant capture with EXIF stripping and real-time SSE streaming.
2. **Passenger 1:N Biometric Identification**: YuNet face detection, 5-point affine alignment, and AuraFace-v1 (512-D ArcFace) matching against enrolled port identities.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v18+` or `v20+`
- **PostgreSQL**: (Required for pass capture sessions database; optional for standalone 1:N passenger identification)

### 2. Install Dependencies
```bash
cd hep_automation_backend/face_verify
npm install
```

### 3. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
PORT=5013
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=hep_automation
JWT_SECRET=your_jwt_secret_here
CAPTURE_BASE_URL=http://localhost:3000

# Optional: Path to local raw face images if you want live folder watching / auto-sync
# Note: The service works immediately without this using the pre-indexed gallery.
FACE_GALLERY_DIR=/path/to/your/face_images_folder
```

### 4. Start the Service
- **Development (with hot reload)**:
  ```bash
  npm run dev
  ```
- **Production**:
  ```bash
  npm start
  ```

---

## 🌐 Endpoints & UI

| URL | Description |
| :--- | :--- |
| `http://localhost:5013/passenger` | **Passenger Face Identification UI** (Camera / Upload / 1:N Match) |
| `http://localhost:5013/api/face/passenger/stats` | View biometric gallery count and model status |
| `POST /api/face/passenger/identify` | Multipart photo upload for 1:N identification |
| `POST /api/face/passenger/enroll` | Enroll a new identity (`photo`, `name`, `passNumber`) |
| `POST /api/face/sessions` | Create link for applicant remote capture session |

---

## 📁 Biometric Models & Pre-Indexed Gallery
The service bundles ONNX models and precomputed vector indices in `models/`:
- `models/auraface_v1.onnx` (512-D ArcFace feature extraction)
- `models/face_detection_yunet_2023mar.onnx` (YuNet landmark detection)
- `models/gallery_index_auraface.json` (Pre-indexed database of enrolled identities)
