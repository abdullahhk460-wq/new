import { Response } from 'express';

interface StandardResponse {
  status: 'success' | 'fail' | 'error';
  message: string;
  data?: any;
  meta?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
    [key: string]: any;
  };
  errors?: any;
}

export const sendResponse = (
  res: Response,
  statusCode: number,
  { status, message, data, meta, errors }: StandardResponse
) => {
  return res.status(statusCode).json({
    status,
    message,
    data,
    meta,
    errors,
  });
};

export const sendSuccess = (
  res: Response,
  statusCode = 200,
  message = 'Operation successful',
  data?: any,
  meta?: any
) => {
  return sendResponse(res, statusCode, {
    status: 'success',
    message,
    data,
    meta,
  });
};

export const sendError = (
  res: Response,
  statusCode = 500,
  message = 'An unexpected error occurred',
  errors?: any
) => {
  const status = statusCode >= 500 ? 'error' : 'fail';
  return sendResponse(res, statusCode, {
    status,
    message,
    errors,
  });
};
