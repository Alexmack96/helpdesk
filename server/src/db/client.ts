import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/index.js";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
export const db = new PrismaClient({ adapter });
