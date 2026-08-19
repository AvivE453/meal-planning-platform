/**
 * Seeds food_items from scripts/seed.csv — a curated export of real,
 * verified foods with actual nutrition data, one row per food, columns
 * matching food_items exactly. Currently sourced from Israel's Ministry of
 * Health "Tzameret" national nutrition database (data.gov.il, ~4,600 real
 * entries, filtered/categorized down to ~3,500) — company is populated only
 * where that source data itself named a real brand (not guessed).
 *
 * Not part of the app's runtime — run manually, any time (safe to re-run;
 * upsertFoodItem is keyed on the unique `name`, so re-seeding just refreshes
 * values rather than duplicating rows):
 *
 *   pnpm --filter @meal-planning/api exec ts-node scripts/seed-food-items.ts
 *
 * seed.csv is the durable, hand-editable source of truth from here on — the
 * raw source data used to build it was a one-time input (downloaded,
 * selected from, and discarded; not kept in the repo). To add or change a
 * food, edit seed.csv directly and re-run this script.
 */
import { createReadStream, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

// Mirrors app.module.ts's ConfigModule envFilePath fallback ('.env' then
// '../../.env') so this script finds the root .env regardless of whether
// it's invoked from the repo root or from apps/api.
loadEnv({ path: existsSync('.env') ? '.env' : '../../.env' });
import { parse } from 'csv-parse';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { FoodItem } from '@meal-planning/shared-types';
import { upsertFoodItem } from '../src/nutrition/food-item-persistence';

type NewFoodItem = Omit<FoodItem, 'id'>;

interface SeedCsvRow {
  name: string;
  company: string;
  category: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  saturated_fat_g: string;
  sugar_g: string;
  sodium_mg: string;
  base_unit: string;
  default_serving_weight_grams: string;
}

async function readCsv(path: string): Promise<SeedCsvRow[]> {
  const rows: SeedCsvRow[] = [];
  const parser = createReadStream(path).pipe(parse({ columns: true }));
  for await (const row of parser as AsyncIterable<SeedCsvRow>) {
    rows.push(row);
  }
  return rows;
}

function toFoodItem(row: SeedCsvRow): NewFoodItem {
  return {
    name: row.name,
    company: row.company.trim() ? row.company : null,
    category: row.category,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    saturatedFatG: Number(row.saturated_fat_g),
    sugarG: Number(row.sugar_g),
    sodiumMg: Number(row.sodium_mg),
    baseUnit: row.base_unit,
    defaultServingWeightGrams: Number(row.default_serving_weight_grams),
  };
}

async function main() {
  const csvPath = process.argv[2] ?? 'scripts/seed.csv';
  const rows = await readCsv(csvPath);
  console.log(`Read ${rows.length} rows from ${csvPath}.`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  let seeded = 0;
  for (const row of rows) {
    await upsertFoodItem(prisma, toFoodItem(row));
    seeded++;
    if (seeded % 100 === 0) {
      console.log(`  ...${seeded} seeded so far`);
    }
  }

  console.log(`Done. Seeded ${seeded} foods.`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
