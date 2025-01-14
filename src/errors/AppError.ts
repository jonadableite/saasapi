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

export class BadRequestError extends AppError {
	constructor(message: string) {
		super(message, 400);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string) {
		super(message, 401);
	}
}
