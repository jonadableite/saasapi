import { Request, Response } from 'express';
import { metadataCleanerService } from '../services/metadataCleaner.service';
import { logger } from '../utils/logger';

interface TestCleanRequest {
  base64Data: string;
  fileName: string;
  mimetype: string;
}

class MetadataCleanerController {
  /**
   * Testa a limpeza de metadados de uma mídia
   * POST /api/metadata-cleaner/test
   */
  async testClean(req: Request, res: Response): Promise<void> {
    try {
      const { base64Data, fileName, mimetype }: TestCleanRequest = req.body;

      // Validação dos dados de entrada
      if (!base64Data || !fileName || !mimetype) {
        res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios: base64Data, fileName, mimetype',
          data: {
            originalSize: 0,
            cleanedSize: 0,
            reduction: 0,
            reductionPercentage: 0
          }
        });
        return;
      }

      // Validar formato base64
      if (!base64Data.startsWith('data:')) {
        res.status(400).json({
          success: false,
          error: 'base64Data deve estar no formato: data:mimetype;base64,content',
          data: {
            originalSize: 0,
            cleanedSize: 0,
            reduction: 0,
            reductionPercentage: 0
          }
        });
        return;
      }

      logger.log('MetadataCleanerController', `Testando limpeza de metadados: ${fileName}`);

      // Executar limpeza de metadados
      const result = await metadataCleanerService.cleanMediaMetadata(
        base64Data,
        fileName,
        mimetype
      );

      // Retornar resultado
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('MetadataCleanerController', `Erro no teste de limpeza: ${error}`);
      
      res.status(500).json({
        success: false,
        error: `Erro interno do servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: {
          originalSize: 0,
          cleanedSize: 0,
          reduction: 0,
          reductionPercentage: 0
        }
      });
    }
  }

  /**
   * Retorna os tipos de mídia suportados
   * GET /api/metadata-cleaner/supported-types
   */
  async getSupportedTypes(req: Request, res: Response): Promise<void> {
    try {
      logger.log('MetadataCleanerController', 'Consultando tipos de mídia suportados');

      const supportedTypes = metadataCleanerService.getSupportedTypes();

      res.status(200).json({
        success: true,
        message: 'Tipos de mídia suportados',
        data: {
          supportedTypes,
          totalTypes: {
            images: supportedTypes.images.length,
            videos: supportedTypes.videos.length,
            audios: supportedTypes.audios.length,
            total: supportedTypes.images.length + supportedTypes.videos.length + supportedTypes.audios.length
          },
          examples: {
            images: {
              formats: 'JPEG, PNG, GIF, WebP',
              metadataRemoved: 'EXIF, GPS, data/hora, informações da câmera',
              processing: 'Re-codificação para JPEG otimizado'
            },
            videos: {
              formats: 'MP4, AVI, MOV, WMV',
              metadataRemoved: 'Data de criação, localização, informações do dispositivo',
              processing: 'Re-codificação com FFmpeg'
            },
            audios: {
              formats: 'MP3, WAV, OGG',
              metadataRemoved: 'Tags ID3, informações do artista, álbum',
              processing: 'Re-codificação para MP3 otimizado'
            }
          }
        }
      });

    } catch (error) {
      logger.error('MetadataCleanerController', `Erro ao consultar tipos suportados: ${error}`);
      
      res.status(500).json({
        success: false,
        error: `Erro interno do servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: null
      });
    }
  }

  /**
   * Endpoint de health check para o serviço
   * GET /api/metadata-cleaner/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      logger.log('MetadataCleanerController', 'Health check do serviço de limpeza de metadados');

      res.status(200).json({
        success: true,
        message: 'Serviço de limpeza de metadados funcionando corretamente',
        data: {
          service: 'MetadataCleanerService',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          features: {
            imageProcessing: 'Sharp',
            videoProcessing: 'FFmpeg',
            audioProcessing: 'FFmpeg'
          },
          limits: {
            maxFileSize: '300MB',
            tempDirectory: 'temp/',
            supportedFormats: {
              images: 4,
              videos: 4,
              audios: 4
            }
          }
        }
      });

    } catch (error) {
      logger.error('MetadataCleanerController', `Erro no health check: ${error}`);
      
      res.status(500).json({
        success: false,
        error: `Erro interno do servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: {
          service: 'MetadataCleanerService',
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const metadataCleanerController = new MetadataCleanerController();