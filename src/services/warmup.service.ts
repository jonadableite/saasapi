import { EventEmitter } from "events";
// src/services/warmup.service.ts
import axios from "axios";
import { PLAN_LIMITS } from "../constants/planLimits";
import { prisma } from "../lib/prisma";
import type { MessageType } from "../types/messageTypes";
import type { MediaContent, WarmupConfig } from "../types/warmup";

const URL_API = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

interface ApiError {
	response?: {
		data?: any;
	};
	message?: string;
}

interface SendMessageConfig {
	endpoint: string;
	payload: any;
	delay: number;
}

interface MediaStats {
	id: string;
	instanceName: string;
	text: number;
	image: number;
	video: number;
	audio: number;
	sticker: number;
	reaction: number;
	totalDaily: number;
	totalAllTime: number;
	totalSent: number;
	totalReceived: number;
	date: Date;
}

interface WarmupStats {
	instanceName: string;
	status: string;
	startTime: Date;
	pauseTime?: Date;
	warmupTime?: number;
	progress?: number;
	lastActive?: Date;
	userId: string;
	mediaStatsId: string;
	mediaReceivedId: string;
}

interface MediaPayload {
	number: string;
	mediatype?: string;
	media?: string;
	audio?: string;
	sticker?: string;
	text?: string;
	caption?: string;
	fileName?: string;
	mimetype?: string;
	delay?: number;
	encoding?: boolean;
	options?: {
		delay: number;
		linkPreview: boolean;
	};
}

interface ReactionPayload {
	key: {
		remoteJid: string;
		fromMe: boolean;
		id: string;
	};
	reaction: string;
}

interface PhoneInstance {
	instanceId: string;
	phoneNumber: string;
}

interface ApiResponse {
	key: {
		remoteJid: string;
		fromMe: boolean;
		id: string;
		participant?: string;
	};
	pushName: string;
	status: string;
	message: {
		conversation?: string;
		imageMessage?: any;
		videoMessage?: any;
		audioMessage?: any;
		stickerMessage?: any;
		reactionMessage?: any;
		messageContextInfo?: any;
	};
	contextInfo?: any;
	messageType: string;
	messageTimestamp: number;
	instanceId: string;
	source: string;
}

export class WarmupService {
	private activeInstances: Map<string, NodeJS.Timeout>;
	private stop: boolean;
	private eventEmitter: EventEmitter;

	constructor() {
		this.activeInstances = new Map();
		this.stop = false;
		this.eventEmitter = new EventEmitter();
		this.eventEmitter.setMaxListeners(20);
	}

	async startWarmup(config: WarmupConfig): Promise<void> {
		this.stop = false;

		const warmupPromises = config.phoneInstances.map(async (instance) => {
			await this.startInstanceTimer(instance.instanceId, config.userId);
			await this.startInstanceWarmup(instance, config);
		});

		await Promise.all(warmupPromises);
	}

