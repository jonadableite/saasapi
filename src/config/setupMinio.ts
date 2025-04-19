// src/config/setupMinio.ts
import minioClient from "./minioClient";

async function setupMinioBucket() {
  const bucketName = process.env.MINIO_BUCKET_NAME!;

  try {
    // Verifica se o bucket existe
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      // Cria o bucket se não existir
      await minioClient.makeBucket(bucketName, process.env.MINIO_REGION!);
    }

    // Define a política do bucket para permitir acesso público de leitura
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log("Bucket configurado com sucesso!");
  } catch (error) {
    console.error("Erro ao configurar bucket:", error);
  }
}

export default setupMinioBucket;
