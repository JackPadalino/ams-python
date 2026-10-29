const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export const PlayIcon = () => <svg {...base}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>;
export const StopIcon = () => <svg {...base}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></svg>;
export const SaveIcon = () => <svg {...base}><path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M7 3v5h8V3M7 21v-7h10v7" /></svg>;
export const ShareIcon = () => <svg {...base}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>;
export const PlusIcon = () => <svg {...base}><path d="M12 5v14M5 12h14" /></svg>;
export const FileIcon = () => <svg {...base}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
export const EditIcon = () => <svg {...base}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>;
export const TrashIcon = () => <svg {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const ResetIcon = () => <svg {...base}><path d="M4 4v6h6" /><path d="M5.5 15a7 7 0 1 0 1.6-7.3L4 10" /></svg>;
