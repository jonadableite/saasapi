import fs from "node:fs";
// src/controllers/upload.controller.ts
import type { Request, Response } from "express";
import minioClient from "../config/minioClient";

export const uploadFileController = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo foi enviado",
      });
    }

    const uploadedFiles = await Promise.all(
      Object.entries(files).map(async ([fieldname, fileArray]) => {
        const file = fileArray[0];
        const fileStream = fs.createReadStream(file.path);
        const objectName = `${Date.now()}-${file.originalname}`;

        await minioClient.putObject(
          process.env.MINIO_BUCKET_NAME!,
          objectName,
          fileStream,
          file.size,
          {
            "Content-Type": file.mimetype,
          },
        );

        const url = `${process.env.MINIO_SERVER_URL}/${process.env.MINIO_BUCKET_NAME}/${objectName}`;

        // Limpar arquivo temporário
        fs.unlinkSync(file.path);

        return {
          fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          url,
        };
      }),
    );

    return res.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao fazer upload do arquivo",
    });
  }
};
