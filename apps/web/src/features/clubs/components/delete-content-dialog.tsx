import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/api-client";
import { Button } from "@/shared/components/ui/button";
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

import {
  useDeleteCommentMutation,
  useDeletePostMutation
} from "../api/clubs.js";

type DeletePostDialogProps = {
  postId: string;
  onDeleted?: () => void;
};

type DeleteCommentDialogProps = {
  commentId: string;
  postId: string;
  onDeleted?: () => void;
};

export const DeletePostDialog = ({
  onDeleted,
  postId
}: DeletePostDialogProps) => {
  const deleteMutation = useDeletePostMutation(postId);

  return (
    <DeleteContentDialog
      isDeleting={deleteMutation.isPending}
      targetLabel="post"
      onConfirm={() => {
        deleteMutation.mutate(undefined, {
          onSuccess: () => {
            toast.success("Post deleted");
            onDeleted?.();
          },
          onError: (error) => {
            toast.error(
              error instanceof ApiError
                ? error.message
                : "Could not delete this post. Try again."
            );
          }
        });
      }}
    />
  );
};

export const DeleteCommentDialog = ({
  commentId,
  onDeleted,
  postId
}: DeleteCommentDialogProps) => {
  const deleteMutation = useDeleteCommentMutation(postId, commentId);

  return (
    <DeleteContentDialog
      isDeleting={deleteMutation.isPending}
      targetLabel="comment"
      onConfirm={() => {
        deleteMutation.mutate(undefined, {
          onSuccess: () => {
            toast.success("Comment deleted");
            onDeleted?.();
          },
          onError: (error) => {
            toast.error(
              error instanceof ApiError
                ? error.message
                : "Could not delete this comment. Try again."
            );
          }
        });
      }}
    />
  );
};

const DeleteContentDialog = ({
  isDeleting,
  onConfirm,
  targetLabel
}: {
  isDeleting: boolean;
  onConfirm: () => void;
  targetLabel: "comment" | "post";
}) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting) {
      return;
    }

    setOpen(nextOpen);
  };

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-warning hover:text-primary"
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {targetLabel}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {targetLabel}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleConfirm}
          >
            <Trash2 />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
