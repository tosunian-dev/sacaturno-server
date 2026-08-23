import { Request, Response, NextFunction } from "express";
import multer, { memoryStorage, MulterError } from "multer";

// Las imágenes van a Cloudinary, así que el archivo solo necesita vivir en
// memoria el tiempo que tarda el upload: el disco del contenedor es efímero.
const storage = memoryStorage();

const ALLOWED_MIME = ["image/png", "image/jpg", "image/jpeg", "image/webp"];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  // Primer filtro, barato y pre-buffer. OJO: el mimetype lo declara el cliente,
  // así que es spoofeable — es solo una primera barrera. La validación real
  // (magic bytes) va después, cuando ya tenemos el archivo completo en memoria.
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_MIME_TYPE"));
    }
  },
});

// Magic numbers: los primeros bytes de un archivo delatan su tipo real, sin
// importar el mimetype declarado ni la extensión. Un .exe renombrado a .png con
// Content-Type: image/png no tiene esta firma y se rechaza.
const isRealImage = (buf?: Buffer): boolean => {
  if (!buf || buf.length < 12) return false;
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // WebP: "RIFF" (0-3) .... "WEBP" (8-11)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return true;
  }
  return false;
};

// Middleware combinado que reemplaza a `multerMiddleware.single(...)` en las
// rutas: corre multer, traduce sus errores a 400 limpios (en vez del 500 de
// Express) y valida los magic bytes del archivo realmente recibido.
const uploadProfileImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single("profile_image")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const error = err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR";
      res.status(400).send({ error });
      return;
    }
    if (err) {
      // Error lanzado por el fileFilter (mimetype declarado no permitido).
      res.status(400).send({ error: "INVALID_MIME_TYPE" });
      return;
    }
    if (!req.file) {
      res.status(400).send({ error: "NO_FILE" });
      return;
    }
    if (!isRealImage(req.file.buffer)) {
      // El mimetype decía imagen pero el contenido real no lo es.
      res.status(400).send({ error: "INVALID_IMAGE_CONTENT" });
      return;
    }
    next();
  });
};

export { uploadProfileImage };
export default upload;
