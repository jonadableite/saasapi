import { Router } from 'express';
import { metadataCleanerController } from '../controllers/metadataCleaner.controller';
import { authMiddleware } from '../middlewares/authenticate';

const router = Router();

/**
 * @swagger
 * /api/metadata-cleaner/test:
 *   post:
 *     summary: Testa a limpeza de metadados de uma mídia
 *     tags: [Metadata Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base64Data
 *               - fileName
 *               - mimetype
 *             properties:
 *               base64Data:
 *                 type: string
 *                 description: Dados da mídia em formato base64 (data:mimetype;base64,content)
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
 *               fileName:
 *                 type: string
 *                 description: Nome do arquivo
 *                 example: "foto.jpg"
 *               mimetype:
 *                 type: string
 *                 description: Tipo MIME do arquivo
 *                 example: "image/jpeg"
 *     responses:
 *       200:
 *         description: Metadados removidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Metadados removidos com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalSize:
 *                       type: number
 *                       example: 1024000
 *                     cleanedSize:
 *                       type: number
 *                       example: 850000
 *                     reduction:
 *                       type: number
 *                       example: 174000
 *                     reductionPercentage:
 *                       type: number
 *                       example: 17
 *                     cleanedMedia:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           description: Mídia limpa em base64
 *                         fileName:
 *                           type: string
 *                           example: "clean_foto_1234567890.jpg"
 *                         mimetype:
 *                           type: string
 *                           example: "image/jpeg"
 *                         size:
 *                           type: number
 *                           example: 850000
 *       400:
 *         description: Erro de validação ou tipo não suportado
 *       401:
 *         description: Token de autenticação inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/test', authMiddleware, metadataCleanerController.testClean);

/**
 * @swagger
 * /api/metadata-cleaner/supported-types:
 *   get:
 *     summary: Retorna os tipos de mídia suportados
 *     tags: [Metadata Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tipos de mídia suportados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Tipos de mídia suportados"
 *                 data:
 *                   type: object
 *                   properties:
 *                     supportedTypes:
 *                       type: object
 *                       properties:
 *                         images:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["image/jpeg", "image/png", "image/gif", "image/webp"]
 *                         videos:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["video/mp4", "video/avi", "video/mov", "video/wmv"]
 *                         audios:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["audio/mp3", "audio/wav", "audio/ogg", "audio/mpeg"]
 *                     totalTypes:
 *                       type: object
 *                       properties:
 *                         images:
 *                           type: number
 *                           example: 4
 *                         videos:
 *                           type: number
 *                           example: 4
 *                         audios:
 *                           type: number
 *                           example: 4
 *                         total:
 *                           type: number
 *                           example: 12
 *       401:
 *         description: Token de autenticação inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/supported-types', authMiddleware, metadataCleanerController.getSupportedTypes);

/**
 * @swagger
 * /api/metadata-cleaner/health:
 *   get:
 *     summary: Health check do serviço de limpeza de metadados
 *     tags: [Metadata Cleaner]
 *     responses:
 *       200:
 *         description: Serviço funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Serviço de limpeza de metadados funcionando corretamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     service:
 *                       type: string
 *                       example: "MetadataCleanerService"
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     features:
 *                       type: object
 *                       properties:
 *                         imageProcessing:
 *                           type: string
 *                           example: "Sharp"
 *                         videoProcessing:
 *                           type: string
 *                           example: "FFmpeg"
 *                         audioProcessing:
 *                           type: string
 *                           example: "FFmpeg"
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/health', metadataCleanerController.healthCheck);

export default router;