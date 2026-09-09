import { Skeleton } from "@/components/ui/skeleton";

export default function ConceptsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-7 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_value, index) => (
          <div key={index} className="surface-card space-y-4 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 4 }, (_item, row) => (
                <Skeleton key={row} className="h-3 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
