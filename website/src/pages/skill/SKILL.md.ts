// Serves the agent skill at /skill/SKILL.md, from the same file the Agent skill page shows.
import skill from "../../skill/SKILL.md?raw";

/** Returns the skill file as Markdown. */
export function GET(): Response {
	return new Response(skill, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
