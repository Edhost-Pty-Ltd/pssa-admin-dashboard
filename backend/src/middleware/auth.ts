import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../lib/http.js";

/** The JWT is kept in an httpOnly cookie so page scripts can never read it. */
export const SESSION_COOKIE = "ec_session";

export type AuthUser = Pick<User, "id" | "email" | "role" | "firstName" | "lastName">;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface SessionPayload {
  sub: string;
  role: Role;
  /** Must equal the user's current tokenVersion, so signing out revokes every earlier token. */
  tv: number;
}

const cookieOptions = { httpOnly: true, sameSite: "lax", secure: config.isProd, path: "/" } as const;

export function issueSession(res: Response, user: Pick<User, "id" | "role" | "tokenVersion">) {
  const token = jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion } satisfies SessionPayload, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${config.jwtExpiresInDays}d`,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.jwtExpiresInDays * 24 * 60 * 60 * 1000 });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Attaches req.user when a valid, unrevoked session cookie is present. Never rejects; bad cookies are cleared. */
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tv) {
      clearSession(res);
      return next();
    }
    const { tokenVersion: _tv, ...authUser } = user;
    req.user = authUser;
  } catch {
    clearSession(res);
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

/** 401 when signed out, 403 when signed in with a role that is not allowed. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
