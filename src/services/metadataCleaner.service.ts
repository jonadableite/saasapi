import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

interface CleanResult {
  success: boolean;
  message?: string;
  error?: string;
  cleanedMedia?: {
    data: string;
    fileName: string;
    mimetype: string;
    size: number;
  };
  data?: {
    originalSize: number;
    cleanedSize: number;
    reduction: number;
    reductionPercentage: number;
  };
}

interface SupportedTypes {
  images: string[];
  videos: string[];
  audios: string[];
}

class MetadataCleanerService {
  private tempDir: string;
  private supportedTypes: SupportedTypes;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.supportedTypes = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      videos: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
      audios: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg']
    };
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Limpa metadados de mídia (imagens, vídeos, áudios)
   */
  async cleanMediaMetadata(
    base64Data: string,
    fileName: string,
    mimetype: string
  ): Promise<CleanResult> {
    try {
      logger.log('MetadataCleaner', `Iniciando limpeza de metadados: ${fileName}`);

      // Extrair dados do base64
      const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        return {
          success: false,
          error: 'Formato base64 inválido',
          data: { originalSize: 0, cleanedSize: 0, reduction: 0, reductionPercentage: 0 }
        };
      }

      const [, detectedMimetype, base64Content] = base64Match;
      const actualMimetype = mimetype || detectedMimetype;
      const buffer = Buffer.from(base64Content, 'base64');
      const originalSize = buffer.length;

      // Verificar se o tipo é suportado
      if (!this.isSupportedType(actualMimetype)) {
        return {
          success: false,
          error: `Tipo de mídia não suportado: ${actualMimetype}`,
          data: { originalSize, cleanedSize: 0, reduction: 0, reductionPercentage: 0 }
        };
      }

      let cleanedBuffer: Buffer;
      let cleanedMimetype = actualMimetype;
      let cleanedFileName = fileName;

      // Processar baseado no tipo de mídia
      if (this.supportedTypes.images.includes(actualMimetype)) {
        const result = await this.cleanImageMetadata(buffer, fileName);
        cleanedBuffer = result.buffer;
        cleanedMimetype = result.mimetype;
        cleanedFileName = result.fileName;
      } else if (this.supportedTypes.videos.includes(actualMimetype)) {
        const result = await this.cleanVideoMetadata(buffer, fileName);
        cleanedBuffer = result.buffer;
        cleanedMimetype = result.mimetype;
        cleanedFileName = result.fileName;
      } else if (this.supportedTypes.audios.includes(actualMimetype)) {
        const result = await this.cleanAudioMetadata(buffer, fileName);
        cleanedBuffer = result.buffer;
        cleanedMimetype = result.mimetype;
        cleanedFileName = result.fileName;
      } else {
        return {
          success: false,
          error: `Tipo de mídia não suportado: ${actualMimetype}`,
          data: { originalSize, cleanedSize: 0, reduction: 0, reductionPercentage: 0 }
        };
      }

      const cleanedSize = cleanedBuffer.length;
      const reduction = originalSize - cleanedSize;
      const reductionPercentage = Math.round((reduction / originalSize) * 100);

      // Converter de volta para base64
      const cleanedBase64 = `data:${cleanedMimetype};base64,${cleanedBuffer.toString('base64')}`;

      logger.log(`Metadados removidos com sucesso: ${fileName}`, {
        originalSize,
        cleanedSize,
        reduction
      });

      return {
        success: true,
        message: 'Metadados removidos com sucesso',
        cleanedMedia: {
          data: cleanedBase64,
          fileName: cleanedFileName,
          mimetype: cleanedMimetype,
          size: cleanedSize
        },
        data: {
          originalSize,
          cleanedSize,
          reduction,
          reductionPercentage
        }
      };

    } catch (error) {
      logger.error('MetadataCleaner', `Erro ao limpar metadados: ${error}`);
      return {
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: { originalSize: 0, cleanedSize: 0, reduction: 0, reductionPercentage: 0 }
      };
    }
  }

  /**
   * Limpa metadados de imagens usando Sharp
   */
  private async cleanImageMetadata(buffer: Buffer, fileName: string): Promise<{
    buffer: Buffer;
    mimetype: string;
    fileName: string;
  }> {
    try {
      // Remove todos os metadados EXIF e converte para JPEG otimizado
      const cleanedBuffer = await sharp(buffer)
        .jpeg({ 
          quality: 85, 
          progressive: true,
          mozjpeg: true 
        })
        .withMetadata({}) // Remove todos os metadados
        .toBuffer();

      const cleanedFileName = `clean_${path.parse(fileName).name}_${Date.now()}.jpg`;

      return {
        buffer: cleanedBuffer,
        mimetype: 'image/jpeg',
        fileName: cleanedFileName
      };
    } catch (error) {
      throw new Error(`Falha ao processar imagem: ${error}`);
    }
  }

  /**
   * Limpa metadados de vídeos usando FFmpeg
   */
  private async cleanVideoMetadata(buffer: Buffer, fileName: string): Promise<{
    buffer: Buffer;
    mimetype: string;
    fileName: string;
  }> {
    const inputPath = path.join(this.tempDir, `input_${Date.now()}_${fileName}`);
    const outputPath = path.join(this.tempDir, `clean_${Date.now()}_${path.parse(fileName).name}.mp4`);

    try {
      // Salvar arquivo temporário
      await fs.writeFile(inputPath, buffer);

      // Executar FFmpeg para remover metadados
      await this.runFFmpeg([
        '-i', inputPath,
        '-map_metadata', '-1', // Remove todos os metadados
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-y', // Sobrescrever arquivo de saída
        outputPath
      ]);

      // Ler arquivo limpo
      const cleanedBuffer = await fs.readFile(outputPath);
      const cleanedFileName = `clean_${path.parse(fileName).name}_${Date.now()}.mp4`;

      return {
        buffer: cleanedBuffer,
        mimetype: 'video/mp4',
        fileName: cleanedFileName
      };

    } finally {
      // Limpar arquivos temporários
      try {
        await fs.unlink(inputPath);
        await fs.unlink(outputPath);
      } catch (error) {
        logger.warn('MetadataCleaner', `Erro ao limpar arquivos temporários: ${error}`);
      }
    }
  }

  /**
   * Limpa metadados de áudios usando FFmpeg
   */
  private async cleanAudioMetadata(buffer: Buffer, fileName: string): Promise<{
    buffer: Buffer;
    mimetype: string;
    fileName: string;
  }> {
    const inputPath = path.join(this.tempDir, `input_${Date.now()}_${fileName}`);
    const outputPath = path.join(this.tempDir, `clean_${Date.now()}_${path.parse(fileName).name}.mp3`);

    try {
      // Salvar arquivo temporário
      await fs.writeFile(inputPath, buffer);

      // Executar FFmpeg para remover metadados
      await this.runFFmpeg([
        '-i', inputPath,
        '-map_metadata', '-1', // Remove todos os metadados
        '-c:a', 'mp3',
        '-b:a', '128k',
        '-y', // Sobrescrever arquivo de saída
        outputPath
      ]);

      // Ler arquivo limpo
      const cleanedBuffer = await fs.readFile(outputPath);
      const cleanedFileName = `clean_${path.parse(fileName).name}_${Date.now()}.mp3`;

      return {
        buffer: cleanedBuffer,
        mimetype: 'audio/mp3',
        fileName: cleanedFileName
      };

    } finally {
      // Limpar arquivos temporários
      try {
        await fs.unlink(inputPath);
        await fs.unlink(outputPath);
      } catch (error) {
        logger.warn('MetadataCleaner', `Erro ao limpar arquivos temporários: ${error}`);
      }
    }
  }

  /**
   * Executa comando FFmpeg
   */
  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        reject(new Error('FFmpeg não encontrado'));
        return;
      }

      const process = spawn(ffmpeg, args);
      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg falhou com código ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Erro ao executar FFmpeg: ${error.message}`));
      });
    });
  }

  /**
   * Verifica se o tipo de mídia é suportado
   */
  private isSupportedType(mimetype: string): boolean {
    return [
      ...this.supportedTypes.images,
      ...this.supportedTypes.videos,
      ...this.supportedTypes.audios
    ].includes(mimetype);
  }

  /**
   * Retorna os tipos de mídia suportados
   */
  getSupportedTypes(): SupportedTypes {
    return this.supportedTypes;
  }
}

export const metadataCleanerService = new MetadataCleanerService();