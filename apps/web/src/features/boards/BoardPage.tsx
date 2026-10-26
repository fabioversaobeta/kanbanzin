import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/http';
import { errorMessage, m } from '../../i18n/messages';
import { ConfirmDialog } from '../../ui/Modal';
import { AppBackground, FullPageSpinner } from '../../ui/layout';
import { enabledModules, KNOWN_SUPERPOWERS, superpowerCopy } from '../superpowers/registry';
import { TopBar } from './BoardsPage';
import { boardBackground } from './boardColors';
import { BoardCanvas } from './BoardCanvas';
import { CardModal } from './CardModal';
import { ColorPicker } from './ColorPicker';
import { Popover } from './Popover';
import { useBoard, useBoardActions } from './queries';

function BoardTitle({ title, onRename }: { title: string; onRename(title: string): void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== title) onRename(next);
    else setDraft(title);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="board-title"
        title={m.boards.renameBoard}
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
      >
        {title}
      </button>
    );
  }
  return (
    <input
      className="input board-title-input"
      autoFocus
      maxLength={100}
      aria-label={m.boards.boardTitle}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setDraft(title);
          setEditing(false);
        }
      }}
    />
  );
}

export function BoardPage() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const board = useBoard(boardId);
  const actions = useBoardActions(boardId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const view = board.data;
  const modules = useMemo(() => enabledModules(view?.superpowers ?? []), [view?.superpowers]);
  const openCard = view?.lists.flatMap((l) => l.cards).find((c) => c.id === openCardId);

  if (board.isPending)
    return (
      <AppBackground>
        <FullPageSpinner />
      </AppBackground>
    );

  if (board.isError || !view) {
    const notFound = board.error instanceof ApiError && board.error.status === 404;
    return (
      <AppBackground>
        <TopBar />
        <main className="page">
          <div className="alert alert-error" role="alert">
            {notFound ? m.boards.boardNotFound : errorMessage(board.error)}
          </div>
          <p>
            <Link to="/" className="btn">
              {m.boards.myBoards}
            </Link>
          </p>
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground background={boardBackground(view.board.color)}>
      <TopBar>
        <Link to="/" className="btn btn-ghost btn-small">
          ← <span className="hide-mobile">{m.boards.myBoards}</span>
        </Link>
        <BoardTitle
          title={view.board.title}
          onRename={(title) => actions.updateBoard.mutate({ title })}
        />
        <span className="spacer" />
        <Popover label={m.boards.boardColor} icon="🎨">
          <ColorPicker
            value={view.board.color}
            onChange={(color) => actions.updateBoard.mutate({ color })}
          />
        </Popover>
        <Popover label={m.boards.superpowers} icon="⚡">
          <div className="stack" style={{ gap: 14 }}>
            {KNOWN_SUPERPOWERS.map((key) => {
              const enabled = view.superpowers.includes(key);
              const copy = superpowerCopy(key);
              return (
                <div className="power" key={key}>
                  <div className="power-info">
                    <strong>{copy.title}</strong>
                    <span>{copy.description}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-checked={enabled}
                    aria-label={copy.title}
                    disabled={actions.setSuperpower.isPending}
                    onClick={() => actions.setSuperpower.mutate({ key, enabled: !enabled })}
                  />
                </div>
              );
            })}
          </div>
        </Popover>
        <button
          type="button"
          className="btn btn-small btn-ghost"
          aria-label={m.boards.deleteBoard}
          title={m.boards.deleteBoard}
          onClick={() => setConfirmingDelete(true)}
        >
          🗑
        </button>
      </TopBar>

      <main style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <BoardCanvas view={view} actions={actions} onOpenCard={setOpenCardId} />
      </main>

      {openCard ? (
        <CardModal
          key={openCard.id}
          card={openCard}
          modules={modules}
          onChange={(patch) => actions.updateCard.mutate({ id: openCard.id, patch })}
          onDelete={() => {
            actions.deleteCard.mutate(openCard.id);
            setOpenCardId(null);
          }}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}

      {confirmingDelete ? (
        <ConfirmDialog
          title={m.boards.deleteBoard}
          message={m.boards.deleteBoardConfirm}
          confirmLabel={m.delete}
          busy={actions.deleteBoard.isPending}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() =>
            actions.deleteBoard.mutate(undefined, { onSuccess: () => navigate('/') })
          }
        />
      ) : null}
    </AppBackground>
  );
}
