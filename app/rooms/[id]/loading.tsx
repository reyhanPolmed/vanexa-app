export default function Loading() {
  return (
    <main className="page-width py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-10 w-64 rounded bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="grid gap-6 md:grid-cols-3 mt-6">
          <div className="h-64 rounded-2xl bg-slate-200 md:col-span-1" />
          <div className="h-64 rounded-2xl bg-slate-200 md:col-span-2" />
        </div>
      </div>
    </main>
  );
}
