// src/routes/upload.routes.ts
import { Router } from "express";
import multer from "multer";
import multerConfig from "../config/multer";
import { uploadFileController } from "../controllers/upload.controller";
import { authMiddleware } from "../middlewares/authenticate";

const uploadRoutes = Router();
const upload = multer(multerConfig);

uploadRoutes.post(
  "/",
  authMiddleware, // Substituímos o ensureAuthenticated pelo authMiddleware
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadFileController,
);

export default uploadRoutes;
