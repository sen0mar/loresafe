import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useLogin } from "../api/auth.js";
import type { LoginFormValues } from "../schemas/login.schema.js";

export const useLoginAction = (redirectTo: string) => {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const login = (credentials: LoginFormValues) => {
    loginMutation.mutate(credentials, {
      onSuccess: () => {
        toast.success("Logged in");
        navigate(redirectTo, { replace: true });
      }
    });
  };

  return { login, loginMutation };
};
