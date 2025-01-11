import fs from "node:fs";
import { extname, resolve } from "node:path";
// src/config/multer.ts
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

const uploadDirectory = resolve(__dirname, "..", "..", "uploads");

// Cria o diretório de uploads se não existir
if (!fs.existsSync(uploadDirectory)) {
	fs.mkdirSync(uploadDirectory, { recursive: true });
}

export default {
	storage: multer.diskStorage({
		destination: (req, file, callback) => {
			callback(null, uploadDirectory);
		},
		filename: (req, file, callback) => {
			const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
			callback(null, uniqueName);
		},
	}),

	fileFilter: (
		req: any,
		file: Express.Multer.File,
		callback: multer.FileFilterCallback,
	) => {
		const allowedTypes =
			/jpeg|jpg|png|gif|mp4|avi|mkv|mp3|wav|pdf|doc|docx|xlsx|xls/;
		const mimeType = allowedTypes.test(file.mimetype);
		const extName = allowedTypes.test(extname(file.originalname).toLowerCase());

		if (mimeType && extName) {
			return callback(null, true);
		}
		callback(new Error("Tipo de arquivo não suportado"));
	},
};
