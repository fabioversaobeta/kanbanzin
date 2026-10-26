import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, m } from '../../i18n/messages';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { AppBackground, Brand, FullPageSpinner, LegalLinks } from '../../ui/layout';
import { useAuth } from '../auth/AuthContext';
import { boardBackground } from './boardColors';
import { ColorPicker } from './ColorPicker';
import { useBoards, useCreateBoard } from './queries';

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar glass">
      <Brand />
      <span className="spacer" />
      {children}
      <Link to="/account" className="btn btn-ghost btn-small" title={user?.email}>
        <span className="hide-mobile">{user?.name ?? m.boards.account}</span>
        <span aria-hidden="true">👤</span>
      </Link>
      <button type="button" className="btn btn-small" onClick={() => void logout()}>
        {m.auth.signOut}
      </button>
    </header>
  );
}

function CreateBoardDialog({ onClose }: { onClose(): void }) {
  const navigate = useNavigate();
  const createBoard = useCreateBoard();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('ocean');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const board = await createBoard.mutateAsync({ title, color });
    navigate(`/b/${board.id}`);
  };

  return (
    <Modal title={m.boards.newBoard} onClose={onClose}>
      <form className="form" onSubmit={(event) => void onSubmit(event).catch(() => undefined)}>
        {createBoard.error ? (
          <div className="alert alert-error" role="alert">
            {errorMessage(createBoard.error)}
          </div>
        ) : null}
        <div
          aria-hidden="true"
          style={{ height: 72, borderRadius: 14, background: boardBackground(color) }}
        />
        <Field
          label={m.boards.boardTitle}
          placeholder={m.boards.boardTitlePlaceholder}
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field">
          <span className="field-label">{m.boards.color}</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {m.cancel}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createBoard.isPending || !title.trim()}
          >
            {m.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function BoardsPage() {
  const boards = useBoards();
  const [creating, setCreating] = useState(false);

  return (
    <AppBackground>
      <TopBar />
      <main className="page">
        <h1 style={{ marginBottom: 4 }}>{m.boards.title}</h1>
        <p style={{ color: 'var(--text-soft)', marginTop: 0 }}>{m.boards.subtitle}</p>

        {boards.isPending ? (
          <FullPageSpinner />
        ) : boards.isError ? (
          <div className="alert alert-error" role="alert">
            {errorMessage(boards.error)}
          </div>
        ) : (
          <>
            {boards.data.length === 0 ? <p className="empty glass">{m.boards.empty}</p> : null}
            <div className="board-grid" style={{ marginTop: 20 }}>
              {boards.data.map((board) => (
                <Link
                  key={board.id}
                  to={`/b/${board.id}`}
                  className="board-tile"
                  style={{ background: boardBackground(board.color) }}
                >
                  <span>{board.title}</span>
                </Link>
              ))}
              <button
                type="button"
                className="board-tile board-tile-new"
                onClick={() => setCreating(true)}
              >
                <span>＋ {m.boards.newBoard}</span>
              </button>
            </div>
          </>
        )}
        <div style={{ marginTop: 40 }}>
          <LegalLinks />
        </div>
      </main>
      {creating ? <CreateBoardDialog onClose={() => setCreating(false)} /> : null}
    </AppBackground>
  );
}
