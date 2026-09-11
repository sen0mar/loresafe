import {
  loginFormSchema,
  type LoginFormValues
} from "../schemas/login.schema.js";

type DemoLoginEnv = {
  VITE_DEMO_USER_EMAIL?: string;
  VITE_DEMO_USER_PASSWORD?: string;
};

export const getDemoLoginCredentials = (
  env: DemoLoginEnv = {
    VITE_DEMO_USER_EMAIL: import.meta.env.VITE_DEMO_USER_EMAIL,
    VITE_DEMO_USER_PASSWORD: import.meta.env.VITE_DEMO_USER_PASSWORD
  }
): LoginFormValues | null => {
  const parseResult = loginFormSchema.safeParse({
    email: env.VITE_DEMO_USER_EMAIL,
    password: env.VITE_DEMO_USER_PASSWORD
  });

  return parseResult.success ? parseResult.data : null;
};
