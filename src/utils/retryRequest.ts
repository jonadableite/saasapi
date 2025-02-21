// src/utils/retryRequest.ts

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

export async function retryRequest(requestFn: () => Promise<any>) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      return await requestFn();
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "isAxiosError" in error &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "status" in error.response &&
        error.response.status === 429
      ) {
        retries++;
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retries),
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error("Número máximo de tentativas atingido");
}
