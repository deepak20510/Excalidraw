import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

export function middleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    res.status(403).json({
      message: "Unauthorized",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded && (decoded as JwtPayload).userId) {
      (req as any).userId = (decoded as JwtPayload).userId;
      next();
    } else {
      res.status(403).json({
        message: "Unauthorized",
      });
    }
  } catch (e) {
    res.status(403).json({
      message: "Unauthorized",
    });
  }
}

