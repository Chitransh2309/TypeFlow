import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const DB_NAME = "typeflow";

// A single long-running process, unlike the Next.js app - no dev-mode hot-reload
// global caching needed, just a plain singleton connection promise.
const client = new MongoClient(process.env.MONGODB_URI);
const clientPromise = client.connect();

export async function getDb() {
  const c = await clientPromise;
  return c.db(DB_NAME);
}

export default clientPromise;
