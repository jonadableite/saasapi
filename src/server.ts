require("module-alias/register");
import { createServer } from "node:http";
// src/server.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import cron from "node-cron";
import swaggerUi from "swagger-ui-express";
import setupMinioBucket from "./config/setupMinio";
import specs from "./config/swagger";
import { handleWebhook } from "./controllers/stripe.controller";
import { createUsersController } from "./controllers/user.controller";
import { schedulePaymentReminders } from "./jobs/payment-reminder.job";
import { updatePaymentStatuses } from "./jobs/updatePaymentStatuses";
import { prisma } from "./lib/prisma";
import { authMiddleware } from "./middlewares/authenticate";
import { errorHandler } from "./middlewares/errorHandler";
import adminRoutes from "./routes/admin.routes";
import affiliateRoutes from "./routes/affiliate.routes";
import { analyticsRoutes } from "./routes/analytics.routes";
import { campaignDispatcherRoutes } from "./routes/campaign-dispatcher.routes";
import { campaignLeadRoutes } from "./routes/campaign-lead.routes";
import { campaignSchedulerRoutes } from "./routes/campaign-scheduler.routes";
import { campaignRoutes } from "./routes/campaign.routes";
import { companyRoutes } from "./routes/company.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import dashboardsRoutes from "./routes/dashboards.routes";
import instanceRoutes from "./routes/instance.routes";
import leadRoutes from "./routes/lead.routes";
import messageLogRoutes from "./routes/message-log.routes";
import passwordRoutes from "./routes/password.routes";
import paymentRoutes from "./routes/payment.routes";
import reportsRoutes from "./routes/reports.routes";
import sessionRoutes from "./routes/session.routes";
import stripeRoutes from "./routes/stripe.routes";
import uploadRoutes from "./routes/upload.routes";
import userRoutes from "./routes/user.routes";
import warmupRoutes from "./routes/warmup.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { campaignService } from "./services/campaign.service";
import socketService from "./services/socket.service";
import { logger } from "./utils/logger";

// Configurar logger para este contexto
const serverLogger = logger.setContext("ServerInitialization");
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 9000;
let server: ReturnType<typeof app.listen>;

// Inicialização do socket usando o socket.service
try {
  socketService.initializeSocketServer(httpServer);
  serverLogger.info("Socket.io inicializado com sucesso");
} catch (error) {
  serverLogger.error("Erro ao inicializar Socket.io", error);
  // Mesmo com erro, continuamos a inicialização do servidor
}

// Configurações de CORS
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "headers",
    "apikey",
    "X-API-Key",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Configurar limites para o body-parser
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ limit: "300mb", extended: true }));

// Documentação Swagger
app.use("/doc", swaggerUi.serve, swaggerUi.setup(specs));

// Rotas que precisam do body raw (antes dos parsers)
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);
app.use("/api/stripe", stripeRoutes);

// Rotas públicas (sem autenticação)
app.use("/webhook", webhookRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users/register", createUsersController);

// Middleware de autenticação para todas as rotas protegidas
app.use("/api", authMiddleware);

// Rotas protegidas (com autenticação)
const protectedRoutes = [
  { path: "/api/affiliates", route: affiliateRoutes },
  { path: "/api/payments", route: paymentRoutes },
  { path: "/api/admin", route: adminRoutes },
  { path: "/api/leads", route: leadRoutes },
  { path: "/api/user", route: userRoutes },
  { path: "/api/users", route: userRoutes },
  { path: "/api/instances", route: instanceRoutes },
  { path: "/api/dashboard", route: dashboardRoutes },
  { path: "/api/warmup", route: warmupRoutes },
  { path: "/api/upload", route: uploadRoutes },
  { path: "/api/campaigns", route: campaignRoutes },
  { path: "/api/campaigns", route: campaignLeadRoutes },
  { path: "/api/reports", route: reportsRoutes },
  { path: "/api/campaigns", route: campaignDispatcherRoutes },
  { path: "/api/scheduler", route: campaignSchedulerRoutes },
  { path: "/api/analytics", route: analyticsRoutes },
  { path: "/api/companies", route: companyRoutes },
  { path: "/api/dashboards", route: dashboardsRoutes },
  { path: "/api/message-logs", route: messageLogRoutes },
];

protectedRoutes.forEach(({ path, route }) => {
  app.use(path, route);
  serverLogger.log(`Rota protegida registrada: ${path}`);
});

// Middleware de erro deve ser o último
app.use(errorHandler);

// Cron jobs
try {
  cron.schedule("0 0 * * *", () => {
    serverLogger.info("Iniciando atualização de status de pagamento");
    updatePaymentStatuses(prisma);
  });

  cron.schedule("0 * * * *", async () => {
    serverLogger.info("Processando mensagens não lidas");
    await campaignService.processUnreadMessages();
  });

  cron.schedule("0 0 * * *", async () => {
    serverLogger.info("Segmentando leads");
    await campaignService.segmentLeads();
  });

  // Agende os lembretes de pagamento
  schedulePaymentReminders();
  serverLogger.log("Lembretes de pagamento agendados");
} catch (error) {
  serverLogger.error("Erro ao configurar cron jobs", error);
}

// Função de encerramento limpo
async function gracefulShutdown() {
  serverLogger.warn("Iniciando encerramento do servidor");
  try {
    await prisma.$disconnect();
    serverLogger.info("Conexão com o banco de dados encerrada");
    if (server) {
      server.close(() => {
        serverLogger.info("Servidor encerrado com sucesso");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    serverLogger.error("Erro durante o encerramento", error);
    process.exit(1);
  }
}

// Configuração de timezone
process.env.TZ = "America/Sao_Paulo";
serverLogger.info(`Timezone configurado para: ${process.env.TZ}`);

// Inicia o servidor
setupMinioBucket()
  .then(() => {
    serverLogger.info("Bucket Minio configurado com sucesso");

    // Iniciando o servidor HTTP
    server = httpServer.listen(PORT, () => {
      serverLogger.info(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    serverLogger.error("Erro ao configurar Minio Bucket", error);
  });

// Encerramento limpo
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export default app;
