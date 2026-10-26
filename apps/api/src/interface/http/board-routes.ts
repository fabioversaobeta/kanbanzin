import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container';
import { createAuthenticate } from './auth-guard';

const uuid = z.uuid();
const idParams = z.object({ id: uuid });
const superpowerParams = z.object({ id: uuid, key: z.string().min(1).max(64) });

const boardBody = z.object({ title: z.string().max(500), color: z.string().max(20).optional() });
const boardPatch = z.object({
  title: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
});
const titleBody = z.object({ title: z.string().max(500) });
const indexBody = z.object({ index: z.number().int().min(0).max(100_000) });
const moveCardBody = z.object({ listId: uuid, index: z.number().int().min(0).max(100_000) });
const cardPatch = z.object({
  title: z.string().max(1000).optional(),
  description: z.string().max(20_000).optional(),
  dueAt: z.string().max(40).nullable().optional(),
  labels: z.array(z.string().max(20)).max(20).optional(),
});
const superpowerBody = z.object({ enabled: z.boolean() });

export function registerBoardRoutes(app: FastifyInstance, container: Container): void {
  const authenticate = createAuthenticate(container);
  const { boards, superpowers } = container;
  const protectedRoute = { preHandler: authenticate };

  // Boards
  app.get('/v1/boards', protectedRoute, async (request) => ({
    boards: await boards.list.execute(request.userId),
  }));

  app.post('/v1/boards', protectedRoute, async (request, reply) => {
    const body = boardBody.parse(request.body);
    return reply.status(201).send({ board: await boards.create.execute(request.userId, body) });
  });

  app.get('/v1/boards/:id', protectedRoute, async (request) => {
    const { id } = idParams.parse(request.params);
    return boards.get.execute(request.userId, id);
  });

  app.patch('/v1/boards/:id', protectedRoute, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = boardPatch.parse(request.body);
    return { board: await boards.update.execute(request.userId, id, body) };
  });

  app.delete('/v1/boards/:id', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.delete.execute(request.userId, id);
    return reply.status(204).send();
  });

  // Lists
  app.post('/v1/boards/:id/lists', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = titleBody.parse(request.body);
    return reply
      .status(201)
      .send({ list: await boards.createList.execute(request.userId, id, body) });
  });

  app.patch('/v1/lists/:id', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.renameList.execute(request.userId, id, titleBody.parse(request.body));
    return reply.status(204).send();
  });

  app.post('/v1/lists/:id/move', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.moveList.execute(request.userId, id, indexBody.parse(request.body));
    return reply.status(204).send();
  });

  app.delete('/v1/lists/:id', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.deleteList.execute(request.userId, id);
    return reply.status(204).send();
  });

  // Cards
  app.post('/v1/lists/:id/cards', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = titleBody.parse(request.body);
    return reply
      .status(201)
      .send({ card: await boards.createCard.execute(request.userId, id, body) });
  });

  app.patch('/v1/cards/:id', protectedRoute, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = cardPatch.parse(request.body);
    return { card: await boards.updateCard.execute(request.userId, id, body) };
  });

  app.post('/v1/cards/:id/move', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.moveCard.execute(request.userId, id, moveCardBody.parse(request.body));
    return reply.status(204).send();
  });

  app.delete('/v1/cards/:id', protectedRoute, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await boards.deleteCard.execute(request.userId, id);
    return reply.status(204).send();
  });

  // Superpowers
  app.get('/v1/superpowers', protectedRoute, async () => ({
    superpowers: superpowers.catalog.execute(),
  }));

  app.put('/v1/boards/:id/superpowers/:key', protectedRoute, async (request) => {
    const { id, key } = superpowerParams.parse(request.params);
    const body = superpowerBody.parse(request.body);
    return { superpowers: await superpowers.setForBoard.execute(request.userId, id, key, body) };
  });
}
