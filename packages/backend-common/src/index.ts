const productionSecret = process.env.JWT_SECRET;

export const JWT_SECRET =
  productionSecret ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("JWT_SECRET must be set in production");
      })()
    : "dev-secret");
