// seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

console.log("Script de seed sendo carregado...");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando script de seed...");

  // Dados do usuário administrador inicial
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com"; // Use variáveis de ambiente!
  const adminPassword = process.env.ADMIN_PASSWORD || "securepassword123"; // Use variáveis de ambiente!
  const adminName = process.env.ADMIN_NAME || "Administrator";

  // Verifique se já existe um usuário com este email para evitar duplicidade
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(
      `Usuário administrador com email ${adminEmail} já existe. Pulando criação.`,
    );
    return;
  }

  // Hashear a senha
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Criar uma empresa temporária para o administrador
  const tempCompany = await prisma.company.create({
    data: {
      name: `Empresa ${adminName}`,
      active: true,
    },
  });
  console.log(`Empresa temporária criada com ID: ${tempCompany.id}`);

  // Criar o usuário administrador
  const adminUser = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      phone: "", // Pode adicionar um telefone se necessário
      profile: "admin", // Ou o perfil que indica admin no seu sistema
      plan: "enterprise", // Ou um plano adequado para admin
      status: true,
      maxInstances: 999, // Limite alto para admin
      messagesPerDay: 9999, // Limite alto para admin
      features: ["ALL"], // Todas as features para admin
      support: "priority",
      trialEndDate: null, // Admins geralmente não têm trial
      whatleadCompanyId: tempCompany.id, // Associar à empresa temporária
      role: "admin", // Definir o papel como 'admin'
      referredBy: null,
      // evoAiUserId e evoAiClientId serão null inicialmente,
      // a menos que você queira sincronizar o admin com a Evo AI manualmente
    },
  });

  console.log(`Usuário administrador criado com sucesso: ${adminUser.email}`);
  console.log(`ID do usuário administrador: ${adminUser.id}`);
}

main()
  .catch((e) => {
    console.error("Erro durante o script de seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("Script de seed finalizado.");
  });
