/**
 * Fail-closed rules for public occupational snapshots.
 * Any future skill mapping or promotion to a VERIFIED role requires a different
 * reviewed data pipeline; this catalog must remain exploratory-only.
 */
export function validateOccupationSnapshot(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["Snapshot must be an object"];
  if (!/^onet-online-curated-\d{4}-\d{2}-\d{2}-v\d+$/.test(data.snapshotId ?? "")) errors.push("Invalid snapshot ID");
  if (data.sourceProduct !== "O*NET OnLine") errors.push("Wrong source product");
  if (data.license !== "CC BY 4.0" || data.licenseUrl !== "https://creativecommons.org/licenses/by/4.0/") errors.push("Missing correct source license");
  if (data.attributionUrl !== "https://www.onetonline.org/help/license") errors.push("Missing official attribution source");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.accessedDate ?? "")) errors.push("Missing source access date");
  if (!data.modificationNote?.includes("not approved, endorsed, or tested")) errors.push("Missing non-endorsement statement");
  if (!Array.isArray(data.occupations) || data.occupations.length < 3) return [...errors,"At least three sourced professions required"];
  const codes = new Set();
  const families = new Set();
  for (const [index,item] of data.occupations.entries()) {
    const prefix = "Occupation " + index;
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(item.onetSocCode ?? "")) errors.push(prefix + " invalid O*NET-SOC code");
    if (codes.has(item.onetSocCode)) errors.push(prefix + " duplicate occupational ID");
    codes.add(item.onetSocCode);
    if (item.occupationId !== "onet:" + item.onetSocCode) errors.push(prefix + " internal ID does not match official code");
    if (item.sourceUrl !== "https://www.onetonline.org/link/details/" + item.onetSocCode) errors.push(prefix + " official source URL does not match code");
    if (item.sourceUpdatedYear !== 2026) errors.push(prefix + " missing source vintage");
    if (item.countryContext !== "US") errors.push(prefix + " incorrect regional context");
    if (item.status !== "EXPLORATORY") errors.push(prefix + " cannot be promoted to verified");
    if (!item.name?.trim() || !item.family?.trim() || !item.description?.trim()) errors.push(prefix + " missing sourced description");
    families.add(item.family);
    for (const field of ["essentialSkills","transferableSkills"]) {
      if (!Array.isArray(item[field]) || item[field].length < 3 || item[field].length > 12) {
        errors.push(prefix + " invalid " + field + " list");
        continue;
      }
      const names = new Set();
      for (const [i,skill] of item[field].entries()) {
        if (!skill.name?.trim() || names.has(skill.name.toLowerCase())) errors.push(prefix + " duplicate/empty skill in " + field);
        names.add(skill.name?.toLowerCase());
        if (!Number.isInteger(skill.importance) || skill.importance < 0 || skill.importance > 100) errors.push(prefix + " invalid importance");
        if (skill.sourceOrder !== i+1) errors.push(prefix + " invalid ordering");
        if (skill.mappingStatus !== "UNMAPPED") errors.push(prefix + " unreviewed skill was presented as mapped");
        if ("skillTwinSkillId" in skill || "verified" in skill) errors.push(prefix + " unauthorized mapping or verification field");
      }
    }
  }
  if (families.size < 3) errors.push("Insufficient career-family coverage");
  return errors;
}
