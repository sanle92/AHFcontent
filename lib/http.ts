import { z } from 'zod';
export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export class BackendError extends Error {
  status: number;
  constructor(
    message = 'The service is temporarily unavailable. Please try again later.',
    status = 503,
  ) {
    super(message);
    this.status = status;
  }
}
export function errorStatus(error: unknown, fallback = 500) {
  return error instanceof RequestError || error instanceof BackendError ? error.status : fallback;
}
export async function readJsonLimited(request: Request, limit: number): Promise<unknown> {
  const declared = request.headers.get('Content-Length');
  if (declared && Number(declared) > limit)
    throw new RequestError('Request body is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Invalid JSON request.');
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RequestError('Request body is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new RequestError('Invalid JSON request.');
  }
}
export function validate<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new RequestError('Invalid request. Check the form values.');
  return result.data;
}

export async function readMultipartLimited(request: Request, limit: number) {
  if (Number(request.headers.get('Content-Length') || 0) > limit)
    throw new RequestError('Request body is too large.', 413);
  if (!request.body) throw new RequestError('Choose a file.');
  const reader = request.body.getReader();
  let bytes = 0,
    limited: RequestError | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          controller.close();
          return;
        }
        bytes += value.byteLength;
        if (bytes > limit) {
          limited = new RequestError('Request body is too large.', 413);
          await reader.cancel();
          controller.error(limited);
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  try {
    const form = await new Response(stream, {
      headers: { 'Content-Type': request.headers.get('Content-Type') || '' },
    }).formData();
    if ([...form.keys()].length !== 1 || form.getAll('file').length !== 1)
      throw new RequestError('Upload exactly one file.');
    return form;
  } catch (error) {
    if (limited) throw limited;
    if (error instanceof RequestError) throw error;
    throw new RequestError('Invalid multipart upload. Choose the file again.');
  }
}

export function errorResponse(error: unknown) {
  const status = errorStatus(error, 503);
  return Response.json(
    {
      error:
        error instanceof RequestError || error instanceof BackendError
          ? error.message
          : 'The operation is temporarily unavailable. Please try again later.',
    },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}
