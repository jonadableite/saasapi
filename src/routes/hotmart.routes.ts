// src/routes/hotmart.routes.ts
import { Router } from "express";
import { HotmartController } from "../controllers/hotmart.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();
const hotmartController = new HotmartController();

/**
 * @swagger
 * components:
 *   schemas:
 *     HotmartWebhookData:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do evento
 *         event:
 *           type: string
 *           description: Tipo do evento (PURCHASE_APPROVED, SUBSCRIPTION_CANCELLATION, etc.)
 *         version:
 *           type: string
 *           description: Versão da API do webhook
 *         date_created:
 *           type: number
 *           description: Timestamp de criação do evento
 *         data:
 *           type: object
 *           properties:
 *             product:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                 name:
 *                   type: string
 *                 ucode:
 *                   type: string
 *             buyer:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 checkout_phone:
 *                   type: string
 *                 document:
 *                   type: string
 *             purchase:
 *               type: object
 *               properties:
 *                 order_date:
 *                   type: number
 *                 price:
 *                   type: object
 *                   properties:
 *                     value:
 *                       type: number
 *                     currency_value:
 *                       type: string
 *                 payment:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                     installments_number:
 *                       type: number
 *                     type:
 *                       type: string
 *                 transaction:
 *                   type: string
 *                 status:
 *                   type: string
 *                 approved_date:
 *                   type: number
 *                 subscription:
 *                   type: object
 *                   properties:
 *                     subscriber:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                     plan:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         id:
 *                           type: number
 *                     status:
 *                       type: string
 *                     date_next_charge:
 *                       type: number
 *                     charges_number:
 *                       type: number
 *
 *     HotmartCustomer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         plan:
 *           type: string
 *         isActive:
 *           type: boolean
 *         subscriptionStatus:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         hotmartCustomerId:
 *           type: string
 *         hotmartSubscriberCode:
 *           type: string
 *         hotmartTransactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HotmartTransaction'
 *
 *     HotmartTransaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         transactionId:
 *           type: string
 *         event:
 *           type: string
 *         status:
 *           type: string
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         productName:
 *           type: string
 *         buyerEmail:
 *           type: string
 *         buyerName:
 *           type: string
 *         orderDate:
 *           type: string
 *           format: date-time
 *         approvedDate:
 *           type: string
 *           format: date-time
 *         paymentMethod:
 *           type: string
 *         installments:
 *           type: number
 *         subscriberCode:
 *           type: string
 *         planName:
 *           type: string
 *         nextChargeDate:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     CustomerStats:
 *       type: object
 *       properties:
 *         totalCustomers:
 *           type: number
 *         activeCustomers:
 *           type: number
 *         totalRevenue:
 *           type: number
 *         churnRate:
 *           type: number
 */

