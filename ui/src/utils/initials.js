// Up to two initials from a display name, tolerating extra whitespace and characters outside the BMP.
export function getInitials(name) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0].toUpperCase())
    .join("");
}
