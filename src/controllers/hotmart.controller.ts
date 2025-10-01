// src/controllers/hotmart.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();
const hotmartLogger = logger.setContext("HotmartController");

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
}
