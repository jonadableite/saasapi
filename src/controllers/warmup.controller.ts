// src/controllers/warmup.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { warmupService } from "../services/warmup.service";
import type { MediaContent, WarmupConfig } from "../types/warmup";

interface TextContent {
  text: string;
}

// src/controllers/warmup.controller.ts

export const configureWarmup = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const config = req.body;
    const userId = (req as any).user?.id;

    console.log("Iniciando configuração de aquecimento:", {
      userId,
      instancesCount: config.phoneInstances?.length,
      textsCount: config.contents?.texts?.length,
      texts: config.contents?.texts,
    });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
    }

    // Validações básicas
    if (!config.phoneInstances?.length || config.phoneInstances.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Necessário pelo menos duas instâncias",
      });
    }

    if (!config.contents?.texts?.length) {
      return res.status(400).json({
        success: false,
        message: "Necessário pelo menos um texto",
      });
    }

    // Processar mídia
    const processMedia = (mediaArray: any[] = []): MediaContent[] => {
      return mediaArray
        .map((item) => {
          if (!item) return null;

          console.log("Processando item de mídia:", item);

          return {
            type: item.type as "image" | "video" | "audio" | "sticker",
            base64: typeof item === "string" ? item : item.base64,
            fileName: item.fileName || `file.${item.type}`,
            mimetype:
              item.type === "image"
                ? "image/jpeg"
                : item.type === "video"
                  ? "video/mp4"
                  : item.type === "audio"
                    ? "audio/mp3"
                    : "image/webp",
            preview: item.preview,
          };
        })
        .filter(Boolean) as MediaContent[];
    };

    // Preparar configuração final
    const warmupConfig: WarmupConfig = {
      userId, // Removido Number(), mantendo como string
      phoneInstances: config.phoneInstances,
      contents: {
        texts: config.contents.texts.map((text: string | TextContent) =>
          typeof text === "string" ? text : text.text,
        ),
        images: processMedia(config.contents.images),
        audios: processMedia(config.contents.audios),
        videos: processMedia(config.contents.videos),
        stickers: processMedia(config.contents.stickers),
        emojis: config.contents.emojis || [
          "👍",
          "❤️",
          "😂",
          "😮",
          "😢",
          "🙏",
          "👏",
          "🔥",
        ],
      },
      config: {
        textChance: config.config.textChance || 0.8,
        audioChance: config.config.audioChance || 0.3,
        reactionChance: config.config.reactionChance || 0.4,
        stickerChance: config.config.stickerChance || 0.2,
        imageChance: config.config.imageChance || 0.3,
        videoChance: config.config.videoChance || 0.1,
        minDelay: config.config.minDelay || 3000,
        maxDelay: config.config.maxDelay || 90000,
      },
    };

    // Iniciar o warmup
    await warmupService.startWarmup(warmupConfig);

    // Aguardar um momento para garantir que o status foi atualizado
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verificar o status atual
    const status = await prisma.warmupStats.findMany({
      where: {
        userId,
        status: "active",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Aquecimento iniciado com sucesso",
      isActive: status.length > 0,
    });
  } catch (error) {
    console.error("Erro ao configurar aquecimento:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro ao configurar aquecimento",
    });
  }
};

// Parar aquecimento específico
export const stopWarmup = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const userId = (req as any).user?.id;
    const { instanceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
    }

    if (!instanceId) {
      return res.status(400).json({
        success: false,
        message: "ID da instância não fornecido",
      });
    }

    await warmupService.stopWarmup(instanceId);

    return res.status(200).json({
      success: true,
      message: "Aquecimento parado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao parar aquecimento:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro ao parar aquecimento",
    });
  }
};

// Parar todos os aquecimentos
export const stopAllWarmups = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
    }

    // Parar o serviço de aquecimento
    await warmupService.stopAll();

    // Atualizar todas as instâncias do usuário para status pausado
    await prisma.warmupStats.updateMany({
      where: {
        userId: userId,
      },
      data: {
        status: "paused",
        pauseTime: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Todos os aquecimentos foram parados",
    });
  } catch (error) {
    console.error("Erro ao parar aquecimentos:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro ao parar aquecimentos",
    });
  }
};

// Verificar status do aquecimento
export const getWarmupStats = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const userId = (req as any).user?.id;
    const { instanceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
    }

    if (!instanceId) {
      return res.status(400).json({
        success: false,
        message: "ID da instância não fornecido",
      });
    }

    const stats = await prisma.warmupStats.findUnique({
      where: { instanceName: instanceId },
      include: {
        mediaStats: true,
        mediaReceived: true,
      },
    });

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Estatísticas não encontradas",
      });
    }

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Erro ao obter estatísticas",
    });
  }
};

// src/controllers/warmup.controller.ts
export const getWarmupStatus = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
    }

    // Buscar todas as instâncias ativas do usuário
    const activeInstances = await prisma.warmupStats.findMany({
      where: {
        userId,
      },
      select: {
        instanceName: true,
        status: true,
        lastActive: true,
      },
    });

    // Mapear os status das instâncias
    const instanceStatuses = activeInstances.reduce(
      (acc, instance) => {
        acc[instance.instanceName] = {
          status: instance.status,
          lastActive: instance.lastActive,
        };
        return acc;
      },
      {} as Record<string, { status: string; lastActive: Date }>,
    );

    return res.status(200).json({
      success: true,
      instances: instanceStatuses,
      // Se houver pelo menos uma instância ativa, considera o aquecimento ativo
      globalStatus: Object.values(instanceStatuses).some(
        (inst) => inst.status === "active",
      )
        ? "active"
        : "inactive",
    });
  } catch (error) {
    console.error("Erro ao obter status:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao obter status do aquecimento",
    });
  }
};
