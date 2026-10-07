import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="bg-secondary relative h-1.5 w-full grow overflow-hidden rounded-sm">
        <SliderPrimitive.Range className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-primary bg-background focus-visible:ring-ring block size-4 shrink-0 rounded-sm border-2 shadow-sm outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
}
