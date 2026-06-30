import type { ClubCategory } from "../api/clubs.js";

export const clubCategoryOptions: Array<{
  value: ClubCategory;
  label: string;
}> = [
  { value: "BOOKS", label: "Books" },
  { value: "TV_SHOWS", label: "TV Shows" },
  { value: "ANIME", label: "Anime" },
  { value: "MANGA", label: "Manga" },
  { value: "MOVIES", label: "Movies" },
  { value: "GAMES", label: "Games" },
  { value: "PODCASTS", label: "Podcasts" },
  { value: "COURSES", label: "Courses" },
  { value: "COMICS_GRAPHIC_NOVELS", label: "Comics & Graphic Novels" },
  { value: "WEB_SERIALS", label: "Web Serials" },
  { value: "CUSTOM_TIMELINE", label: "Custom Timeline" }
];

export const clubCategoryLabels = Object.fromEntries(
  clubCategoryOptions.map((option) => [option.value, option.label])
) as Record<ClubCategory, string>;

export const formatClubCategory = (category: ClubCategory) =>
  clubCategoryLabels[category];
