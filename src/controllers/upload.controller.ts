import fs from "fs";
// src/controllers/upload.controller.ts
import type { Request, Response } from "express";
import minioClient from "../config/minioClient";

export const uploadFileController = async (req: Request, res: Response) => {
	try {
		const files = req.files as { [fieldname: string]: Express.Multer.File[] };
		const uploadedFiles: { url: string; fieldname: string }[] = [];

		for (const fieldname in files) {
			const file = files[fieldname][0];
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

			// Gerar URL permanente
			const url = `${process.env.MINIO_SERVER_URL}/${process.env.MINIO_BUCKET_NAME}/${objectName}`;

			uploadedFiles.push({
				url,
				fieldname,
			});

			// Limpar arquivo temporário
			fs.unlinkSync(file.path);
		}

		return res.json({
			success: true,
			files: uploadedFiles,
		});
	} catch (error) {
		console.error("Erro no upload:", error);
		return res.status(500).json({
			success: false,
			error: "Erro ao fazer upload do arquivo",
		});
	}
};
