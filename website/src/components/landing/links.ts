// Where the landing page's links point. The docs routes follow docs/DOCUMENTATION-PLAN.md.

/** The site's base path without a trailing slash, for example "/docchunk". */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The Quickstart page, where "Get started" leads. */
export const getStartedHref = `${basePath}/docs/quickstart/`;

/** The library's GitHub repository. */
export const githubHref = "https://github.com/thisMeSandeep/docchunk";

/** Returns the URL of a file in public/, respecting the base path. */
export function publicFile(fileName: string): string {
  return `${basePath}/${fileName}`;
}
