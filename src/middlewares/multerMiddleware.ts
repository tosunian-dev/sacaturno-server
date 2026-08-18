import { Request } from "express";
import multer, { memoryStorage } from "multer";

// Las imágenes van a Cloudinary, así que el archivo solo necesita vivir en
// memoria el tiempo que tarda el upload: el disco del contenedor es efímero.
const storage = memoryStorage();

const multerMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: any) => {
    if (
      file.mimetype == "image/png" ||
      file.mimetype == "image/jpg" ||
      file.mimetype == "image/jpeg" ||
      file.mimetype == "image/webp"
    ) {
      cb(null, true);
    } else {
      return cb(new Error("Invalid mime type"));
    }
  },
});

export default multerMiddleware;
