import { Request } from "express";
import multer, { diskStorage } from "multer";

const PATH_STORAGE = `${process.cwd()}/profile_images`;
console.log(PATH_STORAGE);


const storage = diskStorage({
  destination(req: Request, file: Express.Multer.File, cb: any) {
    cb(null, PATH_STORAGE);
  },
  filename(req: Request, file: Express.Multer.File, cb: any) {
    const ext = file.originalname.split(".").pop();
    console.log(file.originalname);
    
    const fileNameRandom = `profile-image-${Date.now()}.${ext}`;
    console.log(fileNameRandom);
    
    cb(null, fileNameRandom);
  },
});

const multerMiddleware = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg" || file.mimetype == "image/webp") {
      cb(null, true);
    } else {
      return cb(new Error('Invalid mime type'));
    }
  }
});

export default multerMiddleware;