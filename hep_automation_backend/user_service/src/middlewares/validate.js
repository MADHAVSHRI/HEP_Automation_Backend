const fs = require("fs");

function removeUploadedFiles(req) {
  const uploadedFiles = [];

  if (req.file) {
    uploadedFiles.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      uploadedFiles.push(...req.files);
    } else {
      for (
        const files of Object.values(
          req.files
        )
      ) {
        uploadedFiles.push(...files);
      }
    }
  }

  for (const file of uploadedFiles) {
    if (!file?.path) continue;

    fs.unlink(
      file.path,
      (error) => {
        if (
          error &&
          error.code !== "ENOENT"
        ) {
          console.error(
            "Validation upload cleanup error:",
            error
          );
        }
      }
    );
  }
}

const validate = (schema) => {
  return (req, res, next) => {
    const result =
      schema.safeParse(req.body);

    if (!result.success) {
      removeUploadedFiles(req);

      return res.status(400).json({
        success: false,
        message:
          result.error.issues[0]?.message ||
          "Validation failed.",
        errors:
          result.error.flatten(),
      });
    }

    req.body = result.data;
    next();
  };
};

module.exports = validate;