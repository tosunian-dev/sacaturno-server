// Las credenciales se leen a nivel de módulo, así que el .env tiene que estar
// cargado antes. Hoy lo garantiza el import de db.ts en app.ts, pero eso depende
// del orden de las líneas: dotenv es idempotente y acá cuesta nada.
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

// Las credenciales pueden venir como CLOUDINARY_URL (un solo string) o como las
// tres variables sueltas. El SDK lee CLOUDINARY_URL solo, así que únicamente
// configuramos a mano cuando llegan separadas.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  cloudinary.config({ secure: true });
}

export const CLOUDINARY_FOLDER =
  process.env.CLOUDINARY_FOLDER ?? "sacaturno/profile_images";

export const isCloudinaryConfigured = (): boolean => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  return Boolean(cloud_name && api_key && api_secret);
};

export interface UploadedImage {
  url: string;
  publicId: string;
}

// Se normaliza a 512x512 recortando al centro: las fotos entran como avatar en
// todos lados, y subir el original completo solo gasta ancho de banda.
export const uploadImage = (
  buffer: Buffer,
  folder: string = CLOUDINARY_FOLDER,
): Promise<UploadedImage> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: true,
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "auto" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("CLOUDINARY_EMPTY_RESULT"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });

// Borrar la imagen anterior nunca debe voltear la request: si falla, la nueva ya
// quedó guardada y lo único que queda es un archivo huérfano en Cloudinary.
export const deleteImage = async (publicId?: string | null): Promise<void> => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.error("CLOUDINARY_DELETE_FAILED", publicId, error);
  }
};

export default cloudinary;
