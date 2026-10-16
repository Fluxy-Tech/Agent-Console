import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/// Padrão único de botão do Agent Console e do Desk (os dois arquivos são
/// idênticos de propósito). A altura casa com inputs e selects: default h-11,
/// sm h-9. As telas não devem sobrescrever altura, raio ou cor por className;
/// se faltar um formato, crie uma variante aqui.
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-deep",
        outline: "border border-input bg-card text-foreground hover:border-[#b9c3e0] hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        "outline-destructive":
          "border border-destructive/40 bg-card text-destructive hover:border-destructive hover:bg-destructive hover:text-white",
        /// Ação de "adicionar" dentro de cards e formulários.
        dashed: "border border-dashed border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
        /// Mesma altura dos inputs (h-11): botões ao lado de campos, como no chat.
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