	private async checkDailyMessageLimit(
		instanceId: string,
		userId: string,
	): Promise<boolean> {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					plan: true,
					instances: {
						where: {
							instanceName: instanceId,
						},
					},
				},
			});

			if (!user) {
				console.error(`Usuário ${userId} não encontrado`);
				return false;
			}

			if (user.plan !== "free") {
				return true; // Usuários de planos pagos não têm limite.
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const stats = await prisma.mediaStats.findFirst({
				where: {
					instanceName: instanceId,
					date: {
						gte: today,
						lt: tomorrow,
					},
				},
				select: { totalDaily: true },
			});

			const totalMessages = stats?.totalDaily || 0;

			if (totalMessages >= 20) {
				console.log(`
				Limite diário de mensagens atingido para a instância ${instanceId}
				Total de mensagens hoje: ${totalMessages}
			`);

				await prisma.warmupStats.updateMany({
					where: {
						instanceName: instanceId,
						status: "active",
					},
					data: {
						status: "paused",
						pauseTime: new Date(),
					},
				});

				return false;
			}

			console.log(`
			Status do limite diário para a instância ${instanceId}:
			- Mensagens enviadas hoje: ${totalMessages}
			- Mensagens restantes: ${20 - totalMessages}
		`);

			return true;
		} catch (error) {
			console.error("Erro ao verificar limite diário:", {
				instanceId,
				error,
			});
			return false;
		}
	}

	private validateSticker(content: MediaContent): boolean {
		if (!content.base64) {
			console.error("Sticker sem conteúdo base64");
			return false;
		}

		if (!content.mimetype?.includes("webp")) {
			console.error("Sticker com formato inválido. Deve ser webp");
			return false;
		}

		// Estimativa do tamanho em bytes do base64 (base64 é aproximadamente 33% maior que o binário original)
		const base64Size = content.base64.length * 1.0; // Ajuste para 0.75 se necessário
		if (base64Size > 10000000) {
			// Limite de 10MB
			console.error("Sticker muito grande");
			return false;
		}

		return true;
	}

	private async startInstanceTimer(
		instanceId: string,
		userId: string,
	): Promise<void> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Buscar ou criar estatísticas do dia atual
		let mediaStats = await prisma.mediaStats.findFirst({
			where: {
				instanceName: instanceId,
				date: {
					gte: today,
					lt: tomorrow,
				},
			},
		});

		if (!mediaStats) {
			mediaStats = await prisma.mediaStats.create({
				data: {
					instanceName: instanceId,
					text: 0,
					image: 0,
					video: 0,
					audio: 0,
					sticker: 0,
					reaction: 0,
					totalDaily: 0,
					totalAllTime: 0,
					totalSent: 0,
					totalReceived: 0,
					date: today,
				},
			});
		}

		// Buscar ou criar estatísticas de recebimento do dia atual
		let mediaReceivedStats = await prisma.mediaStats.findFirst({
			where: {
				instanceName: instanceId,
				date: {
					gte: today,
					lt: tomorrow,
				},
				// Adicione uma condição para diferenciar das estatísticas de envio
				isReceived: true,
			},
		});

		if (!mediaReceivedStats) {
			mediaReceivedStats = await prisma.mediaStats.create({
				data: {
					instanceName: instanceId,
					text: 0,
					image: 0,
					video: 0,
					audio: 0,
					sticker: 0,
					reaction: 0,
					totalDaily: 0,
					totalAllTime: 0,
					totalSent: 0,
					totalReceived: 0,
					date: today,
					isReceived: true, // Marcar como estatísticas de recebimento
				},
			});
		}

		const stats = await prisma.warmupStats.upsert({
			where: { instanceName: instanceId },
			create: {
				instanceName: instanceId,
				status: "active",
				startTime: new Date(),
				userId: userId,
				mediaStatsId: mediaStats.id,
				mediaReceivedId: mediaReceivedStats.id,
			},
			update: {
				status: "active",
				startTime: new Date(),
				mediaStatsId: mediaStats.id,
				mediaReceivedId: mediaReceivedStats.id,
			},
		});

		const timer = setInterval(async () => {
			if (this.stop) {
				clearInterval(timer);
				return;
			}

			const currentStats = await prisma.warmupStats.findUnique({
				where: { instanceName: instanceId },
			});

			if (currentStats?.status === "active") {
				const newWarmupTime = (currentStats.warmupTime || 0) + 1;
				const progress = Math.min(
					Math.floor((newWarmupTime / (480 * 3600)) * 100),
					100,
				);

				await prisma.warmupStats.update({
					where: { instanceName: instanceId },
					data: {
						warmupTime: newWarmupTime,
						progress,
						lastActive: new Date(),
					},
				});
			}
		}, 1000);

		this.activeInstances.set(instanceId, timer);
	}

	private async resetDailyCounter(instanceId: string): Promise<void> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		await prisma.mediaStats.updateMany({
			where: {
				instanceName: instanceId,
				date: {
					lt: today,
				},
			},
			data: {
				totalDaily: 0,
				date: today,
			},
		});
	}

	private async updateMediaStats(
		instanceId: string,
		messageType: string,
		isSent: boolean,
	): Promise<void> {
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			// Buscar ou criar estatísticas do dia atual
			let mediaStats = await prisma.mediaStats.findFirst({
				where: {
					instanceName: instanceId,
					date: {
						gte: today,
						lt: tomorrow,
					},
				},
			});

			if (!mediaStats) {
				mediaStats = await prisma.mediaStats.create({
					data: {
						instanceName: instanceId,
						date: today,
						text: 0,
						image: 0,
						video: 0,
						audio: 0,
						sticker: 0,
						reaction: 0,
						totalDaily: 0,
						totalAllTime: 0,
						totalSent: 0,
						totalReceived: 0,
					},
				});
			}

			// Preparar dados para atualização
			const updateData: {
				[key: string]: any;
				totalDaily: { increment: number };
				totalAllTime: { increment: number };
				totalSent?: { increment: number };
				totalReceived?: { increment: number };
			} = {
				totalDaily: { increment: 1 },
				totalAllTime: { increment: 1 },
			};

			// Atualizar contadores de envio/recebimento
			if (isSent) {
				updateData.totalSent = { increment: 1 };
			} else {
				updateData.totalReceived = { increment: 1 };
			}

			// Atualizar contador específico do tipo de mensagem
			switch (messageType) {
				case "text":
				case "image":
				case "video":
				case "audio":
				case "sticker":
				case "reaction":
					updateData[messageType] = { increment: 1 };
					break;
				default:
					console.warn(`Tipo de mensagem desconhecido: ${messageType}`);
			}

			// Atualizar estatísticas no banco
			const updatedStats = await prisma.mediaStats.update({
				where: { id: mediaStats.id },
				data: updateData,
			});

			// Log das atualizações
			console.log(`Estatísticas atualizadas para ${instanceId}:`, {
				messageType,
				dailyTotal: updatedStats.totalDaily,
				allTimeTotal: updatedStats.totalAllTime,
				sent: updatedStats.totalSent,
				received: updatedStats.totalReceived,
				specificTypeCount:
					updatedStats[messageType as keyof typeof updatedStats],
			});

			// Verificar limite diário para plano free
			if (updatedStats.totalDaily >= 20) {
				const user = await prisma.user.findFirst({
					where: {
						instances: {
							some: {
								instanceName: instanceId,
							},
						},
					},
					select: {
						plan: true,
					},
				});

				if (user?.plan === "free") {
					console.log(`
          Limite diário atingido para instância ${instanceId}
          Total de mensagens hoje: ${updatedStats.totalDaily}
          Detalhamento:
          - Textos: ${updatedStats.text}
          - Imagens: ${updatedStats.image}
          - Vídeos: ${updatedStats.video}
          - Áudios: ${updatedStats.audio}
          - Stickers: ${updatedStats.sticker}
          - Reações: ${updatedStats.reaction}
        `);

					// Pausar o aquecimento automaticamente
					await prisma.warmupStats.update({
						where: { instanceName: instanceId },
						data: {
							status: "paused",
							pauseTime: new Date(),
						},
					});

					throw new Error(
						"Limite diário de mensagens atingido para plano free",
					);
				}
			}
		} catch (error) {
			console.error("Erro ao atualizar estatísticas:", {
				error,
				instanceId,
				messageType,
				isSent,
			});
			throw error;
		}
	}

	public async processReceivedMessage(
		instanceId: string,
		message: ApiResponse,
	): Promise<void> {
		try {
			const messageType = this.getMessageType(message);
			await this.updateMediaStats(instanceId, messageType, false);
		} catch (error) {
			console.error("Erro ao processar mensagem recebida:", error);
		}
	}

	private getMessageType(message: ApiResponse): string {
		if (message.message?.conversation) return "text";
		if (message.message?.imageMessage) return "image";
		if (message.message?.videoMessage) return "video";
		if (message.message?.audioMessage) return "audio";
		if (message.message?.stickerMessage) return "sticker";
		if (message.message?.reactionMessage) return "reaction";
		return "unknown";
	}

	async stopWarmup(instanceId: string): Promise<void> {
		const timer = this.activeInstances.get(instanceId);
		if (timer) {
			clearInterval(timer);
			this.activeInstances.delete(instanceId);
		}

		// Remove todos os listeners específicos desta instância
		this.eventEmitter.removeAllListeners();

		await prisma.warmupStats.update({
			where: { instanceName: instanceId },
			data: {
				status: "paused",
				pauseTime: new Date(),
			},
		});
	}

	async getInstanceStats(instanceId: string) {
		try {
			// Estatísticas do dia atual
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const dailyStats = await prisma.mediaStats.findFirst({
				where: {
					instanceName: instanceId,
					date: {
						gte: today,
						lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
					},
				},
			});

			// Totais gerais
			const totalStats = await prisma.mediaStats.aggregate({
				where: {
					instanceName: instanceId,
				},
				_sum: {
					totalAllTime: true,
					text: true,
					image: true,
					video: true,
					audio: true,
					sticker: true,
					reaction: true,
				},
			});

			return {
				daily: dailyStats || {
					text: 0,
					image: 0,
					video: 0,
					audio: 0,
					sticker: 0,
					reaction: 0,
					totalDaily: 0,
				},
				total: totalStats._sum,
			};
		} catch (error) {
			console.error("Erro ao obter estatísticas:", error);
			throw error;
		}
	}

	async stopAll(): Promise<void> {
		this.stop = true;
		for (const [instanceId, timer] of this.activeInstances.entries()) {
			clearInterval(timer);
			await prisma.warmupStats.update({
				where: { instanceName: instanceId },
				data: {
					status: "paused",
					pauseTime: new Date(),
				},
			});
		}
		this.activeInstances.clear();
	}

	private async startInstanceWarmup(
		instance: PhoneInstance,
		config: WarmupConfig,
	): Promise<void> {
		console.log(
			`Iniciando aquecimento para a instância ${instance.instanceId}`,
		);

		// Verificar plano do usuário
		const user = await prisma.user.findUnique({
			where: { id: config.userId },
			select: { plan: true },
		});

		if (!user) {
			throw new Error("Usuário não encontrado");
		}

		const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];

		// Validar tipos de mensagem conforme o plano
		const allowedTypes = planLimits.features as MessageType[];

		// Verifica se o usuário tem conteúdo disponível para enviar
		const availableContent = {
			text:
				Array.isArray(config.contents.texts) &&
				config.contents.texts.length > 0,
			audio:
				Array.isArray(config.contents.audios) &&
				config.contents.audios.length > 0,
			image:
				Array.isArray(config.contents.images) &&
				config.contents.images.length > 0,
			video:
				Array.isArray(config.contents.videos) &&
				config.contents.videos.length > 0,
			sticker:
				Array.isArray(config.contents.stickers) &&
				config.contents.stickers.length > 0,
		};

		// Filtrar tipos de mensagem permitidos pelo plano
		const filteredContentTypes = Object.keys(availableContent).filter(
			(type) => {
				const messageType = type.replace("Chance", "") as MessageType;
				return allowedTypes.includes(messageType);
			},
		);
		if (!filteredContentTypes.length) {
			console.log(
				"Nenhum conteúdo disponível para envio conforme o plano do usuário",
			);
			return;
		}

		// Adicionar um listener para mensagens recebidas
		const messageListener = (message: ApiResponse) => {
			if (!message.key.fromMe) {
				this.processReceivedMessage(instance.instanceId, message);
			}
		};

		// Registrar o listener
		this.eventEmitter.on("message", messageListener);

		while (!this.stop) {
			try {
				// Verificar limite diário antes de iniciar novo ciclo
				const canSendMessage = await this.checkDailyMessageLimit(
					instance.instanceId,
					config.userId,
				);
				if (!canSendMessage) {
					console.log("Limite diário atingido, pausando aquecimento...");
					await this.stopWarmup(instance.instanceId);
					break;
				}

				const stats = await prisma.warmupStats.findUnique({
					where: { instanceName: instance.instanceId },
				});

				if (stats?.status !== "active") {
					console.log(
						`Aquecimento para a instância ${instance.instanceId} foi pausado.`,
					);
					break;
				}

				for (const toInstance of config.phoneInstances) {
					if (this.stop || instance.instanceId === toInstance.instanceId)
						continue;

					try {
						const messageTypes = [
							{ type: "sticker", chance: 0.3 }, // 30% chance
							{ type: "audio", chance: 0.4 }, // 40% chance
							{ type: "text", chance: 0.3 }, // 30% chance
							{ type: "reaction", chance: 0.2 }, // 20% chance
							{ type: "image", chance: 0.1 }, // 10% chance
							{ type: "video", chance: 0.1 }, // 10% chance
						].filter(
							(t) => availableContent[t.type as keyof typeof availableContent],
						);

						if (messageTypes.length === 0) continue;

						const messageType = this.decideMessageType(config.config);
						if (!filteredContentTypes.includes(messageType)) {
							console.log(
								`Tipo de mensagem ${messageType} não permitido pelo plano`,
							);
							continue;
						}

						const randomValue = Math.random();
						let accumulatedChance = 0;
						let selectedType = messageTypes[0].type;

						for (const { type, chance } of messageTypes) {
							accumulatedChance += chance;
							if (randomValue <= accumulatedChance) {
								selectedType = type;
								break;
							}
						}

						// Simular comportamento humano
						switch (selectedType) {
							case "text":
								console.log(
									`Simulando digitação para ${toInstance.phoneNumber}...`,
								);
								await this.delay(2000, 5000);
								break;
							case "audio":
								console.log(
									`Simulando gravação de áudio para ${toInstance.phoneNumber}...`,
								);
								await this.delay(5000, 15000);
								break;
							case "image":
							case "video":
								console.log(
									`Simulando seleção de mídia para ${toInstance.phoneNumber}...`,
								);
								await this.delay(3000, 8000);
								break;
							case "sticker":
								console.log(
									`Simulando seleção de sticker para ${toInstance.phoneNumber}...`,
								);
								await this.delay(2000, 6000);
								break;
						}

						const content = this.getContentForType(
							selectedType,
							config.contents,
						);

						if (content) {
							console.log(
								`Enviando ${selectedType} para ${toInstance.phoneNumber}`,
							);

							const messageId = await this.sendMessage(
								instance.instanceId,
								toInstance.phoneNumber,
								content,
								selectedType,
								config.userId,
							);

							if (messageId) {
								console.log(`Mensagem ${selectedType} enviada com sucesso`);

								if (
									selectedType === "text" &&
									Math.random() < config.config.reactionChance
								) {
									console.log(`Aguardando para reagir à mensagem...`);
									await this.delay(2000, 4000);
									await this.sendReaction(
										instance.instanceId,
										toInstance.phoneNumber,
										messageId,
										config,
									);
								}

								console.log(`Aguardando antes da próxima mensagem...`);
								await this.delay(8000, 20000);
							}
						}
					} catch (error) {
						console.error(`Erro ao enviar mensagem:`, error);
						if (
							error instanceof Error &&
							error.message.includes("Limite diário")
						) {
							await this.stopWarmup(instance.instanceId);
							break;
						}
						await this.delay(10000, 20000);
					}
				}

				console.log(
					`Finalizando ciclo de mensagens, aguardando próximo ciclo...`,
				);
				await this.delay(15000, 30000);
			} catch (error) {
				console.error(`Erro no loop principal:`, error);
				if (error instanceof Error && error.message.includes("Limite diário")) {
					await this.stopWarmup(instance.instanceId);
					break;
				}
				await this.delay(20000, 40000);
			}
		}
	}

	private getMimeType(type: string): string {
		switch (type) {
			case "image":
				return "image/jpeg";
			case "video":
				return "video/mp4";
			case "audio":
				return "audio/mp3";
			case "sticker":
				return "image/webp";
			default:
				return "application/octet-stream";
		}
	}

	private async checkPlanLimits(
		instanceId: string,
		userId: string,
	): Promise<boolean> {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { plan: true },
		});

		if (!user) return false;

		const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];

		// Verifica limite diário de mensagens
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const messageCount = await prisma.mediaStats.findFirst({
			where: {
				instanceName: instanceId,
				date: {
					gte: today,
				},
			},
		});

		if ((messageCount?.totalDaily || 0) >= planLimits.messagesPerDay) {
			console.log(`Limite diário atingido para instância ${instanceId}`);
			await this.stopWarmup(instanceId);
			return false;
		}

		return true;
	}

	private async sendMessage(
		instanceId: string,
		to: string,
		content: any,
		messageType: string,
		userId: string,
	): Promise<string | false> {
		try {
			const canSend = await this.checkPlanLimits(instanceId, userId);
			if (!canSend) {
				throw new Error("Limite do plano atingido");
			}

			const formattedNumber = to.replace("@s.whatsapp.net", "");
			const config = this.createMessageConfig(
				instanceId,
				formattedNumber,
				content,
				messageType,
			);

			console.log(`\n=== Iniciando envio de ${messageType} ===`);
			console.log(`Instância: ${instanceId}`);
			console.log(`Destinatário: ${formattedNumber}`);
			console.log(`Endpoint: ${config.endpoint}`);
			console.log("Payload:", {
				...config.payload,
				media: config.payload.media ? "[BASE64]" : undefined,
				audio: config.payload.audio ? "[BASE64]" : undefined,
				sticker: config.payload.sticker ? "[BASE64]" : undefined,
			});

			await this.delay(config.delay, config.delay + 1000);

			const response = await axios.post<ApiResponse>(
				config.endpoint,
				config.payload,
				{
					headers: {
						"Content-Type": "application/json",
						apikey: API_KEY,
					},
				},
			);

			if (response.data?.key?.id) {
				console.log(`Mensagem ${messageType} enviada com sucesso`);
				await this.updateMediaStats(instanceId, messageType, true);
				return response.data.key.id;
			}

			console.error(
				`Falha ao enviar ${messageType}: Resposta inválida`,
				response.data,
			);
			return false;
		} catch (error) {
			const apiError = error as ApiError;
			console.error(`Erro ao enviar ${messageType}:`, {
				error:
					apiError.response?.data || apiError.message || "Erro desconhecido",
				instanceId,
				to,
				messageType,
			});
			return false;
		}
	}

	private createMessageConfig(
		instanceId: string,
		formattedNumber: string,
		content: any,
		messageType: string,
	): SendMessageConfig {
		const isMedia = typeof content === "object";
		const config: SendMessageConfig = {
			endpoint: "",
			payload: {},
			delay: 1000,
		};

		if (isMedia && content) {
			const mediaContent = content as MediaContent;

			if (messageType === "sticker") {
				config.endpoint = `${URL_API}/message/sendSticker/${instanceId}`;
				config.delay = Math.floor(Math.random() * 2000) + 1000;
				config.payload = {
					number: formattedNumber,
					sticker: mediaContent.base64,
					delay: config.delay,
				};
			} else if (messageType === "image" || messageType === "video") {
				config.endpoint = `${URL_API}/message/sendMedia/${instanceId}`;
				const base64Length = mediaContent.base64?.length || 0;
				config.delay = Math.min(5000, Math.floor(base64Length / 1000) + 2000);
				config.payload = {
					number: formattedNumber,
					mediatype: messageType,
					media: mediaContent.base64,
					mimetype: mediaContent.mimetype,
					fileName: mediaContent.fileName,
					caption: mediaContent.caption,
					delay: config.delay,
				};
			} else if (messageType === "audio") {
				config.endpoint = `${URL_API}/message/sendWhatsAppAudio/${instanceId}`;
				config.delay = Math.floor(Math.random() * 10000) + 5000;
				config.payload = {
					number: formattedNumber,
					audio: mediaContent.base64,
					encoding: true,
					delay: config.delay,
				};
			}
		} else {
			config.endpoint = `${URL_API}/message/sendText/${instanceId}`;
			const textLength = (content as string).length;
			config.delay = Math.min(8000, Math.floor(textLength * 100) + 2000);
			config.payload = {
				number: formattedNumber,
				text: content,
				delay: config.delay,
				linkPreview: true,
			};
		}

		return config;
	}

	// Função auxiliar para extrair o ID da mensagem de forma segura
	private getMessageId(response: any): string | undefined {
		return response?.data?.key?.id || response?.key?.id;
	}

	private async sendReaction(
		instanceId: string,
		to: string,
		messageId: string,
		config: WarmupConfig,
	): Promise<boolean> {
		try {
			const reaction = this.getRandomItem(config.contents.emojis);
			const payload = {
				key: {
					remoteJid: `${to}@s.whatsapp.net`,
					fromMe: true,
					id: messageId,
				},
				reaction: reaction,
			};

			// Log do payload
			console.log(`Enviando reação para mensagem ${messageId}:`, payload);

			await axios.post(
				`${URL_API}/message/sendReaction/${instanceId}`,
				payload,
				{
					headers: {
						"Content-Type": "application/json",
						apikey: API_KEY,
					},
				},
			);

			await this.updateMediaStats(instanceId, "reaction", true);
			return true;
		} catch (error) {
			const apiError = error as ApiError;
			console.error(`Erro ao enviar reação:`, {
				error:
					apiError.response?.data || apiError.message || "Erro desconhecido",
				payload: {
					messageId,
					to,
					instanceId,
				},
			});
			return false;
		}
	}

	private async sendRandomMedia(
		instanceId: string,
		to: string,
		config: WarmupConfig,
	): Promise<void> {
		const mediaTypes = ["image", "audio", "video", "sticker"];

		for (const type of mediaTypes) {
			const contentType = type as keyof typeof config.contents;
			if (
				config.contents[contentType]?.length > 0 &&
				Math.random() < (config.config as any)[`${type}Chance`]
			) {
				const content = await this.getContentForType(type, config.contents);
				if (content) {
					await this.sendMessage(
						instanceId,
						to,
						content,
						type,
						config.userId || "",
					);
				}
			}
		}
	}

	private getContentForType(
		type: string,
		contents: WarmupConfig["contents"],
	): string | MediaContent | null {
		try {
			const contentArray = contents[`${type}s` as keyof typeof contents];
			if (
				!contentArray ||
				!Array.isArray(contentArray) ||
				contentArray.length === 0
			) {
				console.log(`Nenhum conteúdo disponível para ${type}`);
				return null;
			}

			const content = this.getRandomItem(contentArray);

			if (type === "text") {
				return content as string;
			}

			if (typeof content === "object" && "base64" in content) {
				return {
					type: type as "image" | "video" | "audio" | "sticker",
					base64: content.base64,
					fileName: content.fileName || `file.${type}`,
					mimetype: content.mimetype || this.getMimeType(type),
				};
			}

			return null;
		} catch (error) {
			console.error(`Erro ao obter conteúdo para ${type}:`, error);
			return null;
		}
	}

	private getRandomItem<T>(items: T[]): T {
		if (!items || items.length === 0) {
			throw new Error("Array vazio ou indefinido");
		}
		return items[Math.floor(Math.random() * items.length)];
	}

	private async delay(min: number, max: number): Promise<void> {
		const baseDelay = Math.floor(Math.random() * (max - min + 1)) + min;
		const variation = Math.floor(Math.random() * 1000);
		const finalDelay = baseDelay + variation;
		return new Promise((resolve) => setTimeout(resolve, finalDelay));
	}

	private decideMessageType(config: WarmupConfig["config"]): string {
		const random = Math.random();
		const chances = [
			{ type: "text", chance: 0.35 }, // 35% chance
			{ type: "audio", chance: 0.35 }, // 35% chance
			{ type: "sticker", chance: 0.2 }, // 20% chance
			{ type: "image", chance: 0.05 }, // 5% chance
			{ type: "video", chance: 0.05 }, // 5% chance
		];

		let accumulated = 0;
		for (const { type, chance } of chances) {
			accumulated += chance;
			if (random <= accumulated) {
				return type;
			}
		}

		return "text";
	}
}

export const warmupService = new WarmupService();
