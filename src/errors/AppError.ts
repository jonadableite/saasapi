// src/errors/AppError.ts
export class AppError extends Error {
	public readonly statusCode: number;

	constructor(message: string, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message, 404);
	}
}

export class BadRequestError extends Error {
	public statusCode: number;
	public details?: Record<string, unknown>;

	constructor(message: string, details?: Record<string, unknown>) {
		super(message);
		this.statusCode = 400;
		this.details = details;
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string) {
		super(message, 401);
	}
}
