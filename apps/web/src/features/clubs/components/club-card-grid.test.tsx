import { render, screen } from "@testing-library/react";

import { ClubCardGrid } from "./club-card-grid";

describe("ClubCardGrid", () => {
  it("adds columns progressively across desktop and ultra-wide viewports", () => {
    render(
      <ClubCardGrid>
        <div>Club card</div>
      </ClubCardGrid>
    );

    const grid = screen.getByText("Club card").parentElement;

    expect(grid).toHaveClass(
      "md:grid-cols-2",
      "2xl:grid-cols-3",
      "min-[125rem]:grid-cols-4",
      "min-[156.25rem]:grid-cols-5",
      "min-[187.5rem]:grid-cols-6",
      "min-[218.75rem]:grid-cols-7"
    );
  });
});
