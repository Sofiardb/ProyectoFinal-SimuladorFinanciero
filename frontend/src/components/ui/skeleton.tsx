import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-skeleton-pulse rounded-md bg-sand-200", className)}
      {...props}
    />
  )
}

export { Skeleton }
