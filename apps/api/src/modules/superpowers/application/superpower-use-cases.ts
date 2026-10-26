import { NotFoundError } from '../../../shared/errors';
import type { BoardRepository } from '../../boards/application/ports';
import { getSuperpower, SUPERPOWERS, type Superpower } from '../domain/superpower';

export interface SuperpowerRepository {
  enabledKeys(boardId: string): Promise<string[]>;
  setEnabled(boardId: string, key: string, enabled: boolean): Promise<void>;
}

export class ListSuperpowerCatalog {
  execute(): readonly Superpower[] {
    return SUPERPOWERS;
  }
}

export class SetBoardSuperpower {
  constructor(
    private readonly boards: BoardRepository,
    private readonly superpowers: SuperpowerRepository,
  ) {}

  /** Idempotent. Disabling hides the feature but keeps its data so it can be re-enabled safely. */
  async execute(
    ownerId: string,
    boardId: string,
    key: string,
    input: { enabled: boolean },
  ): Promise<string[]> {
    const board = await this.boards.findOwned(boardId, ownerId);
    if (!board) throw new NotFoundError('Board');
    const superpower = getSuperpower(key);
    await this.superpowers.setEnabled(board.id, superpower.key, input.enabled);
    return this.superpowers.enabledKeys(board.id);
  }
}
