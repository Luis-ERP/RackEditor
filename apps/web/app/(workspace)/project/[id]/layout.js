'use client';

import { usePathname } from 'next/navigation';
import ProjectWorkspaceTabs from '@/src/shared/components/common/ProjectWorkspaceTabs';
import useProjectRegistry from '@/src/core/project/useProjectRegistry';

export default function ProjectLayout({ children, params }) {
  const { id } = params;
  const pathname = usePathname();
  const { projects } = useProjectRegistry();
  const project = projects.find((p) => p.id === id);
  const projectName = project?.name ?? 'Project';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--surface-border)',
          background: 'var(--surface)',
          paddingLeft: 16,
          paddingRight: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 36,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--muted-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}
        >
          {projectName}
        </span>
      </header>
      <ProjectWorkspaceTabs projectId={id} activePath={pathname} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