/**
 * @swagger
 * /api/hotmart/webhook/user:
 *   post:
 *     summary: Webhook para processar eventos da Hotmart
 *     description: Endpoint para receber e processar todos os eventos da Hotmart (compras, assinaturas, etc.)
 *     tags: [Hotmart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HotmartWebhookData'
 *     responses:
 *       200:
 *         description: Webhook processado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 event:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/webhook/user", hotmartController.handleWebhook);

/**
 * @swagger
 * /api/hotmart/customers:
 *   get:
 *     summary: Listar clientes da Hotmart
 *     description: Buscar clientes com paginação, filtros e pesquisa
 *     tags: [Hotmart Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Itens por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, CANCELLED, SUSPENDED]
 *         description: Filtrar por status da assinatura
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [APPROVED, CANCELLED, REFUNDED]
 *         description: Filtrar por status do pagamento
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HotmartCustomer'
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/customers", authMiddleware, hotmartController.getCustomers);

/**
 * @swagger
 * /api/hotmart/stats:
 *   get:
 *     summary: Estatísticas dos clientes Hotmart
 *     description: Obter estatísticas gerais dos clientes da Hotmart
 *     tags: [Hotmart Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas dos clientes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerStats'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/stats", authMiddleware, hotmartController.getCustomerStats);

/**
 * @swagger
 * /api/hotmart/export:
 *   get:
 *     summary: Exportar clientes para CSV
 *     description: Exportar lista de clientes da Hotmart em formato CSV
 *     tags: [Hotmart Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, CANCELLED, SUSPENDED]
 *         description: Filtrar por status da assinatura
 *     responses:
 *       200:
 *         description: Arquivo CSV com dados dos clientes
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/export", authMiddleware, hotmartController.exportCustomers);

/**
 * @swagger
 * /api/hotmart/sync:
 *   post:
 *     summary: Sincronizar dados com Hotmart
 *     tags: [Hotmart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronização realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 syncedCount:
 *                   type: number
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/sync", authMiddleware, hotmartController.syncWithHotmart);

/**
 * @swagger
 * /api/hotmart/sales/history:
 *   get:
 *     summary: Buscar histórico de vendas da Hotmart
 *     tags: [Hotmart Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de início (timestamp)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de fim (timestamp)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: ID do produto
 *       - in: query
 *         name: buyer_email
 *         schema:
 *           type: string
 *         description: Email do comprador
 *       - in: query
 *         name: transaction_status
 *         schema:
 *           type: string
 *         description: Status da transação
 *       - in: query
 *         name: max_results
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: page_token
 *         schema:
 *           type: string
 *         description: Token de paginação
 *     responses:
 *       200:
 *         description: Histórico de vendas recuperado com sucesso
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/sales/history", authMiddleware, hotmartController.getSalesHistory);

/**
 * @swagger
 * /api/hotmart/sales/summary:
 *   get:
 *     summary: Buscar sumário de vendas da Hotmart
 *     tags: [Hotmart Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de início (timestamp)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de fim (timestamp)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: ID do produto
 *       - in: query
 *         name: currency_code
 *         schema:
 *           type: string
 *         description: Código da moeda
 *     responses:
 *       200:
 *         description: Sumário de vendas recuperado com sucesso
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/sales/summary", authMiddleware, hotmartController.getSalesSummary);

/**
 * @swagger
 * /api/hotmart/sales/users:
 *   get:
 *     summary: Buscar participantes de vendas da Hotmart
 *     tags: [Hotmart Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de início (timestamp)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de fim (timestamp)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: ID do produto
 *       - in: query
 *         name: buyer_email
 *         schema:
 *           type: string
 *         description: Email do comprador
 *       - in: query
 *         name: max_results
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: page_token
 *         schema:
 *           type: string
 *         description: Token de paginação
 *     responses:
 *       200:
 *         description: Participantes de vendas recuperados com sucesso
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/sales/users", authMiddleware, hotmartController.getSalesUsers);

/**
 * @swagger
 * /api/hotmart/sales/commissions:
 *   get:
 *     summary: Buscar comissões de vendas da Hotmart
 *     tags: [Hotmart Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de início (timestamp)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de fim (timestamp)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: ID do produto
 *       - in: query
 *         name: max_results
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: page_token
 *         schema:
 *           type: string
 *         description: Token de paginação
 *     responses:
 *       200:
 *         description: Comissões de vendas recuperadas com sucesso
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/sales/commissions", authMiddleware, hotmartController.getSalesCommissions);

/**
 * @swagger
 * /api/hotmart/sales/price-details:
 *   get:
 *     summary: Buscar detalhes de preços de vendas da Hotmart
 *     tags: [Hotmart Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de início (timestamp)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Data de fim (timestamp)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: ID do produto
 *       - in: query
 *         name: transaction_id
 *         schema:
 *           type: string
 *         description: ID da transação
 *       - in: query
 *         name: max_results
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: page_token
 *         schema:
 *           type: string
 *         description: Token de paginação
 *     responses:
 *       200:
 *         description: Detalhes de preços recuperados com sucesso
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/sales/price-details", authMiddleware, hotmartController.getSalesPriceDetails);

export default router;
