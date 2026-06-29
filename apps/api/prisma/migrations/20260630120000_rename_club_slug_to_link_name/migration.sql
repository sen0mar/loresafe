DROP INDEX IF EXISTS "clubs_search_vector_idx";

DROP INDEX IF EXISTS "clubs_slug_unique";

ALTER TABLE "clubs"
  RENAME COLUMN "slug" TO "link_name";

CREATE UNIQUE INDEX "clubs_link_name_unique" ON "clubs"("link_name");

CREATE INDEX "clubs_search_vector_idx"
  ON "clubs"
  USING GIN (
    to_tsvector(
      'english',
      coalesce("title", '') || ' ' ||
      coalesce("description", '') || ' ' ||
      coalesce("category", '') || ' ' ||
      coalesce("link_name", '')
    )
  );
