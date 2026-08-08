// Cloudinary SDK setup, configured once from env vars and imported wherever
// an upload or signed-URL needs to happen (cloudinaryService.js). Mirrors
// db.js's pattern of a single configured client shared across the app.
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

export default cloudinary;
