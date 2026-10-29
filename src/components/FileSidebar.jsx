import { EditIcon, FileIcon, PlusIcon, TrashIcon } from "./Icons";

export default function FileSidebar({ files, currentId, dirty, onOpen, onNew, onRename, onDelete }) {
  return (
    <aside className="sidebar" aria-label="Your files">
      <header className="panel-header">
        <h2>My files</h2>
        <button type="button" className="button button-quiet button-small" onClick={onNew}>
          <PlusIcon /> New
        </button>
      </header>
      <ul className="file-list">
        {files.map((file) => {
          const active = file.id === currentId;
          return (
            <li key={file.id} className={`file-row ${active ? "is-active" : ""}`}>
              <button type="button" className="file-open" onClick={() => onOpen(file.id)} aria-current={active ? "true" : undefined}>
                <FileIcon />
                <span className="file-name">{file.name}</span>
                {active && dirty && <span className="dirty-dot" title="Unsaved changes" />}
              </button>
              <span className="file-actions">
                <button type="button" className="icon-button" onClick={() => onRename(file)} title={`Rename ${file.name}`} aria-label={`Rename ${file.name}`}>
                  <EditIcon />
                </button>
                <button type="button" className="icon-button" onClick={() => onDelete(file)} title={`Delete ${file.name}`} aria-label={`Delete ${file.name}`}>
                  <TrashIcon />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
