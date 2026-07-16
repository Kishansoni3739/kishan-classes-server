import ImageKit from "imagekit";
import fs from "node:fs";

let imagekit = null;

const getImageKitClient = () => {
  if (imagekit) return imagekit;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    console.warn("[IMAGEKIT] Warning: Missing ImageKit credentials in environment. Uploads may fail.");
  }

  imagekit = new ImageKit({
    publicKey: publicKey || "placeholder",
    privateKey: privateKey || "placeholder",
    urlEndpoint: urlEndpoint || "placeholder"
  });

  return imagekit;
};

/**
 * Uploads a local file to ImageKit and deletes the local file afterward.
 * @param {string} localFilePath - Path to the local file on disk
 * @param {string} fileName - Destination file name in ImageKit
 * @param {string} folderPath - Target folder path in ImageKit (e.g. "/avatars")
 * @returns {Promise<string>} The uploaded file URL from ImageKit
 */
export const uploadToImageKit = async (localFilePath, fileName, folderPath = "/kishan-classes") => {
  const client = getImageKitClient();
  
  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found at path: ${localFilePath}`);
    }

    const response = await client.upload({
      file: fs.createReadStream(localFilePath),
      fileName: fileName,
      folder: folderPath
    });

    return response.url;
  } catch (err) {
    console.error(`[IMAGEKIT] Upload failed for ${fileName}:`, err.message);
    throw err;
  } finally {
    // Safely delete the temporary local file
    try {
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
      }
    } catch (unlinkErr) {
      console.error(`[IMAGEKIT] Error deleting local file: ${localFilePath}`, unlinkErr.message);
    }
  }
};

/**
 * Uploads a local file to ImageKit and returns URL and fileId, deleting local copy afterward.
 */
export const uploadToImageKitDetailed = async (localFilePath, fileName, folderPath = "/kishan-classes") => {
  const client = getImageKitClient();
  
  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found at path: ${localFilePath}`);
    }

    const response = await client.upload({
      file: fs.createReadStream(localFilePath),
      fileName: fileName,
      folder: folderPath
    });

    return {
      url: response.url,
      fileId: response.fileId
    };
  } catch (err) {
    console.error(`[IMAGEKIT] Upload failed for ${fileName}:`, err.message);
    throw err;
  } finally {
    try {
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
      }
    } catch (unlinkErr) {
      console.error(`[IMAGEKIT] Error deleting local file: ${localFilePath}`, unlinkErr.message);
    }
  }
};

/**
 * Deletes a file from ImageKit by its file ID.
 */
export const deleteFromImageKit = async (fileId) => {
  if (!fileId || fileId === "placeholder") return;
  const client = getImageKitClient();
  try {
    await client.deleteFile(fileId);
    console.log(`[IMAGEKIT] Successfully deleted fileId: ${fileId}`);
  } catch (err) {
    console.error(`[IMAGEKIT] Failed to delete fileId ${fileId}:`, err.message);
  }
};
