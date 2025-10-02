// src/controllers/hotmart.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();
const hotmartLogger = logger.setContext("HotmartController");

// Cache para o token da Hotmart
let cachedHotmartToken: string | null = null;
let tokenExpirationTime: number = 0;

// Função para renovar o token da Hotmart
async function refreshHotmartToken(): Promise<string> {
  try {
    const clientId = process.env.HOTMART_CLIENT_ID;
    const clientSecret = process.env.HOTMART_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET são obrigatórios');
    }

    // Criar Basic Auth header
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: 'grant_type=client_credentials&scope=read'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao renovar token da Hotmart: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('Token de acesso não encontrado na resposta da Hotmart');
    }

    // Cache do token com tempo de expiração (expires_in em segundos)
    cachedHotmartToken = tokenData.access_token;
    tokenExpirationTime = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minuto de margem
    
    hotmartLogger.info('Token da Hotmart renovado com sucesso');
    
    return tokenData.access_token;
  } catch (error) {
    hotmartLogger.error('Erro ao renovar token da Hotmart:', error);
    throw error;
  }
}

// Função para obter token válido (usa cache ou renova se necessário)
async function getValidHotmartToken(): Promise<string> {
  // Se temos um token em cache e ainda não expirou, usa ele
  if (cachedHotmartToken && Date.now() < tokenExpirationTime) {
    return cachedHotmartToken;
  }
  
  // Tenta usar o token do .env primeiro
  const envToken = process.env.HOTMART_ACCESS_TOKEN;
  if (envToken && !cachedHotmartToken) {
    cachedHotmartToken = envToken;
    // Define um tempo de expiração padrão de 1 hora se não temos informação
    tokenExpirationTime = Date.now() + (3600 * 1000);
    return envToken;
  }
  
  // Se chegou aqui, precisa renovar o token
  return await refreshHotmartToken();
}

export interface HotmartWebhookData {
  id: string;
  event: string;
  version: string;
  date_created: number;
  data: {
    product: {
      id: number;
      name: string;
      ucode: string;
    };
    buyer: {
      name: string;
      email: string;
      checkout_phone: string;
      document: string;
    };
    affiliates?: Array<{
      name: string;
      email: string;
    }>;
    purchase: {
      order_date: number;
      price: {
        value: number;
        currency_value: string;
      };
      payment: {
        method: string;
        installments_number: number;
        type: string;
      };
      offer: {
        code: string;
        key: string;
      };
      transaction: string;
      status: string;
      approved_date?: number;
      subscription?: {
        subscriber: {
          code: string;
        };
        plan: {
          name: string;
          id: number;
        };
        status: string;
        date_next_charge?: number;
        charges_number?: number;
      };
    };
    commissions?: Array<{
      value: number;
      source: string;
    }>;
  };
}

export class HotmartController {
  // Webhook principal para processar todos os eventos da Hotmart
  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData: HotmartWebhookData = req.body;

      hotmartLogger.info(`Webhook Hotmart recebido: ${webhookData.event}`, {
        event: webhookData.event,
        transaction: webhookData.data.purchase.transaction,
        buyer_email: webhookData.data.buyer.email,
      });

      // Processar baseado no tipo de evento
      switch (webhookData.event) {
        // Eventos de Compras (9 eventos)
        case "PURCHASE_COMPLETE":
          await this.handlePurchaseComplete(webhookData);
          break;
        case "PURCHASE_APPROVED":
          await this.handlePurchaseApproved(webhookData);
          break;
        case "PURCHASE_CANCELED":
          await this.handlePurchaseCanceled(webhookData);
          break;
        case "PURCHASE_BILLED":
          await this.handlePurchaseBilled(webhookData);
          break;
        case "PURCHASE_REFUNDED":
          await this.handlePurchaseRefunded(webhookData);
          break;
        case "PURCHASE_CHARGEBACK":
          await this.handlePurchaseChargeback(webhookData);
          break;
        case "PURCHASE_DELAYED":
          await this.handlePurchaseDelayed(webhookData);
          break;
        case "PURCHASE_PROTEST":
          await this.handlePurchaseProtest(webhookData);
          break;
        case "PURCHASE_EXPIRED":
          await this.handlePurchaseExpired(webhookData);
          break;

        // Eventos de Assinaturas (3 eventos)
        case "SUBSCRIPTION_CANCELLATION":
          await this.handleSubscriptionCancellation(webhookData);
          break;
        case "SUBSCRIPTION_REACTIVATION":
          await this.handleSubscriptionReactivation(webhookData);
          break;
        case "SUBSCRIPTION_CHARGE_SUCCESS":
          await this.handleSubscriptionChargeSuccess(webhookData);
          break;

        // Outros eventos (1 evento)
        case "SWITCH_PLAN":
          await this.handleSwitchPlan(webhookData);
          break;

        default:
          hotmartLogger.warn(`Evento não processado: ${webhookData.event}`);
      }

