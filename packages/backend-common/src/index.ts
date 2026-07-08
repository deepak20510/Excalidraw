import path from "path";
import dotenv from "dotenv";

// Load dotenv from potential paths (root .env relative to current working dir or dist/src location)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const productionSecret = process.env.JWT_SECRET;

export const JWT_SECRET =
  productionSecret ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("JWT_SECRET must be set in production");
      })()
    : "dev-secret");

