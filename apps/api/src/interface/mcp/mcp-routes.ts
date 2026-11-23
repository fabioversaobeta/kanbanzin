import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { createAuthenticate } from '../http/auth-guard';
import { createMcpServer } from './mcp-server';

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed. Use POST.' },
  id: null,
};

/**
 * Stateless Streamable HTTP endpoint: each request gets its own server and transport, scoped to
 * the user behind the bearer token, so nothing is kept in memory between calls.
 */
export function registerMcpRoutes(app: FastifyInstance, container: Container): void {
  const authenticate = createAuthenticate(container);

  app.post('/mcp', { preHandler: authenticate }, async (request, reply) => {
    const server = createMcpServer(container, request.userId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // No server-initiated streams or sessions in stateless mode.
  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/mcp',
      handler: async (_request, reply) =>
        reply.status(405).header('Allow', 'POST').send(METHOD_NOT_ALLOWED),
    });
  }
}
