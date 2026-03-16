/**
 * Migration script: Copies existing assignedToId data from work_orders
 * into the new work_order_assignments join table.
 *
 * Run this AFTER the additive migration (which creates work_order_assignments)
 * and BEFORE the destructive migration (which removes assignedToId).
 *
 * Usage: npx tsx prisma/migrate-assignments.ts
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting assignment migration...');

  // Find all work orders that have an assignedToId
  const workOrders = await prisma.$queryRaw<{ id: string; assignedToId: string }[]>`
    SELECT id, "assignedToId" FROM work_orders WHERE "assignedToId" IS NOT NULL
  `;

  console.log(`Found ${workOrders.length} work orders with assignments`);

  if (workOrders.length === 0) {
    console.log('No assignments to migrate.');
    return;
  }

  // Insert into work_order_assignments, skip duplicates
  let migrated = 0;
  let skipped = 0;

  for (const wo of workOrders) {
    try {
      await prisma.workOrderAssignment.create({
        data: {
          workOrderId: wo.id,
          userId: wo.assignedToId,
        },
      });
      migrated++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - already exists
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`Migration complete: ${migrated} created, ${skipped} skipped (already exist)`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
