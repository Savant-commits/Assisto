import { z } from "zod";

export const BLOCKED_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
] as const;

const blockedEmailDomains: ReadonlySet<string> = new Set(BLOCKED_EMAIL_DOMAINS);
const emailTldPattern = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
const blockedEmailMessage = "Please use a real email address you can access.";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email must be 254 characters or fewer.")
  .email("Enter a valid email address.")
  .refine((email) => emailTldPattern.test(email) && !email.includes(".."), "Enter a valid email address.")
  .refine((email) => !blockedEmailDomains.has(email.slice(email.lastIndexOf("@") + 1)), blockedEmailMessage);
