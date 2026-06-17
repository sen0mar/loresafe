CREATE INDEX "clubs_search_vector_idx"
  ON "clubs"
  USING GIN (
    to_tsvector(
      'english',
      coalesce("title", '') || ' ' ||
      coalesce("description", '') || ' ' ||
      coalesce("category", '') || ' ' ||
      coalesce("slug", '')
    )
  );

CREATE INDEX "posts_search_vector_idx"
  ON "posts"
  USING GIN (
    to_tsvector(
      'english',
      coalesce("title", '') || ' ' ||
      coalesce("body", '')
    )
  )
  WHERE "status" = 'VISIBLE' AND "deleted_at" IS NULL;
