// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// The groups and order follow docs/DOCUMENTATION-PLAN.md section 2.
const sidebar = [
	{
		label: "Getting started",
		items: ["docs/introduction", "docs/quickstart", "docs/how-it-works"],
	},
	{
		label: "Guides",
		items: ["docs/guides/chunk-document", "docs/guides/chunk-documents"],
	},
	{
		label: "Strategies",
		items: [
			{ label: "Overview", slug: "docs/strategies" },
			"docs/strategies/structure",
			"docs/strategies/heading",
			"docs/strategies/paragraph",
			"docs/strategies/sentence",
			"docs/strategies/sentence-window",
			"docs/strategies/parent-child",
			"docs/strategies/hierarchical",
			"docs/strategies/recursive",
			"docs/strategies/fixed",
			"docs/strategies/fixed-overlap",
			"docs/strategies/sliding-window",
			"docs/strategies/compare",
		],
	},
	{
		label: "Reference",
		items: [
			"docs/reference/chunk-document",
			"docs/reference/chunk-documents",
			"docs/reference/build-chunk-tree",
			"docs/reference/docchunk-error",
			"docs/reference/options",
			"docs/reference/types",
			"docs/reference/warnings",
			"docs/reference/error-codes",
			"docs/reference/formats",
		],
	},
	{
		label: "AI & agents",
		items: ["docs/ai/agent-skill", "docs/ai/setup-prompt", "docs/ai/llms-txt"],
	},
	{
		label: "Resources",
		items: ["docs/limitations", "docs/privacy", "docs/performance"],
	},
	"docs/contributing",
];

/** Returns every page slug in the sidebar, in sidebar order. */
function sidebarSlugs(items) {
	const slugs = [];
	for (const item of items) {
		if (typeof item === "string") {
			slugs.push(item);
		} else if ("slug" in item) {
			slugs.push(item.slug);
		} else {
			slugs.push(...sidebarSlugs(item.items));
		}
	}
	return slugs;
}

// https://astro.build/config
export default defineConfig({
	// GitHub Pages serves the site at https://thismesandeep.github.io/docchunk/.
	// Change `site` and `base` together if the repository is renamed or a custom domain is added.
	site: "https://thismesandeep.github.io",
	base: "/docchunk",
	integrations: [
		starlight({
			title: "Doc-chunk",
			description:
				"Local document chunking for RAG: turn PDFs, Office files, Markdown, and text into chunks ready for embedding.",
			favicon: "/favicon.svg",
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/thisMeSandeep/docchunk" },
			],
			editLink: {
				baseUrl: "https://github.com/thisMeSandeep/docchunk/edit/main/website/",
			},
			customCss: ["@fontsource-variable/inter", "./src/styles/docs.css"],
			// The site is dark only, like the landing page, so code blocks use one dark theme.
			expressiveCode: {
				themes: ["github-dark-default"],
				useStarlightDarkModeSwitch: false,
				styleOverrides: {
					borderRadius: "12px",
					borderColor: "rgba(255, 255, 255, 0.1)",
					codeBackground: "#0f0f11",
					codeFontSize: "0.875rem",
					frames: {
						editorTabBarBackground: "#0f0f11",
						editorActiveTabBackground: "#0f0f11",
						editorActiveTabIndicatorTopColor: "transparent",
						editorActiveTabIndicatorBottomColor: "rgba(255, 255, 255, 0.4)",
						terminalTitlebarBackground: "#0f0f11",
						terminalBackground: "#0f0f11",
						frameBoxShadowCssValue: "none",
					},
				},
			},
			components: {
				Header: "./src/components/docs/DocsHeader.astro",
				SiteTitle: "./src/components/docs/DocsSiteTitle.astro",
				PageTitle: "./src/components/docs/DocsPageTitle.astro",
				ThemeProvider: "./src/components/docs/DarkThemeProvider.astro",
				ThemeSelect: "./src/components/docs/NoThemeSelect.astro",
			},
			sidebar,
			plugins: [
				starlightLlmsTxt({
					projectName: "Doc-chunk",
					details: [
						"- The npm package is `docchunk`. It runs on Node.js 22.12 or later, and on Bun.",
						"- All sizes are in characters, not tokens.",
						"- Everything runs locally. There is no OCR, so scanned PDFs give no chunks.",
					].join("\n"),
					// Pages appear in llms-full.txt in the same order as in the sidebar.
					promote: sidebarSlugs(sidebar),
					customSets: [
						{
							label: "Getting started and guides",
							paths: ["docs/introduction", "docs/quickstart", "docs/how-it-works", "docs/guides/**"],
							description: "what Doc-chunk is, installation, and how to use chunkDocument and chunkDocuments",
						},
						{
							label: "Strategies",
							paths: ["docs/strategies", "docs/strategies/**"],
							description: "the 11 chunking strategies, their options, and examples",
						},
						{
							label: "Reference",
							paths: ["docs/reference/**"],
							description: "functions, options, types, warnings, error codes, and formats",
						},
					],
					optionalLinks: [
						{
							label: "Agent skill",
							url: "https://thismesandeep.github.io/docchunk/skill/SKILL.md",
							description: "a SKILL.md file with install steps, a strategy table, examples, and pitfalls",
						},
					],
				}),
			],
		}),
	],
});
