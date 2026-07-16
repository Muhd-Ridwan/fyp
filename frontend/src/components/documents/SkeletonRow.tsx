import Skeleton from "../ui/Skeleton";

export default function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/5 mt-2" />
      </div>
    </div>
  );
}
