import type { AppConfig } from './config/env';
import type { Database } from './infrastructure/database/client';
import { type Clock, systemClock } from './shared/clock';
import type { Logger } from './shared/logger';
import {
  ChangePassword,
  DeleteAccount,
  GetCurrentUser,
  UpdateProfile,
} from './modules/identity/application/account';
import { LoginUser } from './modules/identity/application/login-user';
import { LogoutSession } from './modules/identity/application/logout-session';
import { RequestPasswordReset, ResetPassword } from './modules/identity/application/password-reset';
import type { Mailer } from './modules/identity/application/ports';
import { RefreshSession } from './modules/identity/application/refresh-session';
import { RegisterUser } from './modules/identity/application/register-user';
import { SessionIssuer } from './modules/identity/application/session-issuer';
import {
  Argon2PasswordHasher,
  JwtAccessTokenService,
  RandomTokenGenerator,
} from './modules/identity/infrastructure/crypto-services';
import {
  DrizzlePasswordResetRepository,
  DrizzleRefreshTokenRepository,
} from './modules/identity/infrastructure/drizzle-token-repositories';
import { DrizzleUserRepository } from './modules/identity/infrastructure/drizzle-user-repository';
import { ConsoleMailer, ResendMailer } from './modules/identity/infrastructure/mailers';
import {
  CreateBoard,
  DeleteBoard,
  GetBoard,
  ListBoards,
  UpdateBoard,
} from './modules/boards/application/board-use-cases';
import {
  CreateCard,
  DeleteCard,
  MoveCard,
  UpdateCard,
} from './modules/boards/application/card-use-cases';
import {
  ArchiveListCards,
  CreateList,
  DeleteList,
  MoveList,
  RenameList,
} from './modules/boards/application/list-use-cases';
import {
  DrizzleBoardContentReader,
  DrizzleBoardRepository,
  DrizzleCardRepository,
  DrizzleListRepository,
} from './modules/boards/infrastructure/drizzle-board-repositories';
import { ExportUserData } from './modules/privacy/application/export-user-data';
import {
  ListSuperpowerCatalog,
  SetBoardSuperpower,
} from './modules/superpowers/application/superpower-use-cases';
import { DrizzleSuperpowerRepository } from './modules/superpowers/infrastructure/drizzle-superpower-repository';

export interface ContainerOptions {
  db: Database;
  config: AppConfig;
  logger: Logger;
  /** Overrides the e-mail transport (tests). */
  mailer?: Mailer;
  clock?: Clock;
}

/** Composition root: the only place where ports are bound to their implementations. */
export function createContainer({
  db,
  config,
  logger,
  mailer,
  clock = systemClock,
}: ContainerOptions) {
  const users = new DrizzleUserRepository(db);
  const refreshTokens = new DrizzleRefreshTokenRepository(db);
  const passwordResets = new DrizzlePasswordResetRepository(db);
  const hasher = new Argon2PasswordHasher();
  const tokenGenerator = new RandomTokenGenerator();
  const accessTokens = new JwtAccessTokenService(config.jwtSecret);
  const transport =
    mailer ??
    (config.resendApiKey
      ? new ResendMailer(config.resendApiKey, config.mailFrom)
      : new ConsoleMailer(logger));
  const sessions = new SessionIssuer(refreshTokens, accessTokens, tokenGenerator, clock);

  const boards = new DrizzleBoardRepository(db);
  const boardContent = new DrizzleBoardContentReader(db);
  const lists = new DrizzleListRepository(db);
  const cards = new DrizzleCardRepository(db);
  const superpowers = new DrizzleSuperpowerRepository(db);

  return {
    db,
    accessTokens,
    identity: {
      register: new RegisterUser(users, hasher, sessions, clock),
      login: new LoginUser(users, hasher, sessions, clock),
      refresh: new RefreshSession(users, refreshTokens, tokenGenerator, sessions, clock),
      logout: new LogoutSession(refreshTokens, tokenGenerator, clock),
      requestPasswordReset: new RequestPasswordReset(
        users,
        passwordResets,
        tokenGenerator,
        transport,
        clock,
        logger,
        config.webOrigins[0] ?? 'http://localhost:5173',
      ),
      resetPassword: new ResetPassword(
        users,
        passwordResets,
        refreshTokens,
        tokenGenerator,
        hasher,
        clock,
      ),
      currentUser: new GetCurrentUser(users),
      updateProfile: new UpdateProfile(users, clock),
      changePassword: new ChangePassword(users, refreshTokens, hasher, sessions, clock),
      deleteAccount: new DeleteAccount(users, hasher),
    },
    boards: {
      list: new ListBoards(boards),
      create: new CreateBoard(boards, clock),
      get: new GetBoard(boards, boardContent, superpowers),
      update: new UpdateBoard(boards, clock),
      delete: new DeleteBoard(boards),
      createList: new CreateList(boards, lists, clock),
      renameList: new RenameList(lists),
      moveList: new MoveList(lists),
      deleteList: new DeleteList(lists),
      archiveListCards: new ArchiveListCards(lists, cards, clock),
      createCard: new CreateCard(lists, cards, superpowers, clock),
      updateCard: new UpdateCard(cards, superpowers, clock),
      moveCard: new MoveCard(lists, cards, clock),
      deleteCard: new DeleteCard(cards),
    },
    superpowers: {
      catalog: new ListSuperpowerCatalog(),
      setForBoard: new SetBoardSuperpower(boards, superpowers),
    },
    privacy: {
      exportData: new ExportUserData(db, users, clock),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
