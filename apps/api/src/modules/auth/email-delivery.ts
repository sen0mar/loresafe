export type EmailDelivery = {
  sendEmailVerification: (input: {
    email: string;
    token: string;
    expiresAt: Date;
  }) => Promise<void>;
  sendPasswordReset: (input: {
    email: string;
    token: string;
    expiresAt: Date;
  }) => Promise<void>;
};

// Delivery infrastructure is intentionally not selected yet. This boundary
// keeps raw tokens out of logs and gives a provider adapter one narrow seam.
export const emailDelivery: EmailDelivery = {
  sendEmailVerification: async () => undefined,
  sendPasswordReset: async () => undefined
};
