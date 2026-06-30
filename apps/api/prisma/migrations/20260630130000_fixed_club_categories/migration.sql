CREATE TYPE "ClubCategory" AS ENUM (
  'BOOKS',
  'TV_SHOWS',
  'ANIME',
  'MANGA',
  'MOVIES',
  'GAMES',
  'PODCASTS',
  'COURSES',
  'COMICS_GRAPHIC_NOVELS',
  'WEB_SERIALS',
  'CUSTOM_TIMELINE'
);

DROP INDEX IF EXISTS "clubs_search_vector_idx";

ALTER TABLE "clubs"
  ADD COLUMN "category_next" "ClubCategory";

UPDATE "clubs"
SET "category_next" = CASE lower(trim(coalesce("category", '')))
  WHEN 'book' THEN 'BOOKS'::"ClubCategory"
  WHEN 'books' THEN 'BOOKS'::"ClubCategory"
  WHEN 'fantasy' THEN 'BOOKS'::"ClubCategory"
  WHEN 'sci-fi' THEN 'BOOKS'::"ClubCategory"
  WHEN 'scifi' THEN 'BOOKS'::"ClubCategory"
  WHEN 'science fiction' THEN 'BOOKS'::"ClubCategory"
  WHEN 'show' THEN 'TV_SHOWS'::"ClubCategory"
  WHEN 'shows' THEN 'TV_SHOWS'::"ClubCategory"
  WHEN 'tv show' THEN 'TV_SHOWS'::"ClubCategory"
  WHEN 'tv shows' THEN 'TV_SHOWS'::"ClubCategory"
  WHEN 'anime' THEN 'ANIME'::"ClubCategory"
  WHEN 'manga' THEN 'MANGA'::"ClubCategory"
  WHEN 'movie' THEN 'MOVIES'::"ClubCategory"
  WHEN 'movies' THEN 'MOVIES'::"ClubCategory"
  WHEN 'film' THEN 'MOVIES'::"ClubCategory"
  WHEN 'films' THEN 'MOVIES'::"ClubCategory"
  WHEN 'game' THEN 'GAMES'::"ClubCategory"
  WHEN 'games' THEN 'GAMES'::"ClubCategory"
  WHEN 'podcast' THEN 'PODCASTS'::"ClubCategory"
  WHEN 'podcasts' THEN 'PODCASTS'::"ClubCategory"
  WHEN 'course' THEN 'COURSES'::"ClubCategory"
  WHEN 'courses' THEN 'COURSES'::"ClubCategory"
  WHEN 'comic' THEN 'COMICS_GRAPHIC_NOVELS'::"ClubCategory"
  WHEN 'comics' THEN 'COMICS_GRAPHIC_NOVELS'::"ClubCategory"
  WHEN 'graphic novel' THEN 'COMICS_GRAPHIC_NOVELS'::"ClubCategory"
  WHEN 'graphic novels' THEN 'COMICS_GRAPHIC_NOVELS'::"ClubCategory"
  WHEN 'comics & graphic novels' THEN 'COMICS_GRAPHIC_NOVELS'::"ClubCategory"
  WHEN 'web serial' THEN 'WEB_SERIALS'::"ClubCategory"
  WHEN 'web serials' THEN 'WEB_SERIALS'::"ClubCategory"
  WHEN 'custom' THEN 'CUSTOM_TIMELINE'::"ClubCategory"
  WHEN 'custom timeline' THEN 'CUSTOM_TIMELINE'::"ClubCategory"
  ELSE 'CUSTOM_TIMELINE'::"ClubCategory"
END;

ALTER TABLE "clubs"
  DROP COLUMN "category";

ALTER TABLE "clubs"
  RENAME COLUMN "category_next" TO "category";

ALTER TABLE "clubs"
  ALTER COLUMN "category" SET NOT NULL;

CREATE INDEX "clubs_category_idx" ON "clubs"("category");

CREATE INDEX "clubs_search_vector_idx"
  ON "clubs"
  USING GIN (
    to_tsvector(
      'english',
      coalesce("title", '') || ' ' ||
      coalesce("description", '') || ' ' ||
      CASE "category"
        WHEN 'BOOKS' THEN 'Books'
        WHEN 'TV_SHOWS' THEN 'TV Shows'
        WHEN 'ANIME' THEN 'Anime'
        WHEN 'MANGA' THEN 'Manga'
        WHEN 'MOVIES' THEN 'Movies'
        WHEN 'GAMES' THEN 'Games'
        WHEN 'PODCASTS' THEN 'Podcasts'
        WHEN 'COURSES' THEN 'Courses'
        WHEN 'COMICS_GRAPHIC_NOVELS' THEN 'Comics Graphic Novels'
        WHEN 'WEB_SERIALS' THEN 'Web Serials'
        WHEN 'CUSTOM_TIMELINE' THEN 'Custom Timeline'
      END || ' ' ||
      coalesce("link_name", '')
    )
  );
