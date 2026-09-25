export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { auctionsRef } from "@/lib/firebase-admin";

const GEARS = [
  "Bradium Brooch", "Cold_Heart", "Eye of Dullahan", "Flower Ring", 
  "Golden Bell", "Kind Heart", "Morriganes_Belt", "Morriganes_Pendant", 
  "Nile Rose", "Orleans's Necklace", "Orleanss_Glove", "Rogues_Treasure", 
  "Safety Ring", "Scream_Ring"
];

const CARDS = [
  "maya Angeling Card", "maya Dracula Card", "maya Goblin Leader Card",
  "maya Mistress Card", "maya Orc Hero Card", "maya Orc Lord Card",
  "maya Osiris Card", "maya Phreeoni Card"
];

const RELICS = [
  { name: "เธฅเนเธฒเธเธเธฅเธฒเธ", file: "Blade_of_Destruction" },
  { name: "เธเธดเธ—เธฑเธเธฉเน", file: "Radiant_Holy_Shield" }
];

const STATS = ["INT+10", "AGI+10", "DEX+10", "STR+10", "VIT+10"];

import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const batch = auctionsRef().firestore.batch();
    const now = Date.now();
    let count = 0;

    // Add Gears
    for (const gear of GEARS) {
      const ref = auctionsRef().doc();
      batch.set(ref, {
        itemName: gear.replace(/_/g, " "),
        category: "gear",
        imageUrl: `/images/auctions/${gear}.png`,
        status: "open",
        queueCount: 0,
        createdAt: now,
        createdBy: "System Seed",
        updatedAt: now
      });
      count++;
    }

    // Add Cards
    for (const card of CARDS) {
      const ref = auctionsRef().doc();
      batch.set(ref, {
        itemName: card.replace(/_/g, " "),
        category: "card",
        imageUrl: `/images/auctions/${card}.png`,
        status: "open",
        queueCount: 0,
        createdAt: now,
        createdBy: "System Seed",
        updatedAt: now
      });
      count++;
    }

    // Add Relics
    for (const relic of RELICS) {
      for (const stat of STATS) {
        const ref = auctionsRef().doc();
        batch.set(ref, {
          itemName: `${relic.name} (${stat})`,
          category: "relic",
          imageUrl: `/images/auctions/${relic.file}.png`,
          status: "open",
          queueCount: 0,
          createdAt: now,
          createdBy: "System Seed",
          updatedAt: now
        });
        count++;
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

