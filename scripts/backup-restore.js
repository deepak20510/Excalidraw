/**
 * Canvas & Database Backup & Restore Utility
 * 
 * Usage:
 *   node scripts/backup-restore.js export [roomId] [outputJsonPath]
 *   node scripts/backup-restore.js import [inputJsonPath] [targetRoomId]
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../packages/db/dist");

const prisma = new PrismaClient();

async function exportRoom(roomId, outputPath) {
  const numericId = Number(roomId);
  console.log(`📦 Exporting canvas data for Room #${numericId}...`);

  const room = await prisma.room.findUnique({
    where: { id: numericId },
    select: { id: true, slug: true, isLocked: true, createdAt: true },
  });

  if (!room) {
    console.error(`❌ Room #${numericId} not found.`);
    process.exit(1);
  }

  const shapes = await prisma.shape.findMany({
    where: { roomId: numericId },
    orderBy: { id: "asc" },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    room,
    shapeCount: shapes.length,
    shapes: shapes.map((s) => ({
      id: s.id,
      type: s.type,
      data: s.data,
      style: s.style,
      updatedAt: s.updatedAt,
    })),
  };

  const file = outputPath || path.join(__dirname, `canvas_backup_room_${numericId}_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`✅ Successfully exported ${shapes.length} shapes to: ${file}`);
}

async function importRoom(inputPath, targetRoomId) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  const numericId = Number(targetRoomId);
  console.log(`📥 Importing canvas data into Room #${numericId}...`);

  const room = await prisma.room.findUnique({ where: { id: numericId } });
  if (!room) {
    console.error(`❌ Target Room #${numericId} does not exist. Please create it first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.shapes)) {
    console.error(`❌ Invalid backup file format: 'shapes' array missing.`);
    process.exit(1);
  }

  // Insert shapes safely into target room
  const shapesToCreate = data.shapes.map((s) => ({
    roomId: numericId,
    userId: room.adminId,
    type: s.type || "unknown",
    data: s.data || {},
    style: s.style || {},
    updatedAt: new Date(),
  }));

  const result = await prisma.shape.createMany({
    data: shapesToCreate,
  });

  console.log(`✅ Successfully restored ${result.count} shapes into Room #${numericId}.`);
}

async function main() {
  const [command, arg1, arg2] = process.argv.slice(2);

  try {
    if (command === "export" && arg1) {
      await exportRoom(arg1, arg2);
    } else if (command === "import" && arg1 && arg2) {
      await importRoom(arg1, arg2);
    } else {
      console.log(`\nUsage:`);
      console.log(`  node scripts/backup-restore.js export <roomId> [outputFilePath]`);
      console.log(`  node scripts/backup-restore.js import <inputFilePath> <targetRoomId>\n`);
    }
  } catch (err) {
    console.error("Operation failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
