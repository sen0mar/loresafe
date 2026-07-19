import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

import { useDeleteCurrentUserAccount } from "../api/profile.js";

const deleteConfirmation = "delete";

export const AccountDangerZone = () => {
  const navigate = useNavigate();
  const deleteAccountMutation = useDeleteCurrentUserAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation === deleteConfirmation && password.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    if (deleteAccountMutation.isPending) {
      return;
    }

    setIsOpen(nextOpen);

    if (!nextOpen) {
      setConfirmation("");
      setPassword("");
      setError(null);
    }
  };

  const deleteAccount = () => {
    if (!canDelete || deleteAccountMutation.isPending) {
      return;
    }

    setError(null);
    deleteAccountMutation.mutate(
      {
        confirmation: deleteConfirmation,
        password
      },
      {
        onSuccess: () => {
          toast.success("Account deleted");
          navigate("/", { replace: true });
        },
        onError: (deleteError) => {
          setError(
            deleteError instanceof ApiError
              ? deleteError.message
              : "Could not delete your account. Try again."
          );
        }
      }
    );
  };

  return (
    <Card className="border-error/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-error">
          <TriangleAlert className="size-5" />
          Danger zone
        </CardTitle>
        <p className="text-sm leading-6 text-muted">
          Delete your account and remove the profile, posts, and comments tied
          to it.
        </p>
      </CardHeader>
      <CardContent className="pt-1">
        <div
          className={[
            "flex flex-col gap-4 rounded-lg border border-default bg-inset p-4",
            "sm:flex-row sm:items-center sm:justify-between"
          ].join(" ")}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Delete account</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              This permanently deletes your account and cannot be undone.
            </p>
          </div>
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button
                className="w-full sm:w-fit"
                type="button"
                variant="destructive"
              >
                <Trash2 />
                Delete account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  Deleting your account permanently deletes your profile and all
                  posts and comments associated with it. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <label
                  className="text-sm font-medium text-secondary"
                  htmlFor="delete-account-password"
                >
                  Current password
                </label>
                <Input
                  id="delete-account-password"
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  disabled={deleteAccountMutation.isPending}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                />
                <label
                  className="text-sm font-medium text-secondary"
                  htmlFor="delete-account-confirmation"
                >
                  Type <span className="text-primary">"delete"</span> to confirm
                </label>
                <Input
                  id="delete-account-confirmation"
                  autoComplete="off"
                  value={confirmation}
                  disabled={deleteAccountMutation.isPending}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setError(null);
                  }}
                />
                {error ? (
                  <p className="text-sm text-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleteAccountMutation.isPending}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canDelete || deleteAccountMutation.isPending}
                  onClick={deleteAccount}
                >
                  <Trash2 />
                  {deleteAccountMutation.isPending
                    ? "Deleting..."
                    : "Delete account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};
