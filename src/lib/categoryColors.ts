import type { EntityCategory } from "./detectors/types";

/** Background/foreground colors for each category's highlight badge. */
export const CATEGORY_COLORS: Record<EntityCategory, { bg: string; fg: string }> = {
  EMAIL: { bg: "#dbeafe", fg: "#1e40af" },
  PHONE: { bg: "#dcfce7", fg: "#166534" },
  CREDIT_CARD: { bg: "#fee2e2", fg: "#991b1b" },
  MY_NUMBER: { bg: "#ede9fe", fg: "#5b21b6" },
  POSTAL_CODE: { bg: "#ffedd5", fg: "#9a3412" },
  PERSON: { bg: "#fce7f3", fg: "#9d174d" },
  ADDRESS: { bg: "#ccfbf1", fg: "#115e59" },
  ORGANIZATION: { bg: "#e0e7ff", fg: "#3730a3" },
};
