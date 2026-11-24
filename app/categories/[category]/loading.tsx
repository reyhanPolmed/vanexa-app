export default function Loading() {
  return (
    <main className="page-width py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 rounded bg-slate-200" />
        <div className="h-10 w-64 rounded bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          <div className="h-44 rounded-2xl bg-slate-200" />
          <div className="h-44 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
