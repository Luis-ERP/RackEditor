import CadWorkspacePage from '@/src/apps/cad/CadWorkspacePage';

export default function DesignPage({ params }) {
  return <CadWorkspacePage projectId={params.id} />;
}
