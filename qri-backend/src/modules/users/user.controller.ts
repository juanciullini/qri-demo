import type { FastifyReply, FastifyRequest } from 'fastify';
import { createUserSchema, updateUserSchema, userFiltersSchema } from './user.schemas.js';
import * as userService from './user.service.js';

// ── Create User ──

export async function createUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createUserSchema.parse(request.body);
  const user = await userService.createUser(body);
  reply.status(201).send(user);
}

// ── Get Users ──

export async function getUsersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = userFiltersSchema.parse(request.query);
  const result = await userService.getUsers(filters);
  reply.send(result);
}

// ── Get User By ID ──

export async function getUserByIdHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const user = await userService.getUserById(id);
  reply.send(user);
}

// ── Update User ──

export async function updateUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateUserSchema.parse(request.body);
  const user = await userService.updateUser(id, body);
  reply.send(user);
}

// ── Delete User ──

export async function deleteUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const user = await userService.deleteUser(id);
  reply.send(user);
}
