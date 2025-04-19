import dotenv from "dotenv";
// src/config/minioClient.ts
import { Client } from "minio";

// Carrega as variáveis de ambiente
dotenv.config();

// Verifica se as variáveis necessárias existem
if (!process.env.MINIO_SERVER_URL) {
  throw new Error("MINIO_SERVER_URL não está definido");
}
if (!process.env.MINIO_ROOT_USER) {
  throw new Error("MINIO_ROOT_USER não está definido");
}
if (!process.env.MINIO_ROOT_PASSWORD) {
  throw new Error("MINIO_ROOT_PASSWORD não está definido");
}

const minioClient = new Client({
  endPoint: process.env.MINIO_SERVER_URL.replace("https://", "").replace(
    ":443",
    "",
  ),
  port: 443,
  useSSL: true,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
  region: process.env.MINIO_REGION,
});

export default minioClient;
