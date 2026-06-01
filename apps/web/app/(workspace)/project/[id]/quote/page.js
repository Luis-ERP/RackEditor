import QuoterPage from '@/src/apps/quoter/components/QuoterPage';

export default function QuotePage({ params }) {
  return <QuoterPage projectId={params.id} />;
}
