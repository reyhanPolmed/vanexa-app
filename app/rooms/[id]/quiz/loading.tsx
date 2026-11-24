export default function Loading() {
  return (
    <main className="page-width py-6 sm:py-8">
      <div className="animate-pulse space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="h-8 w-48 rounded bg-slate-200" />
          <div className="h-10 w-32 rounded-xl bg-slate-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-4 mt-6">
          <div className="h-96 rounded-2xl bg-slate-200 lg:col-span-3" />
          <div className="h-64 rounded-2xl bg-slate-200 lg:col-span-1" />
        </div>
      </div>
    </main>
  );
}
