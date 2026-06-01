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
      <ProjectWorkspaceTabs projectId={id} activePath={pathname} projectName={projectName} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
