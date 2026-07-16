import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { handleError, handleSuccess, staffLogout } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";

type StaffLogoutButtonProps = {
  className?: string;
  variant?: "default" | "ghost" | "outline";
  showLabel?: boolean;
};

export function StaffLogoutButton({
  className,
  variant = "ghost",
  showLabel = true,
}: StaffLogoutButtonProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: () => staffLogout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffSessionQueryKey });
      handleSuccess("Signed out");
      void navigate("/login", { replace: true });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? "default" : "icon-sm"}
      className={cn(showLabel && "w-full justify-start", className)}
      disabled={logoutMutation.isPending}
      onClick={() => {
        logoutMutation.mutate();
      }}
    >
      <LogOutIcon data-icon={showLabel ? "inline-start" : undefined} />
      {showLabel ? "Sign out" : <span className="sr-only">Sign out</span>}
    </Button>
  );
}
