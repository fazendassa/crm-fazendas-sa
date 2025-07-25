import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";

// Pegue a URL do JWKS do seu projeto Supabase em Settings > API > JWT Secret
// 1) Para projetos Supabase que utilizam chaves RS256, defina SUPABASE_JWKS_URI.
// 2) Para projetos padrão (HS256) basta definir SUPABASE_JWT_SECRET com a "anon" ou "service_role" secret.
const SUPABASE_JWKS_URI = process.env.SUPABASE_JWKS_URI;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_ANON_KEY;

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }
  const token = auth.replace("Bearer ", "");

  // Decide dinamicamente qual estratégia usar
const verifyCallback = async (err: any, decoded: JwtPayload | string | undefined) => {
      console.log('[requireUser] Middleware triggered.');
      if (err || !decoded || typeof decoded === 'string') {
        console.error('[requireUser] JWT ERROR:', err);
        return res.status(401).json({ message: "Invalid token", error: err?.message });
      }

      try {
        const userId = decoded.sub;
        console.log(`[requireUser] Processing user ID: ${userId}`);

        const userInDb = await db.query.users.findFirst({
          where: (usersTable, { eq }) => eq(usersTable.id, userId!)
        });

        if (!userInDb) {
          console.log(`[requireUser] User ${userId} not found in DB. Attempting to create.`);
          await db.insert(users).values({
            id: userId!,
            email: decoded.email!,
          }).onConflictDoNothing();
          console.log(`[requireUser] User ${userId} creation/sync complete.`);
        } else {
          console.log(`[requireUser] User ${userId} found in DB. Skipping creation.`);
        }

        (req as any).user = decoded;
        next();
      } catch (dbError) {
        console.error('[requireUser] DB SYNC ERROR:', dbError);
        return res.status(500).json({ message: "Database synchronization failed" });
      }
    };

  if (SUPABASE_JWT_SECRET) {
    // Estratégia HS256 usando secret (anon ou service role)
    jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ["HS256"] }, verifyCallback);
  } else if (SUPABASE_JWKS_URI) {
    // Estratégia RS256 via JWKS
    const client = jwksClient({
      jwksUri: SUPABASE_JWKS_URI,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutos
    });

    const getKey = (header: any, callback: any) => {
      client.getSigningKey(header.kid, function (err, key) {
        if (err) {
          return callback(err);
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      });
    };

    jwt.verify(token, getKey, { algorithms: ["RS256"] }, verifyCallback);
  } else {
    return res.status(500).json({ message: "Server misconfiguration: No SUPABASE_JWT_SECRET or SUPABASE_JWKS_URI defined" });
  }
}