      res.status(200).json({
        success: true,
        message: "Webhook processado com sucesso",
        event: webhookData.event,
      });
    } catch (error) {
      hotmartLogger.error("Erro ao processar webhook Hotmart:", error);
      res.status(200).json({
        success: false,
        message: "Erro ao processar webhook, mas reconhecido",
      });
    }
  };

  // Eventos de Compras
  private async handlePurchaseComplete(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_COMPLETE");
    await this.createOrUpdateCustomer(data);
  }

  private async handlePurchaseApproved(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_APPROVED - Liberando acesso");

    // Criar/atualizar cliente
    await this.createOrUpdateCustomer(data);

    // Liberar acesso à plataforma
    await this.grantPlatformAccess(data);
  }

  private async handlePurchaseCanceled(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_CANCELED - Removendo acesso");
    await this.revokePlatformAccess(data);
  }

  private async handlePurchaseBilled(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_BILLED");
    await this.createOrUpdateCustomer(data);
  }

  private async handlePurchaseRefunded(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_REFUNDED - Removendo acesso");
    await this.revokePlatformAccess(data);
  }

  private async handlePurchaseChargeback(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_CHARGEBACK - Removendo acesso");
    await this.revokePlatformAccess(data);
  }

  private async handlePurchaseDelayed(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_DELAYED - Suspendendo acesso");
    await this.suspendPlatformAccess(data);
  }

  private async handlePurchaseProtest(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_PROTEST");
    await this.createOrUpdateCustomer(data);
  }

  private async handlePurchaseExpired(data: HotmartWebhookData) {
    hotmartLogger.info("Processando PURCHASE_EXPIRED - Removendo acesso");
    await this.revokePlatformAccess(data);
  }

  // Eventos de Assinaturas
  private async handleSubscriptionCancellation(data: HotmartWebhookData) {
    hotmartLogger.info(
      "Processando SUBSCRIPTION_CANCELLATION - Cancelando assinatura"
    );
    await this.cancelSubscription(data);
  }

  private async handleSubscriptionReactivation(data: HotmartWebhookData) {
    hotmartLogger.info(
      "Processando SUBSCRIPTION_REACTIVATION - Reativando assinatura"
    );
    await this.reactivateSubscription(data);
  }

  private async handleSubscriptionChargeSuccess(data: HotmartWebhookData) {
    hotmartLogger.info(
      "Processando SUBSCRIPTION_CHARGE_SUCCESS - Renovando acesso"
    );
    await this.renewSubscription(data);
  }

  // Outros eventos
  private async handleSwitchPlan(data: HotmartWebhookData) {
    hotmartLogger.info("Processando SWITCH_PLAN - Alterando plano");
    await this.switchUserPlan(data);
  }

  // Métodos auxiliares para gerenciamento de usuários e acesso
  private async createOrUpdateCustomer(data: HotmartWebhookData) {
    try {
      const { buyer, purchase, product } = data.data;

      // Verificar se o cliente já existe
      let user = await prisma.user.findUnique({
        where: { email: buyer.email },
      });

      if (!user) {
        // Buscar uma empresa padrão ou criar uma temporária
        let defaultCompany = await prisma.company.findFirst({
          where: { active: true }
        });

        if (!defaultCompany) {
          defaultCompany = await prisma.company.create({
            data: {
              name: "Hotmart Default Company",
              active: true
            }
          });
        }

        // Criar novo usuário
        user = await prisma.user.create({
          data: {
            name: buyer.name,
            email: buyer.email,
            phone: buyer.checkout_phone || "",
            password: "", // Será definida pelo usuário no primeiro login
            profile: "user", // Perfil padrão
            plan: this.mapProductToPlan(product.name),
            isActive: purchase.status === "APPROVED",
            hotmartCustomerId: purchase.transaction,
            hotmartSubscriberCode: purchase.subscription?.subscriber.code,
            whatleadCompanyId: defaultCompany.id
          },
        });

        hotmartLogger.info(`Novo usuário criado: ${user.email}`);
      } else {
        // Atualizar usuário existente
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: this.mapProductToPlan(product.name),
            isActive: purchase.status === "APPROVED",
            hotmartCustomerId: purchase.transaction,
            hotmartSubscriberCode: purchase.subscription?.subscriber.code,
          },
        });

        hotmartLogger.info(`Usuário atualizado: ${user.email}`);
      }

      // Registrar transação
      await this.recordTransaction(data, user.id);
    } catch (error) {
      hotmartLogger.error("Erro ao criar/atualizar cliente:", error);
      throw error;
    }
  }

  private async grantPlatformAccess(data: HotmartWebhookData) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.data.buyer.email },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: true,
            plan: this.mapProductToPlan(data.data.product.name),
            subscriptionStatus: "ACTIVE",
          },
        });

        hotmartLogger.info(`Acesso liberado para: ${user.email}`);
      }
    } catch (error) {
      hotmartLogger.error("Erro ao liberar acesso:", error);
      throw error;
    }
  }

  private async revokePlatformAccess(data: HotmartWebhookData) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.data.buyer.email },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            subscriptionStatus: "CANCELLED",
          },
        });

        hotmartLogger.info(`Acesso removido para: ${user.email}`);
      }
    } catch (error) {
      hotmartLogger.error("Erro ao remover acesso:", error);
      throw error;
    }
  }

  private async suspendPlatformAccess(data: HotmartWebhookData) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.data.buyer.email },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            subscriptionStatus: "SUSPENDED",
          },
        });

        hotmartLogger.info(`Acesso suspenso para: ${user.email}`);
      }
    } catch (error) {
      hotmartLogger.error("Erro ao suspender acesso:", error);
      throw error;
    }
  }

  private async cancelSubscription(data: HotmartWebhookData) {
    await this.revokePlatformAccess(data);
  }

  private async reactivateSubscription(data: HotmartWebhookData) {
    await this.grantPlatformAccess(data);
  }

  private async renewSubscription(data: HotmartWebhookData) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.data.buyer.email },
      });

      if (user) {
        const nextChargeDate =
          data.data.purchase.subscription?.date_next_charge;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: true,
            subscriptionStatus: "ACTIVE",
            subscriptionEndDate: nextChargeDate
              ? new Date(nextChargeDate * 1000)
              : null,
          },
        });

        hotmartLogger.info(`Assinatura renovada para: ${user.email}`);
      }

      // Registrar transação de renovação
      await this.recordTransaction(data, user?.id);
    } catch (error) {
      hotmartLogger.error("Erro ao renovar assinatura:", error);
      throw error;
    }
  }

  private async switchUserPlan(data: HotmartWebhookData) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.data.buyer.email },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: this.mapProductToPlan(data.data.product.name),
            isActive: true,
          },
        });

        hotmartLogger.info(
          `Plano alterado para: ${user.email} - Novo plano: ${data.data.product.name}`
        );
      }
    } catch (error) {
      hotmartLogger.error("Erro ao alterar plano:", error);
      throw error;
    }
  }

  private async recordTransaction(data: HotmartWebhookData, userId?: string) {
    try {
      if (!userId) return;

      await prisma.hotmartTransaction.create({
        data: {
          userId,
          transactionId: data.data.purchase.transaction,
          event: data.event,
          status: data.data.purchase.status,
          amount: data.data.purchase.price.value,
          currency: data.data.purchase.price.currency_value,
          productName: data.data.product.name,
          productId: data.data.product.id.toString(),
          buyerEmail: data.data.buyer.email,
          buyerName: data.data.buyer.name,
          orderDate: new Date(data.data.purchase.order_date * 1000),
          approvedDate: data.data.purchase.approved_date
            ? new Date(data.data.purchase.approved_date * 1000)
            : null,
          paymentMethod: data.data.purchase.payment.method,
          installments: data.data.purchase.payment.installments_number,
          subscriberCode: data.data.purchase.subscription?.subscriber.code,
          planName: data.data.purchase.subscription?.plan.name,
          nextChargeDate: data.data.purchase.subscription?.date_next_charge
            ? new Date(data.data.purchase.subscription.date_next_charge * 1000)
            : null,
          rawData: JSON.stringify(data),
        },
      });

      hotmartLogger.info(
        `Transação registrada: ${data.data.purchase.transaction}`
      );
    } catch (error) {
      hotmartLogger.error("Erro ao registrar transação:", error);
    }
  }

  private mapProductToPlan(productName: string): string {
    // Mapear produtos da Hotmart para planos da plataforma
    const planMapping: { [key: string]: string } = {
      "Whatlead - Disparos": "PREMIUM",
      "Whatlead - Básico": "BASIC",
      "Whatlead - Pro": "PRO",
      "Whatlead - Enterprise": "ENTERPRISE",
    };

    return planMapping[productName] || "BASIC";
  }

  // Métodos para o painel administrativo
  public getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        paymentStatus = "",
      } = req.query;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { hotmartCustomerId: { contains: search as string, mode: "insensitive" } },
          { hotmartSubscriberCode: { contains: search as string, mode: "insensitive" } },
          { 
            hotmartTransactions: {
              some: {
                transactionId: { contains: search as string, mode: "insensitive" }
              }
            }
          },
        ];
      }

      if (status) {
        where.subscriptionStatus = status;
      }

      const users = await prisma.user.findMany({
        where: {
          ...where,
          hotmartCustomerId: { not: null },
        },
        include: {
          hotmartTransactions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.user.count({
        where: {
          ...where,
          hotmartCustomerId: { not: null },
        },
      });

      // Transformar os dados para o formato esperado pelo frontend
      const customers = users.map(user => {
        const latestTransaction = user.hotmartTransactions[0];
        
        return {
          id: user.id,
          subscriberCode: user.hotmartSubscriberCode || 'N/A',
          transaction: user.hotmartCustomerId || 'N/A',
          productId: latestTransaction?.productId || 'N/A',
          productName: latestTransaction?.productName || 'N/A',
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone || '',
          paymentType: latestTransaction?.paymentMethod || 'N/A',
          paymentMethod: latestTransaction?.paymentMethod || 'N/A',
          paymentStatus: latestTransaction?.status || 'N/A',
          subscriptionStatus: user.subscriptionStatus || 'ACTIVE',
          subscriptionValue: latestTransaction?.amount || 0,
          subscriptionCurrency: latestTransaction?.currency || 'BRL',
          subscriptionFrequency: latestTransaction?.planName || 'N/A',
          nextChargeDate: latestTransaction?.nextChargeDate?.toISOString() || null,
          isActive: user.isActive || false,
          isTrial: false,
          tags: [],
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          hotmartTransactions: user.hotmartTransactions
        };
      });

      res.json({
        customers,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (error) {
      hotmartLogger.error("Erro ao buscar clientes:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  public getCustomerStats = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const totalCustomers = await prisma.user.count({
        where: { hotmartCustomerId: { not: null } },
      });

      const activeCustomers = await prisma.user.count({
        where: {
          hotmartCustomerId: { not: null },
          isActive: true,
        },
      });

      const totalRevenue = await prisma.hotmartTransaction.aggregate({
        _sum: { amount: true },
        where: { status: "APPROVED" },
      });

      const cancelledCustomers = await prisma.user.count({
        where: {
          hotmartCustomerId: { not: null },
          subscriptionStatus: "CANCELLED",
        },
      });

      const churnRate =
        totalCustomers > 0 ? (cancelledCustomers / totalCustomers) * 100 : 0;

      res.json({
        totalCustomers,
        activeCustomers,
        totalRevenue: totalRevenue._sum.amount || 0,
        churnRate,
      });
    } catch (error) {
      hotmartLogger.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  public exportCustomers = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { search = "", status = "" } = req.query;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
        ];
      }

      if (status) {
        where.subscriptionStatus = status;
      }

      const customers = await prisma.user.findMany({
        where: {
          ...where,
          hotmartCustomerId: { not: null },
        },
        include: {
          hotmartTransactions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Gerar CSV
      const csvHeader =
        "Nome,Email,Plano,Status,Data Cadastro,Último Pagamento,Valor\n";
      const csvData = customers
        .map((customer) => {
          const lastTransaction = customer.hotmartTransactions[0];
          return [
            customer.name,
            customer.email,
            customer.plan,
            customer.subscriptionStatus || "N/A",
            customer.createdAt.toISOString().split("T")[0],
            lastTransaction?.orderDate.toISOString().split("T")[0] || "N/A",
            lastTransaction?.amount || 0,
          ].join(",");
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=hotmart-customers.csv"
      );
      res.send(csvHeader + csvData);
    } catch (error) {
      hotmartLogger.error("Erro ao exportar clientes:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  public syncWithHotmart = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Implementar sincronização manual se necessário
      // Por enquanto, retornar sucesso
      res.json({
        success: true,
        syncedCount: 0,
        message: "Sincronização via webhook ativa",
      });
    } catch (error) {
      hotmartLogger.error("Erro na sincronização:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  // Novos métodos para integração com API de vendas da Hotmart
  public getSalesHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        start_date,
        end_date,
        product_id,
        buyer_email,
        transaction_status,
        max_results = 50,
        page_token
      } = req.query;

      // Validação de parâmetros obrigatórios
      if (!start_date || !end_date) {
        res.status(400).json({
          error: "Parâmetros start_date e end_date são obrigatórios"
        });
        return;
      }

      // Obter token válido (renovando se necessário)
      const hotmartToken = await getValidHotmartToken();

      // Construir URL da Hotmart
      const baseUrl = process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1';
      let apiUrl = `${baseUrl}/sales/history?start_date=${start_date}&end_date=${end_date}`;
      
      if (product_id) apiUrl += `&product_id=${product_id}`;
      if (buyer_email) apiUrl += `&buyer_email=${buyer_email}`;
      if (transaction_status) apiUrl += `&transaction_status=${transaction_status}`;
      if (max_results) apiUrl += `&max_results=${max_results}`;
      if (page_token) apiUrl += `&page_token=${page_token}`;

      hotmartLogger.info(`Fazendo requisição para Hotmart: ${apiUrl}`);

      // Fazer requisição para API da Hotmart com retry em caso de token inválido
      let response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hotmartToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Se receber 401, tenta renovar o token e fazer nova requisição
      if (response.status === 401) {
        hotmartLogger.info('Token expirado, renovando...');
        const newToken = await refreshHotmartToken();
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        hotmartLogger.error(`Erro na API da Hotmart: ${response.status} - ${errorText}`);
        throw new Error(`Erro na API da Hotmart: ${response.status} - ${errorText}`);
      }

      const salesData = await response.json();

      hotmartLogger.info(`Histórico de vendas recuperado: ${salesData.items?.length || 0} itens`);
      
      res.json({
        success: true,
        data: salesData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      hotmartLogger.error("Erro ao buscar histórico de vendas:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  public getSalesSummary = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        start_date,
        end_date,
        product_id,
        currency_code
      } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          error: "Parâmetros start_date e end_date são obrigatórios"
        });
        return;
      }

      const baseUrl = process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1';
      let apiUrl = `${baseUrl}/sales/summary?start_date=${start_date}&end_date=${end_date}`;
      
      if (product_id) apiUrl += `&product_id=${product_id}`;
      if (currency_code) apiUrl += `&currency_code=${currency_code}`;

      // Obter token válido (renovando se necessário)
      const hotmartToken = await getValidHotmartToken();

      let response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hotmartToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Se receber 401, tenta renovar o token e fazer nova requisição
      if (response.status === 401) {
        hotmartLogger.info('Token expirado, renovando...');
        const newToken = await refreshHotmartToken();
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        throw new Error(`Erro na API da Hotmart: ${response.status}`);
      }

      const summaryData = await response.json();

      hotmartLogger.info("Sumário de vendas recuperado com sucesso");
      
      res.json({
        success: true,
        data: summaryData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      hotmartLogger.error("Erro ao buscar sumário de vendas:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  public getSalesUsers = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        start_date,
        end_date,
        product_id,
        buyer_email,
        max_results = 50,
        page_token
      } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          error: "Parâmetros start_date e end_date são obrigatórios"
        });
        return;
      }

      const baseUrl = process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1';
      let apiUrl = `${baseUrl}/sales/users?start_date=${start_date}&end_date=${end_date}`;
      
      if (product_id) apiUrl += `&product_id=${product_id}`;
      if (buyer_email) apiUrl += `&buyer_email=${buyer_email}`;
      if (max_results) apiUrl += `&max_results=${max_results}`;
      if (page_token) apiUrl += `&page_token=${page_token}`;

      // Obter token válido (renovando se necessário)
      const hotmartToken = await getValidHotmartToken();

      let response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hotmartToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Se receber 401, tenta renovar o token e fazer nova requisição
      if (response.status === 401) {
        hotmartLogger.info('Token expirado, renovando...');
        const newToken = await refreshHotmartToken();
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        throw new Error(`Erro na API da Hotmart: ${response.status}`);
      }

      const usersData = await response.json();

      hotmartLogger.info(`Participantes de vendas recuperados: ${usersData.items?.length || 0} itens`);
      
      res.json({
        success: true,
        data: usersData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      hotmartLogger.error("Erro ao buscar participantes de vendas:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  public getSalesCommissions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        start_date,
        end_date,
        product_id,
        max_results = 50,
        page_token
      } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          error: "Parâmetros start_date e end_date são obrigatórios"
        });
        return;
      }

      const baseUrl = process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1';
      let apiUrl = `${baseUrl}/sales/commissions?start_date=${start_date}&end_date=${end_date}`;
      
      if (product_id) apiUrl += `&product_id=${product_id}`;
      if (max_results) apiUrl += `&max_results=${max_results}`;
      if (page_token) apiUrl += `&page_token=${page_token}`;

      // Obter token válido (renovando se necessário)
      const hotmartToken = await getValidHotmartToken();

      let response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hotmartToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Se receber 401, tenta renovar o token e fazer nova requisição
      if (response.status === 401) {
        hotmartLogger.info('Token expirado, renovando...');
        const newToken = await refreshHotmartToken();
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        throw new Error(`Erro na API da Hotmart: ${response.status}`);
      }

      const commissionsData = await response.json();

      hotmartLogger.info(`Comissões de vendas recuperadas: ${commissionsData.items?.length || 0} itens`);
      
      res.json({
        success: true,
        data: commissionsData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      hotmartLogger.error("Erro ao buscar comissões de vendas:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  public getSalesPriceDetails = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        start_date,
        end_date,
        product_id,
        transaction_id,
        max_results = 50,
        page_token
      } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          error: "Parâmetros start_date e end_date são obrigatórios"
        });
        return;
      }

      const baseUrl = process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1';
      let apiUrl = `${baseUrl}/sales/price-details?start_date=${start_date}&end_date=${end_date}`;
      
      if (product_id) apiUrl += `&product_id=${product_id}`;
      if (transaction_id) apiUrl += `&transaction_id=${transaction_id}`;
      if (max_results) apiUrl += `&max_results=${max_results}`;
      if (page_token) apiUrl += `&page_token=${page_token}`;

      // Obter token válido (renovando se necessário)
      const hotmartToken = await getValidHotmartToken();

      let response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hotmartToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Se receber 401, tenta renovar o token e fazer nova requisição
      if (response.status === 401) {
        hotmartLogger.info('Token expirado, renovando...');
        const newToken = await refreshHotmartToken();
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        throw new Error(`Erro na API da Hotmart: ${response.status}`);
      }

      const priceDetailsData = await response.json();

      hotmartLogger.info(`Detalhes de preços recuperados: ${priceDetailsData.items?.length || 0} itens`);
      
      res.json({
        success: true,
        data: priceDetailsData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      hotmartLogger.error("Erro ao buscar detalhes de preços:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };
}
