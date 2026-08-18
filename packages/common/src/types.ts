import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  name: z.string().min(1).max(50),
});

export const SigninSchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(1),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(3).max(50),
});

