import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Toasts follow the app theme (pastel surfaces, accent, rounded corners). */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !border-border !bg-popover !text-popover-foreground !shadow-xl !font-sans !text-[14px] !backdrop-blur-sm",
          title: "!font-semibold",
          description: "!text-[12px] !text-muted-foreground",
          icon: "!text-accent",
          actionButton: "!rounded-xl !bg-accent !text-accent-foreground",
          cancelButton: "!rounded-xl !bg-surface-2 !text-foreground",
          closeButton: "!bg-surface-2 !text-foreground !border-border",
          error: "!text-destructive",
          success: "!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
