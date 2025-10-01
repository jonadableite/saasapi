// src/routes/lead.routes.ts
import { Router } from "express";
import multer from "multer";
import { LeadController } from "../controllers/lead.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { segmentLeads } from "../services/lead.service";
import type { RequestWithUser } from "../types";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const leadController = new LeadController();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gerenciamento de leads
 */

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Listar leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo de busca
 *     responses:
 *       200:
 *         description: Lista de leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 */
router.get("/", leadController.getLeads);

/**
 * @swagger
 * /api/leads/segment:
 *   get:
 *     summary: Buscar leads por segmento
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: segment
 *         schema:
 *           type: string
 *         description: Nome do segmento
 *     responses:
 *       200:
 *         description: Leads do segmento
 *   post:
 *     summary: Segmentar leads com regras
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                     operator:
 *                       type: string
 *                     value:
 *                       type: string
 *     responses:
 *       200:
 *         description: Leads segmentados com sucesso
 */
router.get("/segment", leadController.getLeadsBySegment);

/**
 * @swagger
 * /api/leads/{id}:
 *   get:
 *     summary: Buscar lead por ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Dados do lead
 *       404:
 *         description: Lead não encontrado
 *   put:
 *     summary: Atualizar lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead atualizado com sucesso
 *   delete:
 *     summary: Deletar lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Lead deletado com sucesso
 */
router.get("/:id", leadController.getLeads);
router.put("/:id", leadController.updateLead);
router.delete("/:id", leadController.deleteLead);

/**
 * @swagger
 * /api/leads/plan:
 *   get:
 *     summary: Obter plano do usuário para leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações do plano
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 planName:
 *                   type: string
 *                 maxLeads:
 *                   type: number
 *                 currentLeads:
 *                   type: number
 */
router.get("/plan", leadController.getUserPlan);

/**
 * @swagger
 * /api/leads/import:
 *   post:
 *     summary: Importar leads via arquivo
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo CSV ou Excel com leads
 *     responses:
 *       200:
 *         description: Leads importados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 imported:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Arquivo inválido
 */
router.post("/import", upload.single("file"), leadController.uploadLeads);

router.post("/segment", async (req: RequestWithUser, res) => {
  try {
    const { rules } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const segmentedLeads = await segmentLeads(rules);
    res.status(200).json({ success: true, data: segmentedLeads });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao segmentar leads",
      details: (error as Error).message,
    });
  }
});

export default router;
