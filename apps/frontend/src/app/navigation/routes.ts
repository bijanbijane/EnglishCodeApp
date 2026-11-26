export type AppRoute =
  | { name: "home" }
  | { name: "profile" }
  | { name: "lesson"; lessonId: string };

export function routeFromHash(hash: string): AppRoute {
  const normalized = hash.replace(/^#\/?/, "");
  if (normalized === "profile") return { name: "profile" };
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
  if (route.name === "lesson") return "#/lessons/" + encodeURIComponent(route.lessonId);
  return "#/";
}
