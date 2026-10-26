import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  termsVersion: text('terms_version').notNull(),
  termsAcceptedAt: timestamptz('terms_accepted_at').notNull(),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamptz('locked_until'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    color: text('color').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('boards_owner_idx').on(t.ownerId)],
);

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: doublePrecision('position').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('lists_board_idx').on(t.boardId, t.position)],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    position: doublePrecision('position').notNull(),
    dueAt: timestamptz('due_at'),
    labels: text('labels').array().notNull().default([]),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('cards_list_idx').on(t.listId, t.position), index('cards_board_idx').on(t.boardId)],
);

export const boardSuperpowers = pgTable(
  'board_superpowers',
  {
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    enabledAt: timestamptz('enabled_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.key] })],
);
