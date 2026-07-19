export const PROJECT_TYPES = [
  "AV",
  "Design",
  "Design Hours",
  "Electricity",
  "Fridge",
  "Gas Stove",
  "HARD",
  "Headingly_415",
  "Headingly_Store_room",
  "HOST",
  "MED",
  "Packwood_Room_1",
  "Referrals",
  "Solar",
  "Water",
  "WEB",
  "Web Security",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const isProjectType = (v: string | null | undefined): v is ProjectType =>
  !!v && (PROJECT_TYPES as readonly string[]).includes(v);
