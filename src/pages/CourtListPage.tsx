import { CourtCard } from "../components/CourtCard";
import { ErrorState, PageHeader, Skeleton } from "../components/ui";
import { useCourts } from "../hooks/useCourts";

export function CourtListPage() {
  const courts = useCourts();
  return (
    <>
      <PageHeader title="Canchas" subtitle="Las cuatro canchas de fútbol de Futbolix." />
      {courts.loading ? (
        <Skeleton count={4} height={260} grid />
      ) : courts.error ? (
        <ErrorState error={courts.error} onRetry={courts.reload} />
      ) : (
        <div className="grid grid-cards">{courts.data?.map((c) => <CourtCard key={c.id} court={c} />)}</div>
      )}
    </>
  );
}
