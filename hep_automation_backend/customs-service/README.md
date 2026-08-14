# Customs Service
Microservice for Customs to APACS physical examination data integration.

## Run
```bash
npm install
npm run dev
```
Default port: `5011`

## Environment
Copy `.env.example` to `.env` and set:
- `PORT`
- `PG_HOST`
- `PG_PORT`
- `PG_USER`
- `PG_PASSWORD`
- `PG_DATABASE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `UPLOAD_DIR`
- `MAX_IMAGE_SIZE_MB`
- `MAX_IMAGES_PER_REQUEST`

## API Endpoints
### Authentication
- `POST /api/customs/login` - Login with loginId and password

### Examination Data
- `POST /api/customs/examination` - Submit physical examination data with images (requires authentication)