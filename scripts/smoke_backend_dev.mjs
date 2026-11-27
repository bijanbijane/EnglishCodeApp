#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.BACKEND_BASE_URL || "https://englishcode-frontend-dev.bijanbijane-1.workers.dev").replace(/\/$/, "");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error(`${path}: expected JSON, received non-JSON response (HTTP ${response.status})`);
  }
  assert(response.status === expectedStatus, `${path}: expected HTTP ${expectedStatus}, received HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function assertNoAnswerMaterial(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAnswerMaterial(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[_-]/g, "").toLowerCase();
    assert(!["answerkey", "correctanswer", "iscorrect", "explanation"].includes(normalized), `Public content leaked answer material at ${path}.${key}`);
    assertNoAnswerMaterial(child, `${path}.${key}`);
  }
}

async function main() {
  const checks = [];
  const health = await request("/api/v1/health");
  assert(health?.status === "ok", "Health payload did not report status=ok.");
  checks.push("health");

  const readiness = await request("/api/v1/ready");
  assert(readiness?.data?.status === "ready" && readiness?.data?.database === "ok", "D1 readiness check failed.");
  checks.push("readiness+d1");

  const coursesPayload = await request("/api/v1/courses");
  const courses = coursesPayload?.data;
  assert(Array.isArray(courses) && courses.length > 0, "Published course list is empty or malformed.");
  const course = courses.find((item) => item.id === "course-english-foundations");
  assert(course, "Expected seeded course course-english-foundations was not returned.");
  checks.push("published-courses");

  const lessonsPayload = await request(`/api/v1/courses/${encodeURIComponent(course.id)}/lessons`);
  const lessons = lessonsPayload?.data;
  assert(Array.isArray(lessons), "Published lesson list is malformed.");
  assert(lessons.some((item) => item.id === "lesson-greetings-001"), "Expected seeded lesson was not returned.");
  checks.push("published-lessons");

  const lessonPayload = (await request("/api/v1/lessons/lesson-greetings-001"))?.data;
  assert(lessonPayload?.id === "lesson-greetings-001", "Lesson detail payload has an unexpected id.");
  assert(Array.isArray(lessonPayload.questions) && lessonPayload.questions.length > 0, "Lesson questions are missing.");
  assertNoAnswerMaterial(lessonPayload);
  checks.push("lesson-detail+answer-privacy");

  const profile = await request("/api/v1/me", 401);
  assert(profile?.error?.code === "UNAUTHENTICATED", "Unauthenticated profile request did not return UNAUTHENTICATED.");
  checks.push("authentication-boundary");

  process.stdout.write(JSON.stringify({ status: "passed", baseUrl, checks, questionCount: lessonPayload.questions.length }) + "\\n");
}

main().catch((error) => {
  process.stderr.write(`Backend development smoke test failed: ${error.message}\\n`);
  process.exitCode = 1;
});
