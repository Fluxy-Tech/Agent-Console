import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-6 w-11 shrink-0 items-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-background block size-5 translate-x-0.5 rounded-sm shadow-sm transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
