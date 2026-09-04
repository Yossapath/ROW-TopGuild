export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb, COLL_USER } from "@/lib/firebase-admin";
import { signToken, authCookie } from "@/lib/auth";
import type { GuildUser, AuthPayload } from "@/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=NoCode", req.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Discord config missing" }, { status: 500 });
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/login?error=${tokenData.error}`, req.url));
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    const discordId = userData.id;
    const discordUsername = userData.username;

    const db = getDb();
    const userRef = db.collection(COLL_USER).doc(discordId);
    const doc = await userRef.get();

    let isProfileComplete = false;
    let payload: AuthPayload;

    const defaultRole = discordUsername === "datefourinmonthmay" ? "admin" : "member";

    if (doc.exists) {
      const data = doc.data() as GuildUser;
      const userRole = (discordUsername === "datefourinmonthmay") ? "admin" : (data.role || "member");

      isProfileComplete = !!data.gameUsername && !!data.class && data.power !== undefined;
      payload = {
        discordId,
        discordUsername: data.discordUsername || discordUsername,
        gameUsername: data.gameUsername,
        role: userRole,
        class: data.class,
        power: data.power,
        isProfileComplete,
      };
      
      if (data.discordUsername !== discordUsername || data.role !== userRole) {
        await userRef.update({ discordUsername, role: userRole });
      }
    } else {
      const newUser: GuildUser = {
        discordId,
        discordUsername,
        role: defaultRole,
        createdAt: Date.now(),
      };
      await userRef.set(newUser);
      
      payload = {
        discordId,
        discordUsername,
        role: defaultRole,
        isProfileComplete: false,
      };
    }

    const token = await signToken(payload);
    const res = NextResponse.redirect(new URL("/dashboard/roster", req.url));
    res.cookies.set(authCookie(token));
    return res;

  } catch (err: any) {
    console.error("Discord OAuth Error:", err);
    return NextResponse.redirect(new URL("/login?error=OAuthFailed", req.url));
  }
}
