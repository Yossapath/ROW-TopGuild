export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
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
    const userRef = db.collection("users").doc(discordId);
    const doc = await userRef.get();

    let isProfileComplete = false;
    let payload: AuthPayload;

    if (doc.exists) {
      const data = doc.data() as GuildUser;
      isProfileComplete = !!data.gameUsername && !!data.class && data.power !== undefined;
      payload = {
        discordId,
        discordUsername: data.discordUsername || discordUsername,
        gameUsername: data.gameUsername,
        role: data.role || "member",
        class: data.class,
        power: data.power,
        isProfileComplete,
      };
      
      // Update discordUsername if it changed
      if (data.discordUsername !== discordUsername) {
        await userRef.update({ discordUsername });
      }
    } else {
      // New user
      const newUser: GuildUser = {
        discordId,
        discordUsername,
        role: "member",
        createdAt: Date.now(),
      };
      await userRef.set(newUser);
      
      payload = {
        discordId,
        discordUsername,
        role: "member",
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
