"use strict";

const { z } = require("zod");

exports.CreateUserSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string(),
  name: z.string(),
});

exports.SigninSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string(),
});

exports.CreateRoomSchema = z.object({
  name: z.string().min(3).max(20),
});
