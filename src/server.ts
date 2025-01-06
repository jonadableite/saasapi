// src/server.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { handleWebhook } from "./controllers/stripe.controller";
import { createUsersController } from "./controllers/user.controller";
import { prisma } from "./lib/prisma";
import { authMiddleware } from "./middlewares/authenticate";
import dashboardRoutes from "./routes/dashboard.routes";
import instanceRoutes from "./routes/instance.routes";
import passwordRoutes from "./routes/password.routes";
import sessionRoutes from "./routes/session.routes";
import stripeRoutes from "./routes/stripe.routes";
import userRoutes from "./routes/user.routes";
import warmupRoutes from "./routes/warmup.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

// Configurações de CORS
const corsOptions = {
	origin: "*",
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
};
app.use(cors(corsOptions));

// webhook do Stripe ANTES dos parsers
app.post(
	"/api/stripe/webhook",
	express.raw({ type: "application/json" }),
	handleWebhook,
);

// Aumentar o limite
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ limit: "300mb", extended: true }));

// Rotas públicas
app.use("/api/session", sessionRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users/register", createUsersController);

// Middleware de autenticação para rotas protegidas
app.use(authMiddleware);

// Rotas protegidas
app.use("/api/users", userRoutes);
app.use("/api/instances", instanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/warmup", warmupRoutes);
app.use("/api/stripe", stripeRoutes);

// Inicia o servidor
const server = app.listen(PORT, () => {
	console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Encerramento limpo do Prisma Client
const gracefulShutdown = async () => {
	console.log("Encerrando servidor...");
	await prisma.$disconnect();
	server.close(() => {
		console.log("Servidor encerrado.");
	});
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
