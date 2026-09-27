// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	// GitHub Pages serves the site at https://thismesandeep.github.io/docchunk/.
	// Change `site` and `base` together if the repository is renamed or a custom domain is added.
	site: "https://thismesandeep.github.io",
	base: "/docchunk",
	integrations: [
		starlight({
			title: "docchunk",
			description:
				"Local document chunking for RAG: turn PDFs, Office files, Markdown, and text into chunks ready for embedding.",
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/thisMeSandeep/docchunk" },
			],
			// Placeholder navigation from the Starlight template, replaced when the docs are written.
			sidebar: [
				{
					label: "Guides",
					items: [{ label: "Example Guide", slug: "guides/example" }],
				},
				{
					label: "Reference",
					items: [{ autogenerate: { directory: "reference" } }],
				},
			],
		}),
	],
});
