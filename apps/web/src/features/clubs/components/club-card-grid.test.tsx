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
      "min-[2000px]:grid-cols-4",
      "min-[2500px]:grid-cols-5",
      "min-[3000px]:grid-cols-6",
      "min-[3500px]:grid-cols-7"
    );
  });
});
