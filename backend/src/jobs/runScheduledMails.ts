import { prisma } from "../lib/prisma.js";
import { runAllScheduledMails } from "./scheduledMails.js";

const summary = await runAllScheduledMails();
console.log("[jobs:mails]", summary);
await prisma.$disconnect();
