// src/server.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import setupMinioBucket from "./config/setupMinio";
import { handleWebhook } from "./controllers/stripe.controller";
import { createUsersController } from "./controllers/user.controller";
import { prisma } from "./lib/prisma";
import dashboardRoutes from "./routes/dashboard.routes";
import instanceRoutes from "./routes/instance.routes";
import passwordRoutes from "./routes/password.routes";
import sessionRoutes from "./routes/session.routes";
import stripeRoutes from "./routes/stripe.routes";
import uploadRoutes from "./routes/upload.routes";
import userRoutes from "./routes/user.routes";
import warmupRoutes from "./routes/warmup.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

// Declarar servidor no escopo global
let server: ReturnType<typeof app.listen>;

// Configurações de CORS
app.use(
	cors({
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// webhook do Stripe ANTES dos parsers
app.post(
	"/api/stripe/webhook",
	express.raw({ type: "application/json" }),
	handleWebhook,
);

// Parsers
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ limit: "300mb", extended: true }));

// Rotas públicas
app.use("/api/session", sessionRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users/register", createUsersController);

// Rotas protegidas
app.use("/api/users", userRoutes);
app.use("/api/instances", instanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/warmup", warmupRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/upload", uploadRoutes);

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
