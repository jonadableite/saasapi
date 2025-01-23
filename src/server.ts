// src/server.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import cron from "node-cron";
import setupMinioBucket from "./config/setupMinio";
import { handleWebhook } from "./controllers/stripe.controller";
import { createUsersController } from "./controllers/user.controller";
import { prisma } from "./lib/prisma";
import { authMiddleware } from "./middlewares/authenticate";
import { errorHandler } from "./middlewares/errorHandler";
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
import reportsRoutes from "./routes/reports.routes";
import sessionRoutes from "./routes/session.routes";
import stripeRoutes from "./routes/stripe.routes";
import uploadRoutes from "./routes/upload.routes";
import userRoutes from "./routes/user.routes";
import warmupRoutes from "./routes/warmup.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { campaignService } from "./services/campaign.service";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

let server: ReturnType<typeof app.listen>;

// Middleware de erro deve ser o último
app.use(errorHandler);

// Configurações de CORS
app.use(
	cors({
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// Rotas que precisam do body raw (antes dos parsers)
app.post(
	"/api/stripe/webhook",
	express.raw({ type: "application/json" }),
	handleWebhook,
);

// Parsers
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ limit: "300mb", extended: true }));

// Rotas públicas (sem autenticação)
app.use("/webhook", webhookRoutes); // Rotas de webhook da Evolution
app.use("/api/session", sessionRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users/register", createUsersController);

// Middleware de autenticação para todas as rotas protegidas
app.use("/api", authMiddleware);

// Rotas protegidas (com autenticação)
app.use("/api/leads", leadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/instances", instanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/warmup", warmupRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/campaigns", campaignLeadRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/campaigns", campaignDispatcherRoutes);
app.use("/api/scheduler", campaignSchedulerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/dashboards", dashboardsRoutes);
app.use("/api/message-logs", messageLogRoutes);

// Executar processamento de mensagens não lidas a cada hora
cron.schedule("0 * * * *", async () => {
	console.log("Processando mensagens não lidas...");
	await campaignService.processUnreadMessages();
});

// Executar segmentação de leads diariamente às 00:00
cron.schedule("0 0 * * *", async () => {
	console.log("Segmentando leads...");
	await campaignService.segmentLeads();
});

// Função de encerramento limpo
async function gracefulShutdown() {
	console.log("Encerrando servidor...");
	await prisma.$disconnect();
	if (server) {
		server.close(() => {
			console.log("Servidor encerrado.");
			process.exit(0);
		});
	} else {
		process.exit(0);
	}
}
process.env.TZ = "America/Sao_Paulo";

// Inicia o servidor
setupMinioBucket().then(() => {
	server = app.listen(PORT, () => {
		console.log(`🚀 Servidor rodando na porta ${PORT}`);
	});
});

// Encerramento limpo
process.on("SIGTERM", () => gracefulShutdown());
process.on("SIGINT", () => gracefulShutdown());

export default app;
