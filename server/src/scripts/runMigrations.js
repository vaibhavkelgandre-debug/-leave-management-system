import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "..", "sql");

async function run() {
    const files = fs
        .readdirSync(sqlDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

    for (const file of files) {
        const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
        console.log(`Applying ${file}...`);
        await pool.query(sql);
    }

    console.log(`Applied ${files.length} migration file(s).`);
    await pool.end();
}

run().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
});
