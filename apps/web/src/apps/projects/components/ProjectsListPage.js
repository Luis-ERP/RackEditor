'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import useProjectRegistry from '@/src/core/project/useProjectRegistry';
import { migrateLegacyMainProject } from '@/src/core/project/projectRegistry';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ProjectCard({ project, onDelete }) {
  const router = useRouter();

  const handleOpen = () => {
    router.push(`/project/${project.id}/design`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    onDelete(project.id);
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
      onClick={handleOpen}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FolderOpen size={20} style={{ color: 'var(--app-text)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--app-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-text)', marginTop: 2 }}>
            Created {fmtDate(project.createdAt)}
          </div>
        </div>
      </div>

      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleOpen}
          style={{
            flex: 1,
            padding: '7px 14px',
            borderRadius: 8,
            background: 'var(--accent-soft)',
            border: '1px solid var(--surface-border)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--app-text)',
          }}
        >
          Open
        </button>
        <button
          type="button"
          onClick={handleDelete}
          title="Delete project"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--surface-border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted-text)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error, #e53e3e)'; e.currentTarget.style.borderColor = 'var(--error, #e53e3e)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FolderOpen size={32} style={{ color: 'var(--muted-text)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--app-text)', marginBottom: 6 }}>
          No projects yet
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted-text)' }}>
          Create your first project to get started with the CAD editor and quote tools.
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 10,
          background: 'var(--accent-soft)',
          border: '1px solid var(--surface-border)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--app-text)',
        }}
      >
        <Plus size={16} />
        Create your first project
      </button>
    </div>
  );
}

function NewProjectModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => onConfirm(name.trim() || 'Untitled Project');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 14,
          padding: 24,
          width: 360,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--app-text)' }}>
          New Project
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Project name"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--surface-border)',
            background: 'var(--app-bg)',
            color: 'var(--app-text)',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'transparent', border: '1px solid var(--surface-border)',
              color: 'var(--muted-text)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--accent, #3b82f6)', border: 'none',
              color: '#ffffff', cursor: 'pointer',
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsListPage() {
  const router = useRouter();
  const { projects, createProject, deleteProject } = useProjectRegistry();
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (migrateLegacyMainProject()) {
      // Same-tab writes don't fire the native 'storage' event, so dispatch
      // a synthetic one to trigger useProjectRegistry's refresh.
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'rack-editor:projects-registry',
        storageArea: window.localStorage,
      }));
    }
  }, []);

  const handleNew = () => setShowModal(true);

  const handleCreate = (name) => {
    const project = createProject(name);
    setShowModal(false);
    router.push(`/project/${project.id}/design`);
  };

  return (
    <>
    {showModal && <NewProjectModal onConfirm={handleCreate} onCancel={() => setShowModal(false)} />}
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h1
          style={{
            flex: 1,
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--app-text)',
          }}
        >
          Projects
        </h1>
        {mounted && projects.length > 0 && (
          <button
            type="button"
            onClick={handleNew}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--accent-soft)',
              border: '1px solid var(--surface-border)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--app-text)',
            }}
          >
            <Plus size={15} />
            New Project
          </button>
        )}
      </div>

      {/* Content */}
      {!mounted ? null : projects.length === 0 ? (
        <EmptyState onCreate={handleNew} />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
            alignContent: 'start',
          }}
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}
