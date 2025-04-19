import path from "node:path";
// src/config/swagger.ts
import dotenv from "dotenv";
import swaggerJsdoc from "swagger-jsdoc";

dotenv.config(); // Certifique-se de que as variáveis de ambiente estão carregadas

const apiUrl = process.env.API_URL || "http://localhost:9000";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WhatLead API",
      version: "1.0.0",
      description: "API documentation for the WhatLead service",
    },
    servers: [
      {
        url: apiUrl,
        description: "Development server",
      },
    ],
  },
  apis: [
    path.join(__dirname, "../routes/*.ts"),
    path.join(__dirname, "../controllers/**/*.ts"),
  ],
  components: {
    schemas: {
      ChatbotFlow: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          nodes: {
            type: "array",
            items: { type: "object" },
          },
          // Adicione outras propriedades conforme necessário
        },
      },
      // Adicione outros schemas conforme necessário
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

const specs = swaggerJsdoc(options);

export default specs;
