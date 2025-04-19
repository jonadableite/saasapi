// src/middlewares/errorHandler.ts
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../errors/AppError";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("Error:", error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: "Erro no upload do arquivo",
      details: error.message,
    });
  }

  return res.status(500).json({
    error: "Erro interno do servidor",
    details: error.message,
  });
}
