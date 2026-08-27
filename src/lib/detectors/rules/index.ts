import { resolveOverlaps } from "../merge";
import type { Span } from "../types";
import { detectEmail } from "./email";
import { detectCreditCard } from "./creditCard";
import { detectMyNumber } from "./myNumber";
import { detectPostalCode } from "./postalCode";
import { detectPhone } from "./phone";

/**
 * Runs every rule-based detector and resolves any overlaps between them.
 * Order below is the tie-break priority for coincidental overlaps: the most
 * specific / least ambiguous pattern (email, then Luhn-validated credit card)
 * takes precedence over more permissive digit patterns (phone last).
 */
export function detectByRules(text: string): Span[] {
  const spans: Span[] = [
    ...detectEmail(text),
    ...detectCreditCard(text),
    ...detectMyNumber(text),
    ...detectPostalCode(text),
    ...detectPhone(text),
  ];
  return resolveOverlaps(spans);
}
