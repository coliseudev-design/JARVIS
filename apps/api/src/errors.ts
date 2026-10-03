export class AppError extends Error {
  constructor(public statusCode: number, public code: string, public publicMessage: string) { super(code); }
}
export const unauthorized = () => new AppError(401, 'UNAUTHENTICATED', 'Credenciais ou sessão inválidas.');
export const missing = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.');
export const invalid = () => new AppError(400, 'INVALID_REQUEST', 'Requisição inválida.');
