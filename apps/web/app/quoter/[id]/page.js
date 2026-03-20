import QuoterPage from '@/src/apps/quoter/components/QuoterPage';

export default function QuoterEditorRoutePage({ params }) {
  return <QuoterPage quoteId={params?.id ?? null} />;
}
