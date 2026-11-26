export type AppRoute =
  | { name: "home" }
  | { name: "profile" }
  | { name: "progress" }
  | { name: "lesson"; lessonId: string };

export function routeFromHash(hash: string): AppRoute {
  const normalized = hash.replace(/^#\/?/, "").split("?")[0];
  if (normalized === "profile") return { name: "profile" };
  if (normalized === "progress") return { name: "progress" };
  const lessonMatch = normalized.match(/^lessons\/([^/?#]+)$/);
  if (lessonMatch) {
    try {
      return { name: "lesson", lessonId: decodeURIComponent(lessonMatch[1]) };
    } catch {
      return { name: "home" };
    }
  }
  return { name: "home" };
}

export function hashFromRoute(route: AppRoute): string {
  if (route.name === "profile") return "#/profile";
  if (route.name === "progress") return "#/progress";
  if (route.name === "lesson") return "#/lessons/" + encodeURIComponent(route.lessonId);
  return "#/";
}
