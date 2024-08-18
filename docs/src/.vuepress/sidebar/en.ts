import { sidebar } from "vuepress-theme-hope";

export const enSidebar = sidebar({
  "/": [
    "",
    {
      text: "Getting Started",
      link: "intro.md",
      children: [
        {
          text: "What is Suiftly?",
          link: "intro.md",
        },
        {
          text: "Pricing",
          link: "pricing.md",
        },
      ],
    },
    {
      text: "Community",
      link: "community/",
      children: [
        {
          text: "Forums / Contacts",
          link: "community/",
        },
        {
          text: "Related Projects",
          link: "community/links.md",
        },
      ],
    },
  ],
});
