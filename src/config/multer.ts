import multer from "multer";
import fs from "node:fs";
import { extname, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../errors/AppError";

const uploadDirectory = resolve(__dirname, "..", "tmp");

// Cria o diretório de uploads se não existir
if (!fs.existsSync(uploadDirectory)) {
	fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Definir interface para tipos MIME
interface MimeTypes {
	[key: string]: boolean;
}

// Lista expandida de tipos MIME permitidos
const allowedMimeTypes: MimeTypes = {
	// Imagens
	"image/jpeg": true,
	"image/png": true,
	"image/gif": true,
	"image/webp": true,
	"image/svg+xml": true,

	// Áudio
	"audio/mpeg": true, // .mp3
	"audio/wav": true, // .wav
	"audio/ogg": true, // .ogg
	"audio/aac": true, // .aac
	"audio/midi": true, // .midi
	"audio/x-midi": true,
	"audio/webm": true,
	"audio/3gpp": true,
	"audio/3gpp2": true,
	"audio/mp4": true,

	// Vídeo
	"video/mp4": true,
	"video/mpeg": true,
	"video/ogg": true,
	"video/webm": true,
	"video/3gpp": true,
	"video/3gpp2": true,
	"video/x-msvideo": true, // .avi
	"video/quicktime": true, // .mov

	// Documentos
	"application/pdf": true,
	"application/msword": true, // .doc
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true, // .docx
	"application/vnd.ms-excel": true, // .xls
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true, // .xlsx
	"application/vnd.ms-powerpoint": true, // .ppt
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true, // .pptx
	"text/plain": true,

	// Arquivos compactados
	"application/zip": true,
	"application/x-rar-compressed": true,
	"application/x-7z-compressed": true,

	// Outros formatos comuns
	"application/json": true,
	"text/csv": true,
	"text/xml": true,
};

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
		// Lista de extensões permitidas
		const allowedExtensions = new Set([
			// Imagens
			".jpg",
			".jpeg",
			".png",
			".gif",
			".webp",
			".svg",

			// Áudio
			".mp3",
			".wav",
			".ogg",
			".aac",
			".midi",
			".mid",
			".webm",
			".3gp",
			".m4a",

			// Vídeo
			".mp4",
			".mpeg",
			".ogg",
			".webm",
			".3gp",
			".avi",
			".mov",
			".wmv",

			// Documentos
			".pdf",
			".doc",
			".docx",
			".xls",
			".xlsx",
			".ppt",
			".pptx",
			".txt",

			// Arquivos compactados
			".zip",
			".rar",
			".7z",

			// Outros
			".json",
			".csv",
			".xml",
		]);

		const mimeTypeAllowed = allowedMimeTypes[file.mimetype] || false;
		const extAllowed = allowedExtensions.has(
			extname(file.originalname).toLowerCase(),
		);

		if (mimeTypeAllowed && extAllowed) {
			return callback(null, true);
		}

		console.log("Arquivo rejeitado:", {
			filename: file.originalname,
			mimetype: file.mimetype,
			extension: extname(file.originalname).toLowerCase(),
		});

		callback(
			new Error(
				`Tipo de arquivo não suportado. Tipos permitidos: ${Array.from(
					allowedExtensions,
				).join(", ")}`,
			),
		);
	},

	limits: {
		fileSize: 100 * 1024 * 1024, // Limite de 100MB
	},
};

export const uploadConfig = multer({
	storage: multer.memoryStorage(),
	fileFilter: (req, file, cb) => {
		console.log("Multer receiving file:", {
			fieldname: file.fieldname,
			originalname: file.originalname,
			mimetype: file.mimetype,
		});

		// Aceitar qualquer arquivo com extensão .csv ou .xlsx
		const allowedExtensions = ["csv", "xlsx"];
		const fileExtension =
			file.originalname.split(".").pop()?.toLowerCase() || "";

		if (allowedExtensions.includes(fileExtension)) {
			// Força o mimetype para csv se a extensão for csv
			if (fileExtension === "csv") {
				file.mimetype = "text/csv";
			}
			cb(null, true);
		} else {
			cb(
				new BadRequestError(
					`Formato não suportado. Use arquivos .csv ou .xlsx`,
				) as any, // Type assertion para compatibilidade com multer
			);
		}
	},
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB
	},
});
