import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const personas = [
  {
    id: "new-user",
    name: "First-time Explorer",
    description: "Unfamiliar with the product and dependent on clear labels and guidance.",
    traits: ["low familiarity", "reads instructions", "cautious"],
    patience: 62,
    confidence: 34,
  },
  {
    id: "impatient-shopper",
    name: "Impatient Shopper",
    description: "Moves quickly, skips supporting copy, and abandons after repeated friction.",
    traits: ["fast scanning", "low patience", "mobile-first"],
    patience: 24,
    confidence: 78,
  },
  {
    id: "keyboard-user",
    name: "Keyboard Navigator",
    description: "Completes the entire journey without a mouse and expects visible focus states.",
    traits: ["keyboard-only", "accessibility", "systematic"],
    accessibility: "Keyboard-only navigation",
    patience: 76,
    confidence: 70,
  },
  {
    id: "cautious-buyer",
    name: "Cautious Buyer",
    description: "Looks for reassurance, pricing clarity, and reversible actions before proceeding.",
    traits: ["risk-aware", "detail-oriented", "trust-sensitive"],
    patience: 84,
    confidence: 45,
  },
];

async function main() {
  for (const persona of personas) {
    await prisma.persona.upsert({
      where: { id: persona.id },
      update: persona,
      create: persona,
    });
  }

  await prisma.project.upsert({
    where: { id: "demo-storefront" },
    update: {
      name: "Hexaware Website",
      targetUrl: "https://example.com",
    },
    create: {
      id: "demo-storefront",
      name: "Hexaware Website",
      targetUrl: "https://example.com",
    },
  });
}

main()
  .finally(async () => prisma.$disconnect());
