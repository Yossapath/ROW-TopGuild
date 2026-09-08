export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb, COLL_USER } from "@/lib/firebase-admin";
import { signToken, authCookie } from "@/lib/auth";
import type { GuildUser, AuthPayload } from "@/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // 1. Verify CSRF state
  const cookieStore = cookies();
  const savedState = cookieStore.get("oauth_state")?.value;

  if (!state || !savedState || state !== savedState) {
    const res = NextResponse.redirect(new URL("/login?error=InvalidState", req.url));
    res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
    return res;
  }

  if (!code) {
    const res = NextResponse.redirect(new URL("/login?error=NoCode", req.url));
    res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
    return res;
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
      console.error("Discord OAuth Token Error:", tokenData);
      const desc = tokenData.error_description || tokenData.error;
      const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(desc)}`, req.url));
      res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
      return res;
    }

    if (!tokenData.access_token) {
      console.error("Discord OAuth Missing Token:", tokenData);
      const res = NextResponse.redirect(new URL("/login?error=MissingAccessToken", req.url));
      res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
      return res;
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok || !userData || !userData.id) {
      console.error("Discord OAuth User Fetch Error:", userData);
      const errorMsg = userData?.message || "DiscordUserFetchFailed";
      const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, req.url));
      res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
      return res;
    }

    const discordId = userData.id;
    const discordUsername = userData.username;

    // Check if user is configured as an admin via immutable Discord ID
    const adminIds = (process.env.ADMIN_DISCORD_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const isConfiguredAdmin = adminIds.includes(discordId);

    const defaultRole = isConfiguredAdmin ? "admin" : "member";
    let isProfileComplete = false;
    let payload: AuthPayload = {
      discordId,
      discordUsername,
      role: defaultRole,
      isProfileComplete: false,
    };

    try {
      const db = getDb();
      const userRef = db.collection(COLL_USER).doc(discordId);
      const doc = await userRef.get();

      if (doc.exists) {
        const data = doc.data() as GuildUser;
        const userRole = isConfiguredAdmin ? "admin" : (data.role || "member");

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
          await userRef.update({ discordUsername, role: userRole }).catch(() => {});
        }
      } else {
        const newUser: GuildUser = {
          discordId,
          discordUsername,
          role: defaultRole,
          createdAt: Date.now(),
        };
        await userRef.set(newUser).catch(() => {});
      }
    } catch (dbErr: any) {
      console.warn("Firestore lookup failed during login (fallback used):", dbErr);
      // Fallback allows user to log in via Discord even if Firestore quota is exhausted
    }

    const token = await signToken(payload);
    const res = NextResponse.redirect(new URL("/dashboard/roster", req.url));
    res.cookies.set(authCookie(token));
    // Clear the OAuth state cookie
    res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
    return res;

  } catch (err: any) {
    console.error("Discord OAuth Error:", err);
    const errorMsg = err?.message ? encodeURIComponent(err.message) : "OAuthFailed";
    const res = NextResponse.redirect(new URL(`/login?error=${errorMsg}`, req.url));
    res.cookies.set({ name: "oauth_state", value: "", maxAge: 0, path: "/" });
    return res;
  }
}
