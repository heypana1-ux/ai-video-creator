import { Skeleton } from "@/components/ui/skeleton";

export default function EditorLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <Skeleton className="h-6 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <div className="space-y-2 border-r border-ink-800 p-3">
          {Array.from({ length: 5 }, (_value, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="space-y-4 p-4">
          <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[19rem] rounded-2xl" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="space-y-3 border-l border-ink-800 p-3">
          {Array.from({ length: 6 }, (_value, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
